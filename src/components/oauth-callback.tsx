"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SiteBrand } from "./site-brand";

export default function OAuthCallback() {
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.slice(1));
    const denied = url.searchParams.get("error") ?? hash.get("error");
    const clearCallback = () => {
      if (alive)
        window.history.replaceState(window.history.state, "", "/auth/callback");
    };
    async function complete() {
      try {
        if (!supabase) throw new Error("ยังไม่ได้ตั้งค่าระบบเข้าสู่ระบบ");
        // The existing browser SDK consumes the callback and persists the session.
        // Wait for it before clearing URL credentials; never parse/store tokens here.
        const initialized = await supabase.auth.initialize();
        // Clear callback details before navigation, so history changes cannot
        // interrupt a pending client-side route transition.
        clearCallback();
        if (denied)
          throw new Error(
            denied === "access_denied"
              ? "ยกเลิกการเข้าสู่ระบบ แล้ว คุณสามารถลองใหม่ได้"
              : "เข้าสู่ระบบ ไม่สำเร็จ กรุณาลองใหม่หรือติดต่อผู้ดูแล",
          );
        if (initialized.error)
          throw new Error("ยืนยันการเข้าสู่ระบบไม่สำเร็จ กรุณาเข้าสู่ระบบใหม่");
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !data.session)
          throw new Error("ไม่พบการเข้าสู่ระบบที่สมบูรณ์ กรุณาเข้าสู่ระบบใหม่");
        // Validate identity with Auth; a local token by itself grants no access.
        const result = await supabase.auth.getUser();
        if (result.error || !result.data.user)
          throw new Error("ยืนยันบัญชี ไม่สำเร็จ กรุณาเข้าสู่ระบบใหม่");
        if (alive) {
          sessionStorage.removeItem("site-daily-demo");
          window.location.replace("/dashboard");
        }
      } catch (error) {
        clearCallback();
        if (alive)
          setError(
            error instanceof Error ? error.message : "เข้าสู่ระบบไม่สำเร็จ",
          );
      }
    }
    void complete();
    return () => {
      alive = false;
    };
  }, []);
  return (
    <main className="login-form" style={{ minHeight: "100vh" }}>
      <section className="login-card">
        <SiteBrand />
        <h1>เข้าสู่ระบบ</h1>
        {error ? (
          <>
            <p className="error" role="alert">
              {error}
            </p>
            <Link className="button primary w-full" href="/login">
              กลับไปเข้าสู่ระบบ
            </Link>
          </>
        ) : (
          <p role="status">กำลังยืนยันบัญชีและเปิดพื้นที่ทำงาน…</p>
        )}
      </section>
    </main>
  );
}
