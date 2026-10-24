import { test } from "node:test";
import assert from "node:assert/strict";
import { createInvitationHandler } from "../src/lib/server/invitation-handler.ts";
import {
  createInvitationAuthenticator,
  createInvitationSender,
} from "../src/lib/server/invitation-auth.ts";
const id = "10000000-0000-4000-8000-000000000001";
const payload = {
  workspaceId: id,
  email: "new@example.test",
  projectIds: [id],
  role: "editor",
  requestId: id,
};
function fixture(overrides = {}) {
  const calls = [];
  const principal = {
    prepare: async (p) => {
      calls.push(["prepare", p]);
      return { id, attempt_id: id, email: p.email, send: true, row_version: 1 };
    },
    complete: async (_id, result) => {
      calls.push(["complete", result]);
    },
  };
  const handler = createInvitationHandler({
    appOrigin: "http://localhost:3000",
    authenticate: async () => principal,
    send: async (email, url) => {
      calls.push(["send", email, url]);
      return "sent";
    },
    ...overrides,
  });
  return {
    calls,
    principal,
    handler,
    post: (body = payload, headers = {}) =>
      handler(
        new Request("http://localhost:3000/api/company-invitations", {
          method: "POST",
          headers: {
            origin: "http://localhost:3000",
            authorization: "Bearer mock-token",
            "content-type": "application/json",
            ...headers,
          },
          body: JSON.stringify(body),
        }),
      ),
  };
}
test("origin, authentication and payload rejected before mail", async () => {
  const f = fixture();
  assert.equal(
    (await f.post(payload, { origin: "https://evil.test" })).status,
    403,
  );
  assert.equal((await f.post(payload, { authorization: "" })).status, 401);
  for (const body of [
    { ...payload, role: "owner" },
    { ...payload, projectIds: [] },
    { ...payload, redirectTo: "https://evil.test" },
    { ...payload, email: "x".repeat(17000) },
  ])
    assert.ok((await f.post(body)).status >= 400);
  assert.equal(f.calls.length, 0);
  assert.equal(
    (await fixture({ authenticate: async () => null }).post()).status,
    401,
  );
});
test("authorized prepare precedes separate OTP sender and delivery record", async () => {
  const f = fixture();
  const r = await f.post();
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.deepEqual(
    f.calls.map((x) => x[0]),
    ["prepare", "send", "complete"],
  );
  assert.equal(f.calls[1][2], "http://localhost:3000/auth/callback");
  assert.equal((await r.json()).delivery_status, "sent");
});
test("denied Owner, rate limit, conflict and duplicate request never send", async () => {
  for (const [code, status] of [
    ["42501", 403],
    ["P0429", 429],
    ["40001", 409],
    ["23505", 409],
  ]) {
    const f = fixture({
      authenticate: async () => ({
        prepare: async () => {
          throw { code };
        },
        complete: async () => {
          throw Error("must not complete");
        },
      }),
    });
    assert.equal((await f.post()).status, status);
    assert.equal(f.calls.length, 0);
  }
  const f = fixture({
    authenticate: async () => ({
      prepare: async () => ({ id, send: false, delivery_status: "sending" }),
      complete: async () => {
        throw Error("must not complete");
      },
    }),
  });
  assert.equal((await f.post()).status, 200);
  assert.equal(f.calls.length, 0);
});
test("failed and unknown outcomes recorded honestly, no automatic retry", async () => {
  for (const outcome of ["failed", "unknown"]) {
    const f = fixture({ send: async () => outcome });
    const r = await f.post();
    assert.equal((await r.json()).delivery_status, outcome);
    assert.equal(r.status, outcome === "failed" ? 502 : 202);
    assert.deepEqual(f.calls.at(-1), ["complete", outcome]);
  }
  const f = fixture({
    authenticate: async () => ({
      prepare: async () => ({
        id,
        attempt_id: id,
        email: payload.email,
        send: true,
      }),
      complete: async () => {
        throw Error("database secret");
      },
    }),
  });
  const r = await f.post();
  assert.equal(r.status, 202);
  assert.equal((await r.json()).delivery_status, "unknown");
});
test("SDK adapters use guarded RPC contracts and sender never carries Owner JWT", async () => {
  const calls = [];
  const config = {
    url: "https://supabase.example.test",
    key: "publishable-only-test",
    fetch: async (input, init) => {
      const url = String(input),
        headers = new Headers(init?.headers),
        body = init?.body ? JSON.parse(init.body) : null;
      calls.push({ url, headers, body });
      if (url.includes("/auth/v1/user")) {
        assert.equal(headers.get("authorization"), "Bearer owner-jwt");
        return Response.json({
          id,
          aud: "authenticated",
          is_anonymous: false,
          email_confirmed_at: "2026-10-24T00:00:00Z",
        });
      }
      if (url.includes("/prepare_company_invitation")) {
        assert.deepEqual(body, {
          target_workspace: id,
          target_email: payload.email,
          target_projects: [id],
          new_role: "editor",
          request_id: id,
          existing_invitation: null,
          expected_version: null,
        });
        return Response.json({
          id,
          attempt_id: id,
          send: true,
          email: payload.email,
        });
      }
      if (url.includes("/complete_company_invitation_delivery")) {
        assert.deepEqual(body, {
          target_workspace: id,
          target_attempt: id,
          delivery_result: "sent",
        });
        return new Response(null, { status: 204 });
      }
      if (url.includes("/auth/v1/otp")) {
        assert.equal(
          headers.get("authorization"),
          "Bearer publishable-only-test",
        );
        assert.equal(
          new URL(url).searchParams.get("redirect_to"),
          "https://siteen.example.test/auth/callback",
        );
        assert.equal(body.create_user, true);
        return Response.json({});
      }
      throw Error("Unexpected path");
    },
  };
  const principal = await createInvitationAuthenticator(config)("owner-jwt");
  assert.ok(principal);
  await principal.prepare(payload);
  await principal.complete(id, "sent", id);
  assert.equal(
    await createInvitationSender(config)(
      payload.email,
      "https://siteen.example.test/auth/callback",
    ),
    "sent",
  );
  assert.equal(calls.length, 4);
});
test("unverified/anonymous identity blocked and provider failure stays unknown", async () => {
  for (const extra of [
    { is_anonymous: true, email_confirmed_at: "2026-01-01Z" },
    { is_anonymous: false, email_confirmed_at: null },
  ]) {
    const auth = createInvitationAuthenticator({
      url: "https://supabase.example.test",
      key: "public-test",
      fetch: async () => Response.json({ id, aud: "authenticated", ...extra }),
    });
    assert.equal(await auth("token"), null);
  }
  for (const [status, outcome] of [
    [429, "failed"],
    [503, "unknown"],
  ]) {
    const send = createInvitationSender({
      url: "https://supabase.example.test",
      key: "public-test",
      fetch: async () =>
        Response.json(
          { msg: "mock failure", code: "mock_failure" },
          { status },
        ),
    });
    assert.equal(
      await send(payload.email, "https://siteen.example.test/auth/callback"),
      outcome,
    );
  }
});
