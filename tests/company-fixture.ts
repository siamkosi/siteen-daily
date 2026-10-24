import { expect, type Page } from "@playwright/test";
export const uid = "10000000-0000-4000-8000-000000000001",
  wid = "20000000-0000-4000-8000-000000000001",
  pid = "30000000-0000-4000-8000-000000000001",
  mid = "10000000-0000-4000-8000-000000000002",
  iid = "40000000-0000-4000-8000-000000000001";
export async function companyFixture(
  page: Page,
  role: "owner" | "member" | "none" = "owner",
) {
  const user = {
    id: uid,
    email: "owner@example.test",
    email_confirmed_at: "2026-10-24T00:00:00Z",
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-10-24T00:00:00Z",
  };
  const part = (v: unknown) =>
    Buffer.from(JSON.stringify(v)).toString("base64url");
  const token = `${part({ alg: "HS256", typ: "JWT" })}.${part({ sub: uid, exp: 4102444800, role: "authenticated" })}.signature`;
  await page.addInitScript(
    ({ user, token }) => {
      localStorage.setItem(
        "sb-hvcwskmqwvrjsrysllly-auth-token",
        JSON.stringify({
          access_token: token,
          refresh_token: "test-only",
          token_type: "bearer",
          expires_at: 4102444800,
          user,
        }),
      );
    },
    { user, token },
  );
  await page.route("**/auth/v1/user", (r) => r.fulfill({ json: user }));
  const state = {
    role,
    assignment: "editor" as string | null,
    version: 1,
    writes: 0,
    sends: 0,
    accepted: false,
    cancelled: false,
  };
  const invitation = () => ({
    id: iid,
    workspace_id: wid,
    company_name: "27 วิศวกรรม",
    email: user.email,
    role: "editor",
    projects: [{ id: pid, name: "Hampton" }],
    project_ids: [pid],
    status: state.accepted
      ? "accepted"
      : state.cancelled
        ? "cancelled"
        : "pending",
    delivery_status: "sent",
    row_version: 1,
    created_at: "2026-10-24T00:00:00Z",
    expires_at: "2099-10-31T00:00:00Z",
  });
  await page.route("**/rest/v1/**", async (r) => {
    const path = new URL(r.request().url()).pathname;
    const body =
      r.request().method() === "POST" ? r.request().postDataJSON() : null;
    if (path.endsWith("/memberships"))
      return r.fulfill({
        json:
          state.role === "none"
            ? []
            : [
                {
                  workspace_id: wid,
                  role: state.role,
                  workspaces: { id: wid, name: "27 วิศวกรรม" },
                },
              ],
      });
    if (path.endsWith("/projects"))
      return r.fulfill({
        json:
          state.role === "none"
            ? []
            : [
                {
                  id: pid,
                  workspace_id: wid,
                  name: "Hampton",
                  location: "สุขุมวิท",
                  client: "Client",
                  status: "active",
                  created_at: "2026-10-24T00:00:00Z",
                },
              ],
      });
    if (path.endsWith("/project_memberships"))
      return r.fulfill({
        json:
          state.role === "member"
            ? [
                {
                  workspace_id: wid,
                  user_id: uid,
                  project_id: pid,
                  role: state.assignment,
                  row_version: state.version,
                },
              ]
            : [],
      });
    if (path.endsWith("/rpc/list_company_members_with_revisions")) {
      expect(state.role).toBe("owner");
      return r.fulfill({
        json: [
          {
            user_id: uid,
            email: user.email,
            role: "owner",
            membership_version: "60000000-0000-4000-8000-000000000001",
            assignments: [],
          },
          {
            user_id: mid,
            email: "engineer@example.test",
            role: "member",
            membership_version: "60000000-0000-4000-8000-000000000002",
            assignments: [
              {
                user_id: mid,
                project_id: pid,
                role: state.assignment,
                row_version: state.version,
              },
            ],
          },
        ],
      });
    }
    if (path.endsWith("/rpc/list_project_assignments"))
      return r.fulfill({
        json: [
          {
            user_id: mid,
            project_id: pid,
            role: state.assignment,
            row_version: state.version,
          },
        ],
      });
    if (path.endsWith("/rpc/set_project_assignment")) {
      expect(body).toEqual({
        target_workspace: wid,
        target_project: pid,
        target_user: mid,
        new_role: body.new_role,
        expected_version: state.version,
        expected_membership_version: "60000000-0000-4000-8000-000000000002",
      });
      state.assignment = body.new_role;
      state.version++;
      state.writes++;
      return r.fulfill({ status: 204, body: "" });
    }
    if (path.endsWith("/rpc/list_my_company_invitations"))
      return r.fulfill({
        json: {
          items: state.role === "none" ? [invitation()] : [],
          next_cursor: null,
        },
      });
    if (path.endsWith("/rpc/list_company_invitations"))
      return r.fulfill({
        json: { items: state.sends ? [invitation()] : [], next_cursor: null },
      });
    if (path.endsWith("/rpc/list_company_access_events"))
      return r.fulfill({
        json: {
          items: state.writes
            ? [
                {
                  id: iid,
                  action: "project_assignment_changed",
                  actor_id: uid,
                  created_at: "2026-10-24T00:00:00Z",
                  details: {
                    project_id: pid,
                    user_id: mid,
                    role: state.assignment,
                  },
                },
              ]
            : [],
          next_cursor: null,
        },
      });
    if (path.endsWith("/rpc/accept_company_invitation")) {
      expect(body).toEqual({ target_invitation: iid, expected_version: 1 });
      state.accepted = true;
      state.role = "member";
      return r.fulfill({ json: wid });
    }
    if (path.endsWith("/rpc/cancel_company_invitation")) {
      state.cancelled = true;
      return r.fulfill({ status: 204, body: "" });
    }
    return r.fulfill({ json: [] });
  });
  await page.route("**/api/company-invitations", (r) => {
    const p = r.request().postDataJSON();
    expect(p.workspaceId).toBe(wid);
    expect(p.projectIds).toEqual([pid]);
    expect(p.role).toBe("editor");
    state.sends++;
    return r.fulfill({ json: { id: iid, delivery_status: "sent" } });
  });
  return state;
}
