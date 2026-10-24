import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { updateLiveDocument } from "./live-document-write.mjs";

for (const table of ["daily_reports", "daily_requests"]) {
  test(`${table}: SDK sends snapshot version, validation and conflicts stay distinguishable`, async () => {
    const snapshot = {
      id: "document-qa",
      workspace_id: "workspace-qa",
      row_version: 1,
    };
    const requests = [];
    let row = { ...snapshot, workers: 2 };
    const client = createClient("https://example.test", "test-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: async (input, init) => {
          const url = new URL(input);
          const body = JSON.parse(init.body);
          requests.push(body);
          assert.equal(init.method, "PATCH");
          assert.equal(url.pathname, `/rest/v1/${table}`);
          assert.equal(
            url.searchParams.get("workspace_id"),
            `eq.${snapshot.workspace_id}`,
          );
          assert.equal(url.searchParams.get("id"), `eq.${snapshot.id}`);
          let status = 200,
            result;
          if (body.expected_version !== row.row_version) {
            status = 409;
            result = {
              code: "40001",
              message: "Document changed since it was opened",
            };
          } else if (body.report_details?.material_rows[0].quantity < 0) {
            status = 400;
            result = {
              code: "23514",
              message:
                'new row violates check constraint "valid_report_material_rows"',
            };
          } else {
            row = {
              ...row,
              ...body,
              row_version: row.row_version + 1,
              expected_version: null,
            };
            result = row;
          }
          return new Response(JSON.stringify(result), {
            status,
            headers: { "Content-Type": "application/json" },
          });
        },
      },
    });
    const invalid = await updateLiveDocument(client, table, snapshot, {
      report_details: { material_rows: [{ quantity: -1 }] },
    });
    assert.equal(invalid.error.code, "23514");
    const saved = await updateLiveDocument(client, table, snapshot, {
      workers: 3,
      expected_version: 999,
    })
      .select()
      .single();
    assert.equal(saved.error, null);
    assert.equal(saved.data.row_version, 2);
    assert.equal(requests[1].expected_version, 1);
    const conflict = await updateLiveDocument(client, table, snapshot, {
      workers: 999,
    });
    assert.equal(conflict.error.code, "40001");
    assert.equal(row.workers, 3);
    assert.equal(row.row_version, 2);
    assert.equal(
      requests.length,
      3,
      "No refetch or automatic retry after conflict",
    );
    const next = await updateLiveDocument(client, table, saved.data, {
      workers: 4,
    })
      .select()
      .single();
    assert.equal(next.data.row_version, 3);
    assert.equal(requests[3].expected_version, 2);
  });
}

test("live document writes fail before network if the snapshot has no version", () => {
  const client = {
    from() {
      throw new Error("Must not reach network");
    },
  };
  for (const row_version of [undefined, null, 0, -1, 1.5, "1"])
    assert.throws(
      () =>
        updateLiveDocument(
          client,
          "daily_reports",
          { id: "qa", workspace_id: "qa", row_version },
          {},
        ),
      /valid row_version/,
    );
  assert.throws(
    () => updateLiveDocument(client, "projects", {}, {}),
    /Unsupported/,
  );
});
