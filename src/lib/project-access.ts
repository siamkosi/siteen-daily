import type { Project, Workspace } from "./types";
export type ProjectRole = "editor" | "viewer";
export type DocumentRole = "owner" | ProjectRole;
export type ProjectAssignment = {
  workspace_id?: string;
  user_id: string;
  project_id: string;
  role: ProjectRole | null;
  row_version: number;
};
export function projectRole(
  company: Workspace | undefined,
  project: Project | undefined,
  assignments: ProjectAssignment[],
): DocumentRole | undefined {
  if (!company || !project || project.workspace_id !== company.id)
    return undefined;
  if (company.role === "owner") return "owner";
  return (
    assignments.find(
      (a) =>
        a.project_id === project.id &&
        (!a.workspace_id || a.workspace_id === company.id),
    )?.role ?? undefined
  );
}
