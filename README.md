# SiteEN DAILY — MVP 1.0

Repository สำหรับ release: [siamkosi/siteen-daily](https://github.com/siamkosi/siteen-daily) (private) ใช้ Docker บน Hostinger VPS โดย Database/Auth/Storage อยู่ที่ Supabase ข้อความผลตรวจและการเชื่อมต่อด้านล่างเป็นประวัติ DEV; สถานะปลายทางให้ยึดบันทึก release ที่ตรวจรับแล้ว ไฟล์ `.env.local`, `.env.vps`, private keys, logs และผลทดสอบข้อมูลจริงไม่รวมใน Git

ผลตรวจความพร้อมก่อน Hostinger VPS ล่าสุด: [HOSTINGER-PREDEPLOY-REVIEW.md](HOSTINGER-PREDEPLOY-REVIEW.md) — ยังไม่ deploy

**Hostinger VPS / Linux PDF:** ติดตั้ง Docker Desktop/WSL แล้ว ตรวจ Linux build, PDF ภาษาไทย/รูป/ลายน้ำ, sandbox, HTTP/API และสองงานพร้อมกันผ่าน ใช้ RAM/CPU/PID แบบจำกัดตาม Compose แล้ว **ยังไม่ deploy และยังต้องตรวจบน VPS เป้าหมายจริง** ดู [คู่มือ VPS](HOSTINGER-VPS.md) และ [ผลทดสอบ Linux](DOCKER-LINUX-VERIFICATION.md)

**Daily Request:** เพิ่มเมนูเอกสารขออนุมัติทำงานประจำวัน (DRQ) สำหรับแผนก่อนเริ่มงาน ส่งออก PDF ให้ผู้ควบคุมงานเซ็นภายนอก เชื่อม Daily Report ของโครงการ/วันเดียวกัน และแสดงรายการเอกสารที่ยังขาดบน Dashboard ดู [DAILY-REQUEST.md](DAILY-REQUEST.md) — เพิ่มตารางเฉพาะ DEV แล้ว ยังไม่ deploy เว็บ

**ล่าสุด:** ปุ่ม **ส่งออก PDF** ดาวน์โหลด A4 โดยตรงพร้อมภาษาไทยและรูป ไม่มีหัว–ท้ายเบราว์เซอร์ และซ่อนหน้ารูปเมื่อไม่มีรูปแนบ บริการ local DEV ใช้ Microsoft Edge ที่ติดตั้งในเครื่อง ดู [DIRECT-PDF-EXPORT.md](DIRECT-PDF-EXPORT.md) สำหรับผลตรวจและสิ่งที่ต้องเตรียมก่อนพิจารณา deploy ในอนาคต งานนี้ยังไม่ deploy

**รูปแบบรายงานใหม่:** ปรับตาม PDF อ้างอิงเป็นตาราง 3 ส่วนและหน้ารูป 6 ช่อง พร้อมฟอร์มรายประเภทและการคำนวณคน-ชั่วโมง ดู [REFERENCE-REPORT.md](REFERENCE-REPORT.md) สำหรับฟิลด์ การแบ่งหน้า migrations และผลทดสอบ

**สถานะล่าสุด:** สร้างและเชื่อม Supabase DEV แยกแล้ว ดู [DEV-CONNECTION.md](DEV-CONNECTION.md) สำหรับผลทดสอบล่าสุดและงานที่รออีเมลทดสอบ ข้อความเรื่องยังไม่เชื่อมต่อด้านล่างเป็นคู่มือการตั้งค่าตั้งต้นสำหรับการติดตั้งใหม่

เว็บแอพ Next.js + TypeScript + Tailwind สำหรับผู้รับเหมาไทยรายเล็ก–กลางและวิศวกร โปรเจกต์และ Git repository นี้แยกจากสโตร์พร้อม เก็บ credentials สำหรับแต่ละ environment แยกจาก source และ image

Google Login ใน DEV ตั้งค่า OAuth Client/Supabase สำเร็จและทดสอบบัญชีเดิม owner/editor จริงแล้ว ขณะนี้เป็น Google Testing เฉพาะสองอีเมลที่อนุญาต ดู [GOOGLE-LOGIN-PROVISIONED.md](GOOGLE-LOGIN-PROVISIONED.md), คู่มือติดตั้งใหม่ [GOOGLE-LOGIN.md](GOOGLE-LOGIN.md) และคำแนะนำเลือกโฮสต์ใน [HOSTING-OPTIONS.md](HOSTING-OPTIONS.md)

## เปิดทดลองในเครื่อง

โหมดข้อมูลตัวอย่างเปิดได้เฉพาะ `localhost`, `127.0.0.1` และ IPv6 loopback ในเครื่องพัฒนา/ทดสอบ หน้า Login บนโดเมนใช้งานจริงจะแสดงการเข้าสู่ระบบด้วยบัญชี และข้ามสถานะทดลองที่อาจเคยค้างในแท็บ


ต้องมี Node.js 22.13+ (พัฒนาบน Node.js 24), npm และ Microsoft Edge สำหรับส่งออก PDF

```sh
npm ci
npm run dev
```

เปิด http://127.0.0.1:3000 แล้วเลือก **ทดลองใช้งานด้วยข้อมูลตัวอย่าง** ใช้ได้โดยไม่เชื่อมต่อบริการใด ข้อมูลทดลองอยู่ใน localStorage และสถานะทดลองอยู่ใน sessionStorage ของแท็บนี้ รูปทดลองอยู่ในพื้นที่เก็บข้อมูลเบราว์เซอร์ หากพื้นที่เต็มให้ลดขนาดรูปหรือล้างข้อมูลทดลอง ไม่ควรใช้โหมดนี้เก็บข้อมูลงานจริง

## สิ่งที่ทำได้

- Login / สมัครบัญชีด้วยอีเมลและรหัสผ่านผ่าน Supabase Auth
- Dashboard: โครงการที่ดำเนินการ รายงานวันนี้ ฉบับร่าง และแรงงานจากรายงานวันนี้
- Projects: สร้าง ค้นหา และเปลี่ยนสถานะดำเนินการ/เสร็จสิ้น
- Daily Report: บันทึก/แก้ไขวันที่ อากาศ แรงงาน งานที่ทำ วัสดุ เครื่องจักร ปัญหา ความปลอดภัย และแผนวันถัดไป
- สถานะฉบับร่าง/ส่งรายงานแล้ว โดยคำว่า “ส่ง” คือการบันทึกสถานะในระบบ ไม่ได้ส่งอีเมลหรือขออนุมัติ
- หนึ่งรายงานต่อโครงการต่อวัน บังคับด้วย unique constraint ในฐานข้อมูล
- รับรูป JPG/PNG/WebP ไม่เกิน 20 MiB/40 ล้านพิกเซล ย่อรูปพิมพ์ให้ไม่เกิน 5 MiB พร้อมภาพตัวอย่างแยก แกลเลอรีกรองโครงการ/วันที่และแบ่งหน้า ดู [PHOTO-OPTIMIZATION.md](PHOTO-OPTIMIZATION.md)
- ส่งออก PDF A4 ภาษาไทยพร้อมรูปและช่องลงชื่อ กด **ส่งออก PDF** เพื่อดาวน์โหลดโดยตรง ไม่มีหัว–ท้ายของเบราว์เซอร์
- ฟอนต์ Noto Sans Thai รวมในโปรเจกต์ตาม SIL Open Font License ไม่เรียกบริการฟอนต์ภายนอก
- เลือกพื้นที่บริษัทหลายแห่งได้ ข้อมูลและไฟล์แยกตามสมาชิกของบริษัท
- รองรับมือถือและเมนูย่อ วันที่แสดงพุทธศักราชและใช้เขตเวลา Asia/Bangkok

## เชื่อมต่อ Supabase โปรเจกต์พัฒนาใหม่เท่านั้น

ส่วนนี้สำหรับติดตั้ง Supabase ใหม่ ส่วน release เดิมมีการเชื่อมบริการแล้ว ให้ยืนยันว่าจะคง project เดิมหรือย้ายพร้อมข้อมูลก่อนเปลี่ยนค่า ใช้เพียง **Project URL** และ **publishable key** ใน frontend ไม่ใช้ service_role, secret key หรือ credentials ของสโตร์พร้อม

1. สร้าง Supabase project แยกชื่อ SITE DAILY TH DEV และตรวจชื่อ/Project ref ให้ถูกต้องก่อนรัน SQL
2. สำหรับติดตั้งใหม่ รันไฟล์ใน `supabase/migrations` ตามลำดับ (`20261023080357_initial_schema.sql` แล้ว `20261023085342_reference_daily_report.sql`) ใน SQL Editor ของโปรเจกต์พัฒนาที่ตรวจแล้ว ทั้งสองไฟล์รันแล้วใน SITE DAILY TH DEV ที่เชื่อมอยู่ ห้ามรันซ้ำที่นั่น
3. ตั้ง Auth Site URL เป็น `http://127.0.0.1:3000` ใช้ Email/Password และ email confirmation ตามนโยบายของบริษัท ปิด anonymous sign-ins และใช้รหัสผ่านอย่างน้อย 8 ตัวอักษร
4. คัดลอก `.env.example` เป็น `.env.local` แล้วใส่สองค่านี้:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-DEV-REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR-DEV-PUBLISHABLE-KEY
```

5. เปิดเซิร์ฟเวอร์ใหม่ ออกจากโหมดทดลอง สมัครบัญชี ยืนยันอีเมลตามตั้งค่า แล้วสร้างบริษัทแรกในแอพ
6. ทดลองด้วยอย่างน้อยสองบัญชีที่อยู่คนละบริษัท ตรวจการอัปโหลดและลบภาพจริง และรัน Supabase Security Advisors ก่อนใช้ข้อมูลจริง

แอพใช้ Supabase browser client สำหรับ Auth และ Data API ไม่มี server endpoint ที่อ่านข้อมูลส่วนตัว จึงไม่ใช้ SSR cookies; ข้อมูลส่วนตัวจะโหลดหลังยืนยันตัวผู้ใช้และถูกบังคับสิทธิ์ด้วย RLS ที่ฐานข้อมูลทุกคำขอ ห้ามใช้การซ่อนเมนูเป็นตัวตรวจสิทธิ์ และห้ามเพิ่ม server-side data fetching โดยใช้ service_role เพื่อเลี่ยง RLS

### สมาชิกและบทบาท

| บทบาท  | อ่านโครงการ/รายงาน/รูป | สร้าง/แก้ไขโครงการและรายงาน | เพิ่ม/ลบรูป |
| ------ | ---------------------- | --------------------------- | ----------- |
| owner  | ได้                    | ได้                         | ได้         |
| editor | ได้                    | ได้                         | ได้         |
| viewer | ได้                    | ไม่ได้                      | ไม่ได้      |

การเชิญสมาชิกยังไม่อยู่ใน MVP ให้ผู้ดูแลฐานข้อมูลที่ได้รับสิทธิ์เพิ่มสมาชิกหลังผู้ใช้นั้นสมัครและยืนยันอีเมลแล้ว ตรวจ UUID ทั้งสองค่าก่อนรันใน DEV SQL Editor:

```sql
insert into public.memberships (workspace_id, user_id, role)
values ('WORKSPACE_UUID', 'AUTH_USER_UUID', 'editor');
```

หน้า **บริษัทและการตั้งค่า → จัดการสมาชิก** ให้ owner ของบริษัทที่เลือกดูรายชื่อและเปลี่ยนสมาชิกระหว่าง editor/viewer ได้ พร้อมยืนยันก่อนบันทึก ส่วน owner เปลี่ยนไม่ได้ในหน้านี้ ไม่มีปุ่มเพิ่มหรือลบสมาชิก ดู [MEMBER-MANAGEMENT.md](MEMBER-MANAGEMENT.md)

ผู้ใช้ฝั่งเว็บไม่มีสิทธิ์เขียนตาราง memberships โดยตรงหรือเปลี่ยนบทบาทตนเอง การจัดการผ่าน RPC ที่ตรวจ owner จาก auth.uid() และบริษัททุกคำขอ ไม่สามารถยกระดับเป็น owner ได้ RPC `create_workspace` สร้างบริษัทใหม่และ owner ของผู้เรียกแบบ transaction เดียว ไม่รับ user_id จากไคลเอนต์

## โครงสร้างข้อมูลและสิทธิ์

```text
auth.users ─ memberships ─ workspaces
                            └ projects
                                └ daily_reports
                                    └ photos
storage bucket: site-photos (private)
object: workspace_uuid/project_uuid/report_uuid/photo_uuid.png
```

- เปิด RLS ทุกตารางใน public, ไม่มีสิทธิ์อ่านของ anon
- ตรวจสมาชิกจาก memberships ผ่าน private helper ที่ pin search_path และผูก auth.uid() ไม่ใช้ user_metadata
- Private SECURITY DEFINER ใช้เฉพาะ lookup สมาชิกเพื่อป้องกัน RLS recursion และ bootstrap บริษัท มีการ revoke PUBLIC/anon ทุกฟังก์ชันและตรวจผู้เรียก
- Composite foreign keys ป้องกันการอ้าง project/report ต่างบริษัท
- Project tenant/id เปลี่ยนไม่ได้ด้วย column grants; report identity/author/created_at เปลี่ยนไม่ได้ด้วย trigger
- Storage SELECT/INSERT/DELETE ตรวจบริษัท โครงการ รายงานที่มีอยู่ และรูปแบบ path; ไม่มี UPDATE/upsert เพื่อป้องกันเปลี่ยนชื่อหรือย้ายไฟล์
- Signed image URLs อายุ 1 ชั่วโมง ต่ออายุเมื่อครบ 55 นาที/กลับแท็บ/ออนไลน์ โดยไม่โหลดฟอร์มใหม่ และขอลิงก์รูปขนาดเต็มใหม่ก่อนฝังลงใน PDF
- เอกสารร่างย้ายถังขยะและ Owner กู้คืนได้ 30 วัน เอกสารที่ส่งแล้วยกเลิกพร้อมเหตุผลและประวัติ ตามสิทธิ์ใน [DOCUMENT-LIFECYCLE.md](DOCUMENT-LIFECYCLE.md) รูปภาพลบได้ การลบไฟล์กับ metadata เป็นคนละคำขอ หากเกิดข้อผิดพลาดระหว่างคำขอให้ตรวจและแก้ก่อนลองซ้ำ รวม orphan objects เมื่อดูแลระบบ

## การทดสอบ

```sh
npm run lint
npm run typecheck
npm run test:rls
npm run test:report-model
npm run build
npm test
```

`npm test` เปิด production server ที่ 127.0.0.1:3100 และใช้ Microsoft Edge ที่ติดตั้งในเครื่อง ผ่าน Playwright หากไม่มี Edge ให้เปลี่ยน `channel` ใน playwright.config.ts และติดตั้ง Chromium ของ Playwright การทดสอบใช้ข้อมูลตัวอย่างเท่านั้น ไม่เชื่อมต่อ production

`test:rls` ใช้ PGlite (PostgreSQL จริงแบบ embedded) สร้าง Auth/Storage schema จำลองเพื่อทดสอบ migration, constraints, grants และ RLS ไม่ใช่การทดสอบ Supabase Auth/Storage HTTP services จริง

ดูผลตรวจและข้อจำกัดใน [TEST-REPORT.md](TEST-REPORT.md)

## ขอบเขตก่อนใช้งานจริง

ยังไม่รวมอีเมลส่งรายงาน, workflow อนุมัติ/ลายเซ็นดิจิทัล, เชิญหรือถอนสมาชิกใน UI, offline sync, realtime หรือระบบชำระเงิน มีหน้ากู้รหัสผ่าน ประวัติเอกสาร ถังขยะ/กู้คืน 30 วัน และยกเลิกพร้อมเหตุผลแล้ว รายงานที่ส่งแล้วยังแก้ไขได้โดย owner/editor โดยตรวจเลขรุ่นที่ฐานข้อมูลและแจ้งเตือนเมื่อมีผู้บันทึกก่อน ไม่เขียนทับฉบับใหม่อัตโนมัติ ดู [DOCUMENT-EDIT-CONCURRENCY.md](DOCUMENT-EDIT-CONCURRENCY.md)

โครงการและเอกสารอ่านแบบแบ่งหน้าครั้งละ 500 แถวแล้วรวมในหน่วยความจำของเบราว์เซอร์ จึงควรเพิ่มตัวกรองและ dashboard aggregate query ที่ server ก่อนมีเอกสารจำนวนมาก ส่วนรูปมีการย่อก่อนอัปโหลด ภาพตัวอย่าง และแกลเลอรีแบ่งหน้าตามโครงการ/ช่วงวันที่แล้ว มีหน้าสรุปพื้นที่และให้ Owner กำหนดโควตาแจ้งเตือนได้

ก่อน deploy ต้องตรวจ project ref, สิทธิ์ผู้ deploy, environment ของ DEV/staging, RLS บนบริการจริง, Auth redirects, email delivery, ข้อจำกัดไฟล์, การสำรองข้อมูล, dependency audit และนโยบายเก็บข้อมูล รูปและ PDF ไม่ควรมีข้อมูลที่ไม่จำเป็นต่อหน้างาน ไม่มีคำสั่ง deploy อัตโนมัติใน repo นี้

## เอกสารอ้างอิง

- [Supabase browser client / Auth](https://supabase.com/docs/reference/javascript/initializing)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- Next.js version-matched docs: `node_modules/next/dist/docs`
- ฟอนต์: [Google Fonts Noto Sans Thai](https://github.com/google/fonts/tree/main/ofl/notosansthai) ใบอนุญาตที่ `public/fonts/OFL.txt`
