import { supabase } from "./supabase";

export function googleCallbackUrl(origin: string) {
  const url = new URL(origin);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:"))
    throw new Error("กรุณาเข้าสู่ระบบผ่านเว็บไซต์ HTTPS");
  return `${url.origin}/auth/callback`;
}

export async function signInWithGoogle() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabase || !url || !key)
    throw new Error("ยังไม่ได้ตั้งค่าระบบเข้าสู่ระบบ กรุณาติดต่อผู้ดูแล");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    // Public provider availability only. No Google client secret is in the app.
    const response = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("Auth settings unavailable");
    const settings = await response.json();
    if (settings.external?.google !== true)
      throw new GoogleProviderUnavailable();
  } catch (error) {
    if (error instanceof GoogleProviderUnavailable) throw error;
    throw new Error(
      "ตรวจสอบการเข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองอีกครั้ง",
    );
  } finally {
    clearTimeout(timer);
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: googleCallbackUrl(window.location.origin),
      queryParams: { prompt: "select_account" },
    },
  });
  if (error)
    throw new Error("เริ่มเข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองอีกครั้ง");
}

class GoogleProviderUnavailable extends Error {
  constructor() {
    super(
      "ยังไม่ได้เปิดเข้าสู่ระบบด้วย Google กรุณาให้ผู้ดูแลตั้งค่าการเชื่อมต่อก่อน",
    );
  }
}
