// Use the version that was read with the document. Never fetch a newer version
// or retry a conflict automatically: that would hide another engineer's edit.
export function updateLiveDocument(client, table, snapshot, changes) {
  if (!["daily_reports", "daily_requests"].includes(table))
    throw new Error("Unsupported document table");
  if (
    !snapshot.id ||
    !snapshot.workspace_id ||
    !Number.isSafeInteger(snapshot.row_version) ||
    snapshot.row_version < 1
  )
    throw new Error("A document snapshot with a valid row_version is required");
  return client
    .from(table)
    .update({ ...changes, expected_version: snapshot.row_version })
    .eq("workspace_id", snapshot.workspace_id)
    .eq("id", snapshot.id);
}
