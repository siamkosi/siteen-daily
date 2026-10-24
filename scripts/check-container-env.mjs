import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const manifestPath = new URL("../build-public-env.json", import.meta.url);

export function validatePublicEnv(env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL before building");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== "/"
  )
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be an HTTPS origin");
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  let anon = false;
  try {
    anon =
      JSON.parse(Buffer.from(key.split(".")[1] || "", "base64url").toString())
        .role === "anon";
  } catch {}
  if (!key.startsWith("sb_publishable_") && !anon)
    throw new Error(
      "Use a publishable/anon key only; never a service_role or secret key",
    );
  return { url, key };
}

export function validateRuntimeEnv(env, built) {
  const current = validatePublicEnv(env);
  if (current.url !== built.url || current.key !== built.key)
    throw new Error(
      "Public Supabase configuration differs from the image build; rebuild for this environment",
    );
  let origin;
  try {
    origin = new URL(env.APP_ORIGIN);
  } catch {
    throw new Error("Set APP_ORIGIN to the website origin");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  if (
    (origin.protocol !== "https:" && !(local && origin.protocol === "http:")) ||
    origin.origin !== env.APP_ORIGIN
  )
    throw new Error(
      "APP_ORIGIN must be an exact HTTPS origin (HTTP allowed for loopback testing)",
    );
  if (env.PDF_BROWSER !== "chromium" || env.PDF_CHROMIUM_SANDBOX !== "true")
    throw new Error(
      "The VPS container requires PDF_BROWSER=chromium and PDF_CHROMIUM_SANDBOX=true",
    );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    if (process.argv.includes("--build")) {
      writeFileSync(
        manifestPath,
        JSON.stringify(validatePublicEnv(process.env)),
      );
    } else {
      validateRuntimeEnv(
        process.env,
        JSON.parse(readFileSync(manifestPath, "utf8")),
      );
    }
    console.log("SiteEN container configuration OK");
  } catch (error) {
    // Messages identify configuration names only, never their values.
    console.error(error.message);
    process.exitCode = 1;
  }
}
