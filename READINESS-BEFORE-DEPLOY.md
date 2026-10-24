# SiteEN DAILY ตรวจความพร้อมก่อนใช้งานจริง

วันที่ตรวจ 24 ตุลาคม 2026

**ตรวจซ้ำหลังแก้สองจุดล่าสุด (18:10–18:14 น.):** SHA-256 ของ 15 ไฟล์ตรงกับรุ่นที่ผ่าน 64/64, ตรวจสด migrations/Advisors/audit/Auth แล้ว งานค้างหลักคือ production URLs/Google privacy/SMTP/backup/Git/release image และตรวจรับบน Hostinger VPS จริง ดู [HOSTINGER-PREDEPLOY-REVIEW.md](D:/Sandbox27/SiteEN/HOSTINGER-PREDEPLOY-REVIEW.md) ยังไม่ deploy

**ผลตรวจความพร้อม Hostinger รอบล่าสุด:** อ่านโค้ดและตรวจ DEV/Advisors/audit/Git ใหม่แล้ว ยังไม่ deploy สรุปงานที่ต้องเตรียมและแยกผลที่ผ่านกับสิ่งที่ยังไม่ยืนยันไว้ใน [HOSTINGER-PREDEPLOY-REVIEW.md](D:/Sandbox27/SiteEN/HOSTINGER-PREDEPLOY-REVIEW.md) ข้อความด้านล่างเก็บประวัติผลตรวจที่ผ่านมา

**อัปเดตล่าสุด: Linux Docker/PDF ผ่านแล้ว แต่ยังไม่ deploy** ติดตั้ง Docker Desktop/WSL แล้ว ตรวจ Linux build/TypeScript/lint, PDF ภาษาไทยพร้อมรูปสองหน้า ลายน้ำ metadata และภาพที่เรนเดอร์ผ่าน ยืนยัน namespace/ Seccomp-BPF sandbox ของ Chromium จริง รวม HTTP/API และ config guards ผ่าน สองงานพร้อมกันสร้าง 4 PDF ได้ใน 12 วินาที ใช้ RAM ประมาณ 682 MiB และ PID 268 ภายใต้ 2 GiB/2 CPU/512 PID โดยไม่ชนเพดาน ทดสอบด้วยข้อมูลสมมติบน Docker Desktop/WSL ยังต้องรันบน Hostinger VPS เป้าหมายและ load test ด้วยรูป/ทีมจริงก่อนเปิดใช้ ดู [ผลทดสอบ Linux](D:/Sandbox27/SiteEN/DOCKER-LINUX-VERIFICATION.md) และ [คู่มือ VPS](D:/Sandbox27/SiteEN/HOSTINGER-VPS.md) รายการตรวจเดิมด้านล่างยังคงเป็นประวัติการตรวจ

**อัปเดต 14:30 น.: Google Login ตั้งค่าบริการจริงใน DEV สำเร็จแล้ว** สร้างโปรเจกต์ `siteen-daily` และ OAuth client ตามที่ผู้ใช้เลือก/ยืนยัน เปิด Google provider ใน Supabase และ exact redirect URLs แล้ว ทดสอบ Chrome จริงทั้ง siamkosi@gmail.com (owner) และ welovecyclist@gmail.com (editor) กลับมาบริษัท 27 วิศวกรรมด้วย User ID เดิม ทั้งคู่มี email+google identities ไม่สร้างบัญชีซ้ำ Google app ยังเป็น Testing เฉพาะสองอีเมลนี้ ยังไม่ deploy และยังต้องเตรียมโดเมน/Audience/SMTP สำหรับ production ตามรายการเดิม ดู [GOOGLE-LOGIN-PROVISIONED.md](D:/Sandbox27/SiteEN/GOOGLE-LOGIN-PROVISIONED.md) ข้อความเวลา 14:00 น. ด้านล่างเป็นสถานะก่อนตั้งค่า

อัปเดตหลังตรวจซ้ำเวลา 14:00 น.: เพิ่มปุ่ม Google Login และ `/auth/callback` ใน DEV แล้ว ตรวจ callback/การยกเลิก/โทเคนผิด/สิทธิ์สมาชิกด้วย fixtures ผ่าน 8 รายการ และ regression ล่าสุดผ่าน 54/54 รายการ รวม build/TypeScript/lint ผ่าน การตั้ง Google provider จริงยังรอผู้ใช้ใส่ OAuth Client ID/Secret ผ่าน Google Cloud/Supabase; ตรวจล่าสุด provider ยังปิดอยู่ การเปิด provider และทดสอบ Google consent/UUID ด้วยบัญชีจริงยังไม่ผ่านการตรวจรับ ดู [GOOGLE-LOGIN.md](D:/Sandbox27/SiteEN/GOOGLE-LOGIN.md) โฮสต์ที่เสนอสำหรับโค้ดปัจจุบันคือ Hostinger VPS + Supabase หากมีผู้ดูแล VPS ยังไม่มีการเลือกซื้อหรือ deploy ดู [HOSTING-OPTIONS.md](D:/Sandbox27/SiteEN/HOSTING-OPTIONS.md)

ตรวจซ้ำ 24 ตุลาคม 2026 เวลา 13:45 น. (ประเทศไทย): อ่านโค้ดและการตั้งค่าปัจจุบัน ตรวจสถานะผลทดสอบล่าสุด Git, npm audit และ Supabase Advisors/สถานะโครงการ/ประวัติ migration โดยไม่แก้โค้ดแอป ข้อมูลผู้ใช้ การตั้งค่า hosted Auth หรือ deploy ชุดทดสอบเต็มล่าสุดจบเวลา 13:42 น. ผ่าน 46/46 รายการ; รอบตรวจซ้ำนี้ไม่ได้รันชุดเดิมซ้ำ ผล RLS ล่าสุดคือ 295 จุด

## ลำดับงานที่ยังเหลือ

| ลำดับ | ต้องเตรียม | เกณฑ์ให้ผ่าน |
|---|---|---|
| 1 | โฮสต์และบริการ PDF | Linux Docker baseline ผ่านแล้ว รวม sandbox และสองงานสมมติพร้อมกัน ยังต้องทดสอบบน Hostinger VPS เป้าหมายด้วยรูป/ขนาด payload/ผู้ใช้จริง รวม timeout และ memory |
| 2 | Production environment และข้อมูล | กำหนดฐานข้อมูลปลายทางและแผนคง/ย้ายข้อมูลจริง บัญชี สมาชิก และไฟล์ ตรวจ 15 migrations, RLS และ Storage ตั้ง URL/publishable key ตอน build และ APP_ORIGIN/HTTPS/redirects ให้ตรงโดเมนจริง หาก UUID เปลี่ยนต้องปรับค่าเริ่มต้นบริษัท |
| 3 | อีเมลยืนยัน/กู้รหัสผ่าน | ยืนยัน custom SMTP/ผู้ส่งและ Auth URL ของ hosted project แล้วทดสอบส่งถึงสมาชิกจริงจากอีกอุปกรณ์ ค่าจาก local config ไม่ใช่หลักฐานว่า hosted project ตั้งแล้ว |
| 4 | สำรองและกู้คืน | มีสำรองฐานข้อมูลและเนื้อไฟล์ Storage แยกกัน ระบุรอบสำรอง ผู้รับผิดชอบ และทดลอง restore ในที่แยก ก่อนย้าย/เปิดข้อมูลจริง |
| 5 | เก็บรุ่นและย้อนกลับ | สร้าง Git baseline และ private remote พร้อมขั้นตอน rollback ปัจจุบันไฟล์ tracked/commit/remote ยังเป็นศูนย์ คัดภาพ/PDF/ข้อมูลจริงใน output ออกจาก release ก่อน commit |
| 6 | ทดสอบรับระบบและดูแลทีม | ทดสอบ owner/editor/viewer และสองวิศวกรพร้อมกันบนปลายทาง ด้วยมือถือจริง รวมรูปกล้อง/เปิดค้างเกินหนึ่งชั่วโมง กำหนดวิธีเพิ่ม-ถอนสมาชิก logs/แจ้งเว็บล่ม ผู้รับแจ้ง และที่เก็บ PDF ลงนาม |

**สองจุดแก้แล้วในเครื่อง:** ลิงก์รูปอายุ 1 ชั่วโมงต่ออายุเมื่อครบ 55 นาที/กลับแท็บ/ออนไลน์ โดยไม่โหลดฟอร์มใหม่ และขอลิงก์รูปขนาดเต็มใหม่ก่อนส่งออก PDF; `tests/live-integration.mjs` ส่ง expected_version จาก snapshot แล้ว พร้อมตรวจรุ่นเก่าและ constraint วัสดุอย่างเจาะจง ทดสอบ SDK contract ในเครื่อง รอบนี้ยังไม่ได้รันสคริปต์ที่สร้างข้อมูลบน DEV และยังไม่ deploy ดู [PHOTO-OPTIMIZATION.md](D:/Sandbox27/SiteEN/PHOTO-OPTIMIZATION.md) และ [DOCUMENT-EDIT-CONCURRENCY.md](D:/Sandbox27/SiteEN/DOCUMENT-EDIT-CONCURRENCY.md)

**งานที่ Owner กำหนดภายหลังได้:** งบพื้นที่รูป/โควตา (เตือน 80%/95%/100% เมื่อกำหนดแล้ว) ส่วนรูปแบบเลขเอกสาร Revision และแนวปฏิบัติส่ง/เก็บ PDF ลงนามควรตกลงก่อนให้ทีมเริ่มใช้งานจริง

ผลสดรอบนี้: Supabase DEV ACTIVE_HEALTHY; migration ในเครื่อง/DEV ตรงกัน 15 รายการ รวม document_edit_concurrency; npm audit ทั้งหมดและเฉพาะ production พบช่องโหว่ 0; Security Advisor ไม่มีรายการแจ้งเตือน; Performance Advisor มี INFO foreign keys ไม่มี covering index 9 จุด และ Auth connection strategy 1 จุด ต้องประเมินตามโหลดจริง ไม่ใช่ผลพบช่องโหว่ความปลอดภัย

ยังไม่ได้ยืนยัน SMTP, backup plan, โฮสต์/โดเมน production หรือผล UAT บนอุปกรณ์จริง ข้อมูล Hampton/สมาชิกในตารางด้านล่างเป็นหลักฐานอ่านจากรอบก่อน ไม่ได้อ่านข้อมูลบริษัทซ้ำในรอบนี้

**ผลประเมิน: ฟังก์ชันหลักผ่านการทดสอบใน DEV แต่ยังไม่พร้อมเปิด production ให้ทีมใช้งานจริง** ลิงก์กู้รหัสผ่าน การตรวจผู้ใช้/สิทธิ์/เพดาน API PDF และการป้องกันแก้เอกสารทับกันแก้แล้วใน DEV ยังเหลือ runtime ของ PDF บนโฮสต์จริง การสำรองข้อมูล และขั้นตอนดูแลระบบก่อนเปิดใช้

อัปเดตรอบล่าสุด 24 ตุลาคม 2026 หลังเพิ่มถังขยะ/ยกเลิกเอกสาร/ประวัติ การย่อรูปและภาพตัวอย่าง แกลเลอรีแบ่งหน้า สรุปพื้นที่จัดเก็บ และป้องกันบันทึกเอกสารทับกัน: ชุดทดสอบล่าสุดผ่าน 46/46 รายการ และ PostgreSQL/RLS ผ่าน 295 จุด ยังไม่มี deployment ไปยัง URL ปลายทาง รอบตรวจ readiness นี้อ่านโค้ด/สถานะทดสอบ/Git ตรวจ dependencies และ Security Advisors ใหม่ โดยไม่แก้ข้อมูลโครงการที่ผู้ใช้เพิ่งสร้าง ไม่เปลี่ยน Auth หรือโควตา และไม่ deploy

รอบตรวจเดิมเป็นการอ่านอย่างเดียว ต่อมาแก้โค้ดตามคำขอและเพิ่มตาราง private สำหรับโควตา PDF ใน DEV ทดสอบส่งออกด้วยบัญชี editor จริง ไม่แก้รายงาน Hampton ไม่เปลี่ยนบทบาท ไม่ส่งอีเมล ไม่สร้างบัญชี และไม่ deploy

## ผลที่ผ่านการตรวจ

| รายการ | ผลตรวจ |
|---|---|
| Build และ TypeScript | ผ่าน `npm run build` |
| ESLint ทั้งโปรเจกต์ | ผ่าน `npm run lint` |
| กฎข้อมูลรายงาน | ผ่าน `npm run test:report-model` |
| ฐานข้อมูลและสิทธิ์ | ผ่าน 295 ข้อใน PostgreSQL จำลอง รวม RLS, Storage, ถังขยะ/ยกเลิกเอกสาร, ภาพตัวอย่าง, โควตารูป, ตรวจเลขรุ่นเอกสาร และโควตา/สิทธิ์ใช้คิว PDF |
| Browser และ API regression | ผ่าน 54/54 รายการ รวมฟังก์ชันเดิม รูปย่อ/ตัวกรอง/แบ่งหน้า การยกเลิก/กู้คืน พื้นที่/โควตาของบริษัท สองวิศวกรบันทึกฉบับเดียวกัน และ Google Login/callback จำลอง |
| Dependencies | `npm audit` และ `npm audit --omit=dev` รายงานช่องโหว่ 0 รายการ ณ วันที่ตรวจ |
| Supabase DEV | ตารางแอปใช้ RLS; ตารางโควตาปิดการเข้าตรง; Storage ทั้ง 2 bucket เป็น private; RPC ใน public ไม่ให้ anon เรียก |
| Security Advisor | ไม่พบรายการแจ้งเตือนจากตัวตรวจอัตโนมัติ |
| ข้อมูล Hampton | มี Daily Report 3 ฉบับ Daily Request 1 ฉบับ และรูปหน้างาน 6 รูป; object รูปครบ ไม่มี metadata ชี้ไปไฟล์ที่หาย และมีไฟล์รูปโครงการ |
| บัญชีที่ตรวจยืนยัน | siamkosi@gmail.com เป็น owner; welovecyclist@gmail.com เป็น editor ของบริษัท 27 วิศวกรรม |
| หน้าจริง | editor เปิดรายงาน Hampton ได้ และรูปหน้างานทั้ง 6 รูปโหลดสำเร็จ |

ผลทดสอบอัตโนมัติส่วนใหญ่ใช้ demo หรือ API fixtures; ชุด RLS ใช้ PostgreSQL จำลอง ส่วนการอ่านรายงานและรูป Hampton ตรวจบน DEV จริง ผลเหล่านี้ยังไม่ครอบคลุมการเขียนบน production อีเมล production โหลดผู้ใช้พร้อมกัน หรือเครื่องมือถือจริง

## สิ่งที่ต้องแก้ก่อนเปิดออนไลน์

### ลิงก์กู้รหัสผ่านแก้แล้วใน DEV

[`password-recovery.tsx`](D:/Sandbox27/SiteEN/src/components/password-recovery.tsx) ใช้ origin ของหน้าเว็บปัจจุบันและเส้นทาง `/update-password` คงที่แล้ว ทดสอบได้ทั้งพอร์ต local และโดเมน HTTPS โดยไม่รับปลายทางจาก query string

ก่อน deploy ยังต้องตั้ง Site URL และ Redirect URLs ของ Supabase ให้ตรงโดเมนจริง แล้วทดสอบรับอีเมลจากอุปกรณ์อีกเครื่อง รอบนี้ทดสอบคำขอด้วย fixtures ไม่ได้ส่งอีเมลจริง

### API สร้าง PDF เพิ่มความปลอดภัยแล้วใน DEV

[`route.ts`](D:/Sandbox27/SiteEN/src/app/api/reports/pdf/route.ts) ตรวจ token กับ Supabase Auth ที่ server แล้วใช้ JWT เดียวกันตรวจสิทธิ์อ่าน ID เอกสารและบริษัทผ่าน RLS ผู้ไม่ล็อกอินหรือ token ไม่ถูกต้องได้ 401 และเอกสารที่ไม่มีสิทธิ์ได้ 403 โดยยังไม่เปิด renderer

กำหนด `APP_ORIGIN` ที่ server และเปรียบเทียบ Origin แบบตรงกัน ไม่เชื่อ forwarded host; local ตั้ง `http://127.0.0.1:3000` แล้ว ส่วน production ต้องตั้งโดเมน HTTPS จริง หากไม่ตั้งจะปฏิเสธคำขอ

ใช้โควตาฐานข้อมูลร่วมทุก instance: 6 งานต่อ 60 วินาทีต่อผู้ใช้, ผู้ใช้ละ 1 งานพร้อมกัน, ทั้งระบบ 2 งานพร้อมกัน; เกินเพดานได้ 429 พร้อม Retry-After งานค้างหมดอายุ 90 วินาทีและคืนคิวเมื่อจบหรือผิดพลาด ตารางไม่เปิดให้ client อ่าน/แก้โดยตรง ไม่มีการขยายสิทธิ์รายงานหรือใช้ service-role key

ผู้ไม่ล็อกอินที่เคยได้ PDF จาก probe เดิม ปัจจุบันได้ 401 แล้ว บัญชี welovecyclist@gmail.com ส่งออก Hampton ผ่านเส้นทางจริงได้ และคืนคิวสำเร็จ ทดสอบ owner/editor/viewer ด้วย Auth/RLS fixtures และฐานข้อมูลจำลองเพิ่มเติม รายละเอียด: [PDF-API-SECURITY.md](D:/Sandbox27/SiteEN/PDF-API-SECURITY.md)

หลักฐาน: [pdf-api-probes.json](D:/Sandbox27/SiteEN/output/readiness/pdf-api-probes.json)

### บริการ PDF ผ่าน Linux Docker แล้ว รอตรวจ VPS เป้าหมาย

[`pdf-renderer.ts`](D:/Sandbox27/SiteEN/src/lib/server/pdf-renderer.ts) เลือก Chromium บน Linux และคง Edge บน Windows แล้ว Docker ติดตั้ง binary ตรง lockfile พร้อม dependencies/ฟอนต์ไทย บังคับ sandbox บน Linux production ผ่าน Linux verification บน Docker Desktop/WSL แล้ว รวม sandbox และสองงานสมมติพร้อมกัน ยังต้องตรวจ kernel/sandbox และทรัพยากรบน Hostinger VPS จริงก่อนเปิดทีม [Playwright ระบุว่า browser binaries ต้องตรงกับเวอร์ชันที่ใช้](https://playwright.dev/docs/browsers)

ข้อมูล PDF ถูกส่งเป็น JSON พร้อมรูป base64 และถูกจำกัดที่ 32 MiB ในแอป เพิ่มระบบย่อรูปใหม่ด้านยาวสูงสุด 2,560 px และภาพตัวอย่าง 640 px แล้ว โดย PDF ใช้ภาพสำหรับพิมพ์ ไม่ใช้ภาพตัวอย่าง รูปเดิมยังไม่ถูกย่อย้อนหลัง จึงยังต้องตรวจจำนวนรูปต่อรายงาน ขนาด request/response, timeout และ memory ของโฮสต์จริง ไม่ถือว่าการย่อรูปทำให้ PDF ทุกขนาดใช้กับทุกโฮสต์ได้

เกณฑ์ตรวจรับ: สร้าง PDF ภาษาไทยทั้งแบบมีรูป ไม่มีรูป หลายหน้า และขนาดใกล้เพดานได้บน runtime ที่จะใช้จริง โดยไม่ต้องอาศัย Edge บนเครื่องนี้

### ป้องกันผู้แก้ไขพร้อมกันบันทึกทับกันแล้วใน DEV

ฟังก์ชัน saveReport/saveRequest ใน [`site-app.tsx`](D:/Sandbox27/SiteEN/src/components/site-app.tsx) ส่งเลขรุ่นที่เก็บพร้อมข้อมูลตอนเปิดฟอร์ม ตรวจ ID บริษัท และ row_version แบบ atomic ฐานข้อมูลเพิ่มเลขรุ่นด้วย trigger และปฏิเสธการแก้เนื้อหาของผู้ใช้ที่ไม่ส่ง expected_version หรือใช้รุ่นเก่า แม้เรียก API ตรง

เมื่อเกิดการบันทึกชนกันจะแจ้งเตือนภาษาไทย เก็บฟอร์มที่กรอกไว้ และให้เปิดฉบับล่าสุดในแท็บใหม่เพื่อตรวจสอบ/คัดลอกข้อมูล ไม่มีการเขียนทับอัตโนมัติ PostgreSQL/RLS ผ่าน 295 จุด และกรณี browser ใหม่ผ่าน 6 รายการ ครบทั้ง Daily Request และ Daily Report รายละเอียด: [DOCUMENT-EDIT-CONCURRENCY.md](D:/Sandbox27/SiteEN/DOCUMENT-EDIT-CONCURRENCY.md)

เอกสารสถานะ submitted ยังแก้ได้ โดยมีประวัติก่อน/หลัง ผู้ดำเนินการ และเวลา รวมถึง Owner ยกเลิกพร้อมเหตุผลแล้วล็อกข้อมูล/รูปแนบได้ และการแก้เนื้อหาตรวจเลขรุ่นแล้ว ระบบยังไม่จัดเก็บ PDF ฉบับส่ง/ฉบับลงนามภายนอกให้อัตโนมัติ จึงยังต้องตกลง Revision และสถานที่เก็บเอกสารลงนาม

หลักฐานเดิมก่อนแก้ไข: [integrity-probes.json](D:/Sandbox27/SiteEN/output/readiness/integrity-probes.json) ไม่ใช่ผลของรุ่นปัจจุบัน

## สิ่งที่ต้องเตรียมด้านระบบและการดูแล

| เรื่อง | สิ่งที่ต้องเตรียมก่อนเปิดทีม |
|---|---|
| โฮสต์และโดเมน | ยืนยันโฮสต์ โดเมน HTTPS งบรายเดือน จำนวนผู้ใช้พร้อมกัน และ runtime ของ PDF; รอบนี้ยังไม่ได้ตรวจโฮสต์ production |
| แยก DEV กับ production | เลือกฐานข้อมูลปลายทาง จัดแผน migration และย้ายบัญชี สมาชิก รายงานและไฟล์โดยคงความสัมพันธ์; UUID บัญชีและบริษัทเริ่มต้นในโค้ดต้องตรงปลายทาง |
| ตัวแปร environment | กำหนด URL และ publishable key ของปลายทาง พร้อม APP_ORIGIN เป็นโดเมน HTTPS จริง; ไม่ใส่ service role/secret key ในตัวแปร NEXT_PUBLIC |
| อีเมล | ยืนยัน custom SMTP ผู้ส่งและโดเมน ทดสอบสมัคร ยืนยันอีเมล และกู้รหัสผ่านกับที่อยู่อีเมลของสมาชิกทีมจริง; local config ไม่ยืนยันการตั้งค่าบน hosted project |
| สำรองและกู้คืน | กำหนดรอบสำรอง ระยะเก็บ ผู้รับผิดชอบ และทดลองกู้คืนทั้งฐานข้อมูลและไฟล์ Storage ในสภาพแวดล้อมแยก |
| เก็บ source code | Git ปัจจุบันไม่มี commit ไม่มี remote และไม่มีไฟล์ tracked; ต้องมี baseline และ private remote พร้อมขั้นตอนย้อนรุ่น |
| ไฟล์ที่ไม่ควรเข้ารุ่นเผยแพร่ | `.env.local` ถูก ignore แล้ว แต่ `output/` ยังไม่ถูก ignore; แยกภาพหน้าจอ PDF และหลักฐานที่มีข้อมูลจริงออกก่อน commit หรือสร้าง release |
| สมาชิก | มีหน้าเปลี่ยนบทบาท editor/viewer แต่ยังไม่มี invitation เพิ่มสมาชิกหรือถอนสมาชิกใน UI; ต้องมีผู้รับผิดชอบและขั้นตอนเพิ่ม/ถอนสิทธิ์ก่อนรับทีม |
| การติดตามปัญหา | ตั้ง error logs, uptime alert และผู้รับแจ้ง; PDF บันทึกรหัสขั้นตอนที่ล้มเหลวแล้วโดยไม่บันทึก token หรือเนื้อหารายงาน |

Supabase แนะนำ custom SMTP สำหรับการใช้งานจริง บริการอีเมลเริ่มต้นมีข้อจำกัดและไม่เหมาะกับ production; รอบนี้ยังไม่ได้ยืนยันค่า SMTP ของ hosted environment [เอกสาร SMTP](https://supabase.com/docs/guides/auth/auth-smtp)

**Database backup ไม่รวมเนื้อไฟล์ที่เก็บผ่าน Storage API** จึงต้องมีแผนสำรองรูปหน้างานและรูปโครงการแยกด้วย และต้องทดลองกู้คืนก่อนให้ทีมพึ่งพาระบบ [เอกสาร Backup](https://supabase.com/docs/guides/platform/backups)

## จุดที่ต้องยืนยันกับทีมวิศวกร

- **Hampton ถูกตั้งสถานะ completed อยู่** จึงไม่ขึ้นเช็กลิสต์ประจำวันที่กรองเฉพาะ active ตาม [`daily-requests.tsx:37`](D:/Sandbox27/SiteEN/src/components/daily-requests.tsx:37) หากยังทำงานอยู่ ให้ owner ยืนยันแล้วเปิดดำเนินการอีกครั้ง รอบนี้ไม่ได้เปลี่ยนสถานะ
- ตกลงผู้จัดทำ ผู้ตรวจ วันและเวลาส่ง Daily Request / Daily Report และสถานที่จัดเก็บ PDF ลงนามภายนอก สถานะ submitted ไม่ใช่การอนุมัติและไม่ส่งอีเมลเอกสารอัตโนมัติ
- กำหนดรูปแบบเลขเอกสารและ Revision; การตั้งต้น Request จาก Report ยังอาศัยเลขเดิมที่แปลง DRP เป็น DRQ ไม่ใช่ตัวออกเลขต่อเนื่องอิสระ
- ปัจจุบันระบบต้องใช้อินเทอร์เน็ต ยังไม่มี offline mode หรือ autosave สำหรับฟอร์มที่ยังไม่บันทึก
- ต้องทดสอบ iPhone/Safari และ Android/Chrome จริง รวมรูปจากกล้องและชนิดไฟล์ที่ทีมใช้ ปัจจุบันทดสอบอัตโนมัติด้วย Edge และจำลองขนาดหน้าจอมือถือ

## งานเพิ่มเติมก่อนขยายจำนวนผู้ใช้

- หน้าโควตารูปพร้อมแล้ว แต่ผู้ใช้เลือกให้ Owner กำหนดโควตาภายหลัง จึงยังไม่เปิดการเตือนตามเปอร์เซ็นต์ในบริษัท 27 วิศวกรรม โควตานี้เป็นงบแจ้งเตือนในแอป ไม่ใช่การเพิ่มแพ็กเกจหรือเพดานบล็อกการอัปโหลดของ provider

- ลิงก์รูปยังอายุ 1 ชั่วโมง แต่ต่ออายุอัตโนมัติเมื่อครบ 55 นาทีแล้ว และ PDF ขอลิงก์ใหม่ก่อนฝังภาพ ต้องตรวจรับการเปิดค้างระหว่างวันบนเครือข่าย/อุปกรณ์จริงของทีมด้วย
- Daily Request ตรวจเวลาเริ่ม–เสร็จใน client แต่ฐานข้อมูลยังยอมรับรายการแผนงานที่ไม่มีเวลาได้ ต้องเพิ่มกฎที่ database/API หากต้องการบังคับคุณภาพข้อมูลทุกช่องทาง; ยืนยันด้วย probe ใน PostgreSQL จำลอง
- Performance Advisor รอบตรวจซ้ำแจ้ง INFO foreign key ไม่มี covering index 9 จุด ([คำแนะนำ](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)) และ Auth connection strategy 1 จุด ([คำแนะนำ](https://supabase.com/docs/guides/deployment/going-into-prod)); Security Advisor ไม่พบรายการแจ้งเตือน ยังต้องตรวจ performance/load บนปลายทางตามขนาดทีมจริง

## เกณฑ์ก่อนอนุญาตให้ทีมใช้งานจริง

- [x] แก้ callback กู้รหัสผ่านให้ตาม origin ปัจจุบัน; ยังต้องตรวจ allowlist และรับอีเมลบนโดเมนจริง
- [x] ปิดการสร้าง PDF สำหรับผู้ไม่เข้าสู่ระบบ ตรวจสิทธิ์เอกสาร และเพิ่ม quota/concurrency ร่วมทุก instance
- [ ] ทดสอบ PDF บน runtime ปลายทาง รวมรูปขนาดใหญ่และหลายผู้ใช้
- [x] ป้องกันบันทึกเอกสารทับกันใน Daily Request และ Daily Report
- [ ] ตกลงการเก็บฉบับส่งแล้ว/ลงนามและเลข Revision
- [ ] มี Git baseline, private backup ของ source และขั้นตอน rollback
- [ ] มี backup ฐานข้อมูลและ Storage พร้อมผลทดลองกู้คืน
- [ ] ยืนยัน production environment, HTTPS, SMTP และขั้นตอนเพิ่ม/ถอนสมาชิก
- [ ] ยืนยันสถานะ Hampton และผู้รับผิดชอบเอกสารแต่ละวัน
- [ ] ทดสอบด้วยบัญชี owner/editor/viewer ที่แยกกัน และอุปกรณ์จริงบน URL ปลายทางก่อนประกาศเปิดทีม

การทดสอบ URL ปลายทางและการ deploy เป็นขั้นตอนรอบถัดไปที่ยังไม่ได้ดำเนินการ รายงานนี้ไม่ใช่การอนุมัติ deploy

## หลักฐานประกอบ

- [npm audit ทุก dependency](D:/Sandbox27/SiteEN/output/readiness/npm-audit-all.json)
- [npm audit เฉพาะ production dependency](D:/Sandbox27/SiteEN/output/readiness/npm-audit.json)
- [Supabase Advisors](D:/Sandbox27/SiteEN/output/readiness/supabase-advisors.json)
- [ผลตรวจ PDF API](D:/Sandbox27/SiteEN/output/readiness/pdf-api-probes.json)
- [ผลตรวจการแก้ข้อมูลทับกันและเวลา Request](D:/Sandbox27/SiteEN/output/readiness/integrity-probes.json)
- [หน้ารายงานที่เปิดด้วยบัญชี editor จริง](D:/Sandbox27/SiteEN/output/readiness/live-editor-report.png)
