# Google Login ตั้งค่า DEV สำเร็จ

24 ตุลาคม 2026 เวลา 14:30 น. (ประเทศไทย) — ยังไม่ deploy

## Google Cloud

- บัญชีผู้ดูแล: siamkosi@gmail.com
- โปรเจกต์ใหม่ที่ผู้ใช้ระบุ: **SiteEN DAILY**, Project ID `siteen-daily`, Project number `1037393461501`
- Google Auth Platform: App name SiteEN DAILY, ผู้ติดต่อ siamkosi@gmail.com, Audience External, Publishing status **Testing**
- OAuth client: **SiteEN DAILY DEV**, ประเภท Web application
- Authorized JavaScript origins: `http://127.0.0.1:3000`, `http://localhost:3000`
- Authorized redirect URI: `https://hvcwskmqwvrjsrysllly.supabase.co/auth/v1/callback`
- Scopes ที่บันทึก: `openid`, `https://www.googleapis.com/auth/userinfo.email`, `https://www.googleapis.com/auth/userinfo.profile` ไม่มี sensitive/restricted scopes
- Test users เฉพาะ **siamkosi@gmail.com** และ **welovecyclist@gmail.com** ตามคำอนุญาตที่ระบุรายชื่อ ผู้ใช้ยอมรับ Google API Services User Data Policy และอนุญาตสร้าง/เชื่อม OAuth client แล้ว

## Supabase DEV

- Project ref `hvcwskmqwvrjsrysllly` — SITE DAILY TH DEV
- Google provider **Enabled** ตรวจซ้ำจาก public Auth settings ได้ `google_enabled=true`
- Client ID/Secret ส่งจากหน้าสร้างของ Google ไปใส่ใน Supabase เท่านั้น ไม่เขียน Secret ลงโค้ด .env เอกสาร หรือแชต และล้างตัวแปรค่าลับชั่วคราวหลังบันทึก
- Skip nonce checks **ปิด**, Allow users without email **ปิด**
- เพิ่ม exact Redirect URLs สี่รายการ โดยไม่ใช้ wildcard:
  - `http://127.0.0.1:3000/auth/callback`
  - `http://localhost:3000/auth/callback`
  - `http://127.0.0.1:3000/update-password`
  - `http://localhost:3000/update-password`
- คง Site URL เดิม `http://localhost:3000`, email/password login, email confirmation, นโยบายสมาชิกและ RLS เดิม

## ผลตรวจจริง

ทดสอบด้วย Chrome ผ่าน `http://localhost:3000` เพื่อแยก web storage จากหน้า DEV หลัก `http://127.0.0.1:3000` และไม่ต้องออกจากเซสชันเดิมเพื่อทดสอบ

| บัญชี | Google Login | User ID เดิม | สมาชิก 27 วิศวกรรม |
|---|---|---|---|
| siamkosi@gmail.com | สำเร็จ กลับ dashboard และเลือกบริษัท 27 วิศวกรรม | `f0eed677-bb05-4863-9b9a-30164206b61f` | owner |
| welovecyclist@gmail.com | สำเร็จ กลับ dashboard และเห็นโครงการ/รายงาน | `3b06b522-1bff-4496-8c22-0b1b616d657d` | editor |

อ่าน Auth users/identities เฉพาะสองอีเมลและ memberships เฉพาะบริษัท 27 วิศวกรรม ยืนยันว่าทั้งคู่มี providers `email` และ `google` เชื่อมกับ User ID เดิม ไม่สร้างบัญชีซ้ำหรือเพิ่มสมาชิกบริษัท Security Advisor ไม่พบรายการแจ้งเตือน

Google session ของ editor เปิด Daily Report Hampton วันที่ 23 ตุลาคม 2569 ได้ และเห็นปุ่มแก้ไข/ส่งออกตามสิทธิ์เดิม ตรวจแบบอ่านอย่างเดียว ไม่บันทึกแก้ไขหรือส่งออก PDF จาก localhost ในรอบนี้

รอบนี้ไม่แก้โค้ดแอปหรือเนื้อหาโครงการ/รายงาน และไม่ deploy ชุดทดสอบโค้ดล่าสุดก่อนตั้งค่าบริการผ่าน 54/54 รายการ, RLS 295 จุด, build/TypeScript/lint ผ่าน

## ก่อน production

- ปัจจุบันเป็น Testing สำหรับสองอีเมลนี้ ต้องกำหนดนโยบายรับสมาชิกและการเปิด Audience ก่อนเปิดทีมเพิ่ม
- เมื่อมีโดเมนจริง เพิ่ม origin/redirect HTTPS ให้ตรงทั้ง Google และ Supabase ตั้ง Site URL/APP_ORIGIN ของ production และตรวจ branding/นโยบายความเป็นส่วนตัวตามข้อกำหนด Google
- ใช้ `http://127.0.0.1:3000` สำหรับทดสอบ PDF ปัจจุบัน เพราะ APP_ORIGIN ตั้งตรง origin นี้ การทดสอบ Google ที่ localhost รอบนี้ไม่ใช่ผลทดสอบ PDF จาก localhost
- ไม่มีการสร้าง production deployment หรือใช้ Cloud Run/VM ในงานนี้

หน้าตั้งค่า: [Google Clients](https://console.cloud.google.com/auth/clients?project=siteen-daily), [Google Audience](https://console.cloud.google.com/auth/audience?project=siteen-daily), [Supabase Google provider](https://supabase.com/dashboard/project/hvcwskmqwvrjsrysllly/auth/providers?provider=Google)
