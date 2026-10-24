"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SiteBrand } from "./site-brand";
import { passwordRecoveryUrl } from "@/lib/recovery-url";

export default function PasswordRecovery({
  update = false,
}: {
  update?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!update || !supabase) return;
    let alive = true;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) setAuthorized(Boolean(session));
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (alive) {
        setAuthorized(Boolean(data.session));
        if (error) setMessage("ลิงก์ใช้ไม่ได้หรือหมดอายุ กรุณาขอลิงก์ใหม่");
      }
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [update]);
  return (
    <main className="login-form" style={{ minHeight: "100vh" }}>
      <section className="login-card">
        <SiteBrand />
        <h1>{update ? "ตั้งรหัสผ่านใหม่" : "กู้รหัสผ่าน"}</h1>
        <p>
          {update
            ? "กรอกรหัสผ่านใหม่ด้วยตนเอง ไม่ต้องส่งรหัสผ่านให้ผู้ช่วย"
            : "ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปยังอีเมลของคุณ"}
        </p>
        {!done && (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const fields = new FormData(form);
              setBusy(true);
              setMessage("");
              try {
                if (!supabase)
                  throw new Error("ยังไม่ได้ตั้งค่าการเชื่อมต่อ DEV");
                if (update) {
                  if (!authorized)
                    throw new Error("กรุณาเปิดลิงก์จากอีเมลกู้รหัสผ่านก่อน");
                  const password = String(fields.get("password"));
                  if (password !== fields.get("confirm"))
                    throw new Error("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
                  const { error } = await supabase.auth.updateUser({
                    password,
                  });
                  if (error) throw error;
                  form.reset();
                  setDone(true);
                  setMessage(
                    "ตั้งรหัสผ่านใหม่แล้ว กลับเข้าแอปเพื่อทำงานต่อได้",
                  );
                } else {
                  const { error } = await supabase.auth.resetPasswordForEmail(
                    String(fields.get("email")).trim(),
                    {
                      redirectTo: passwordRecoveryUrl(window.location.origin),
                    },
                  );
                  if (error) throw error;
                  setDone(true);
                  setMessage(
                    "ส่งคำขอแล้ว หากมีบัญชีนี้ในระบบ คุณจะได้รับอีเมลสำหรับตั้งรหัสผ่านใหม่ กรุณาตรวจกล่องจดหมายและจดหมายขยะ",
                  );
                }
              } catch (error) {
                setMessage(
                  error instanceof Error ? error.message : "ดำเนินการไม่สำเร็จ",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {update ? (
              <>
                <label>
                  รหัสผ่านใหม่
                  <input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    disabled={!authorized || busy}
                  />
                </label>
                <label>
                  ยืนยันรหัสผ่านใหม่
                  <input
                    name="confirm"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    disabled={!authorized || busy}
                  />
                </label>
                {!authorized && (
                  <p role="status">
                    กรุณาเปิดหน้านี้ผ่านลิงก์กู้รหัสผ่านในอีเมล
                    หากลิงก์หมดอายุให้ขอลิงก์ใหม่
                  </p>
                )}
              </>
            ) : (
              <label>
                อีเมล
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </label>
            )}
            <button
              className="button primary w-full"
              disabled={busy || (update && !authorized)}
            >
              {busy
                ? "กำลังดำเนินการ…"
                : update
                  ? "บันทึกรหัสผ่านใหม่"
                  : "ส่งลิงก์กู้รหัสผ่าน"}
            </button>
          </form>
        )}
        {message && <p role="status">{message}</p>}
        <Link className="text-button" href="/login">
          กลับเข้าแอป
        </Link>
        {update && (
          <Link className="text-button" href="/reset-password">
            ขอลิงก์กู้รหัสผ่านใหม่
          </Link>
        )}
      </section>
    </main>
  );
}
