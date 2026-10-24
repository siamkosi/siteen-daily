export function passwordRecoveryUrl(origin: string) {
  return new URL("/update-password", new URL(origin).origin).href;
}
