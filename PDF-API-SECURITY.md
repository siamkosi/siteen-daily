# PDF API และลิงก์กู้รหัสผ่าน

ปรับใน DEV วันที่ 24 ตุลาคม 2026 โดยไม่ deploy

## ลิงก์กู้รหัสผ่าน

ใช้ origin ของหน้าที่ใช้งานกับเส้นทาง `/update-password` คงที่ ไม่ hardcode localhost และไม่ใช้ปลายทางจาก query string ทดสอบพอร์ต 3100 และโดเมน HTTPS แล้ว ยังต้องเพิ่มโดเมน production ใน Site URL/Redirect URLs ของ Supabase และทดสอบ SMTP เมื่อมีโดเมนจริง รอบนี้ไม่ส่งอีเมลและไม่เปลี่ยนรหัสผ่านของผู้ใช้

## การสร้าง PDF

- Client แนบ access token และตัวระบุชนิดเอกสาร ID เอกสาร และบริษัท
- Server ตรวจ token ด้วย `auth.getUser(token)` ไม่เชื่อ JWT ที่ decode เองหรือ session จาก client; ไม่รับบัญชี anonymous
- ตรวจอ่าน `daily_reports` หรือ `daily_requests` ด้วย JWT ผู้ใช้ผ่าน RLS ก่อนสร้างไฟล์ รองรับ owner/editor/viewer ที่อ่านฉบับนั้นได้ สมาชิกที่ถูกถอนสิทธิ์ไม่มีสิทธิ์จากข้อมูล role ที่ค้างใน browser
- Origin ต้องตรง `APP_ORIGIN` ที่ตั้งใน server เท่านั้น; รองรับ HTTPS หลัง proxy โดยไม่เชื่อ X-Forwarded-Host; local อนุญาต HTTP เฉพาะ loopback ที่ตั้งไว้
- ขาด token/ไม่ถูกต้องได้ 401; ไม่มีสิทธิ์เอกสารได้ 403; เกินโควตาได้ 429 พร้อม Retry-After; Auth/ฐานข้อมูลล่มจะไม่ข้ามการตรวจสิทธิ์
- ใช้ตาราง private และ RPC ที่ตรวจ auth.uid() ไม่ใช้ service-role key และไม่ให้ client อ่าน/แก้แถวโควตาโดยตรง
- เพดานปัจจุบัน: 6 งานที่รับสร้างต่อ 60 วินาทีต่อผู้ใช้; ผู้ใช้ละ 1 งานพร้อมกัน; ทั้งระบบ 2 งานพร้อมกัน ใช้ advisory transaction lock และข้อมูลร่วมใน PostgreSQL จึงรวมทุก instance
- คิวถูกคืนใน finally ทั้งกรณีสำเร็จ/ผิดพลาด ถ้า process หยุด lease หมดอายุใน 90 วินาที ประวัติเพื่อคำนวณโควตายังคงอยู่หลังคืนคิวและถูกเก็บกวาดเมื่อเก่าเกินช่วงใช้งาน
- คง limit JSON 32 MiB, จำกัดเวลารับ body 15 วินาที, timeout ของ Auth/Data API, renderer watchdog, ปิด JavaScript/remote network และส่ง PDF แบบ no-store
- Logs มีเฉพาะรหัสขั้นตอนที่ล้มเหลว ไม่บันทึก access token, signed URL หรือเนื้อหารายงาน

โหมดข้อมูลตัวอย่างไม่มีสิทธิ์เรียก server สร้าง PDF แบบ anonymous อีกต่อไป การส่งออกต้องใช้บัญชีจริงและเอกสารที่บัญชีนั้นอ่านได้ Tests ใช้ Auth/RLS fixtures เฉพาะฝั่ง test runner ไม่มี bypass ใน runtime ของเว็บ

## การตั้งค่าและ migration

`.env.local` ตั้ง `APP_ORIGIN=http://127.0.0.1:3000` สำหรับเครื่องนี้; ใน production ตั้งเป็น origin HTTPS จริงโดยไม่มี path และใช้ migration ทั้งชุดกับฐานข้อมูลปลายทาง

- `20261024041651_pdf_export_limits.sql`
- `20261024041918_pdf_jobs_deny_direct_access.sql`

Migration ทั้งสองใช้เฉพาะ DEV `hvcwskmqwvrjsrysllly` แล้ว ไม่แก้ข้อมูลรายงาน คำขอ รูปภาพ บัญชี หรือสมาชิก ไม่มีการตั้งค่า production หรือ deploy

## ผลตรวจ

- Build/TypeScript และ lint ผ่าน
- Browser/API tests 28/28 ผ่าน รวม token ปลอม/หมดอายุ, cross-origin, proxy origin, สมาชิกไม่มีสิทธิ์, quota/Retry-After, คืนคิวเมื่อผิดพลาด, body limits, callback และ workflow PDF จริงด้วย fixtures
- PostgreSQL/RLS tests 125 ข้อผ่าน รวม global capacity, per-user limit, window quota หลังคืนคิว, lease หมดอายุ, viewer, non-member และป้องกันปล่อยคิวของผู้ใช้อื่น
- ทดสอบ claim/busy/release บน DEV ภายใต้ role authenticated แล้ว rollback; Security Advisors ไม่มี lints
- บัญชี editor จริง welovecyclist@gmail.com เปิดและส่งออก Hampton ล่าสุดได้ ไม่มี error และมีรายการคิวที่คืนแล้ว
- Same-origin probe ที่ไม่ส่ง token เปลี่ยนจาก HTTP 200 เป็น 401; foreign/missing Origin ยังได้ 403

ยังต้องเตรียม runtime PDF บนโฮสต์จริง, gateway limits/load test, SMTP/redirect allowlist, ป้องกันแก้เอกสารทับกัน และ backup ก่อนเปิดให้ทีมใช้งาน production ตามรายงานความพร้อม
