// Account defaults only select among memberships returned by the database.
// They grant no company access or role.
const accountDefaults: Record<string, string> = {
  "f0eed677-bb05-4863-9b9a-30164206b61f":
    "dcf175be-9fe4-49cb-a4e5-f2fdf88a41d5",
};

export function workspacePreference(
  user: { id: string; last_sign_in_at?: string },
  memberships: { id: string }[],
  storage: Pick<Storage, "getItem" | "setItem">,
) {
  const key = `site-daily-workspace:${user.id}`;
  const loginKey = `site-daily-workspace-login:${user.id}`;
  const configured = accountDefaults[user.id];
  const defaultId = memberships.some((w) => w.id === configured)
    ? configured
    : (memberships[0]?.id ?? "");
  let preferred = "";
  let newLogin = false;
  try {
    preferred = storage.getItem(key) ?? "";
    if (
      configured &&
      storage.getItem(loginKey) !== (user.last_sign_in_at ?? "initial")
    ) {
      newLogin = true;
      preferred = defaultId;
      storage.setItem(key, preferred);
      storage.setItem(loginKey, user.last_sign_in_at ?? "initial");
    }
  } catch {
    preferred = defaultId;
  }
  return {
    preferred: memberships.some((w) => w.id === preferred)
      ? preferred
      : defaultId,
    newLogin,
  };
}
