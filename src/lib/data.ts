import { supabase } from "./supabase";

// Stable pagination avoids silently truncating a company's report history at
// Supabase's default Data API row limit. Server-side aggregates can replace
// this for larger production workspaces.
export async function workspaceRows<T>(
  table: "projects" | "daily_reports" | "daily_requests",
  workspace: string,
): Promise<T[]> {
  if (!supabase) throw new Error("ยังไม่ได้เชื่อมต่อ Supabase");
  const rows: T[] = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    let query = supabase.from(table).select("*").eq("workspace_id", workspace);
    if (table === "daily_reports" || table === "daily_requests")
      query = query.order("report_date", { ascending: false });
    else if (table === "projects")
      query = query.order("created_at", { ascending: false });
    const { data, error } = await query
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data as T[]));
    if (data.length < pageSize) return rows;
  }
}

// Fetch the complete assignment set: PostgREST's default row cap must not hide grants.
export async function ownProjectAssignments(user: string) {
  if (!supabase) throw new Error("Auth not configured");
  const rows: import("./project-access").ProjectAssignment[] = [];
  for (let from = 0; ; from += 500) {
    const r = await supabase
      .from("project_memberships")
      .select("workspace_id,user_id,project_id,role,row_version")
      .eq("user_id", user)
      .order("workspace_id")
      .order("project_id")
      .range(from, from + 499);
    if (r.error) return { data: null, error: r.error };
    rows.push(...(r.data ?? []));
    if ((r.data ?? []).length < 500) return { data: rows, error: null };
  }
}
