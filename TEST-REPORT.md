# ผลตรวจ SITE DAILY TH MVP 1.0

**ล่าสุด 24 ตุลาคม: ส่งออก PDF โดยตรงและรายงานวันหยุดผ่านแล้ว** Build/TypeScript/lint ผ่าน, browser 2/2 ผ่าน รวมกดปุ่มดาวน์โหลด PDF ทั้งมีรูปและไม่มีรูป รายงาน Hampton วันที่ 24 เลขที่ 043 เหลืองานหนึ่งแถว `ไม่ได้ทำงาน` หมายเหตุ `หยุดงาน` PDF A4 1 หน้า ไม่มีหน้ารูปเปล่าหรือหัว–ท้าย Chrome ตรวจภาษาไทย/โลโก้/ติ๊กช่วงเวลา/ขอบหน้าครบ ไม่เปลี่ยน RLS และไม่ deploy ดู DIRECT-PDF-EXPORT.md

**ล่าสุด: ค่าเริ่มต้นและสร้างรายงานวันถัดไป** Build/lint/model และ browser 2/2 ผ่าน รวมคัดลอก/บันทึกแยกจากต้นฉบับ/ล้างข้อมูลรายวัน/รูปไม่ติดมา/ป้องกันรายงานซ้ำ เปิด Hampton 23 ตุลาคมให้ตรวจและกรอกก่อนบันทึก ไม่ deploy ดู NEXT-DAY-REPORT.md

**ล่าสุด: วัสดุคอลัมน์ขวา/ส่วนงานแบบเลือกพร้อมเส้นใต้** Build/lint/model และ browser 2/2 ผ่าน ตรวจ PDF Hampton 2 หน้า วัสดุ 2 รายการ รูป 6 รูปครบ เก็บข้อมูลเดิม ไม่ deploy ดู RIGHT-MATERIALS-DISCIPLINE.md

**ล่าสุด: จัดหน้ากรอกใหม่แล้ว** แถบทางลัด/รายการ/ช่องกรอก/มือถือ/แถบบันทึก Build/lint และ browser 2/2 ผ่าน ตรวจภาพจริงและฟอร์ม 390px ไม่ล้นจอ ไม่เปลี่ยนข้อมูลหรือ print styles ไม่ deploy ดู FORM-DESIGN.md

**Latest: materials table and simplified form complete.** Build/lint/model and browser 2/2 passed; PostgreSQL/RLS 48 assertions; two-real-account DEV material roundtrip and full isolation/storage tests passed; fixtures cleaned. Hampton saved/reloaded and 2-page PDF checked with all six photos. See MATERIALS-REPORT.md. No deployment.

**ล่าสุด: ลดช่องกรอกซ้ำแล้ว** ใช้นาฬิกา ตารางบุคลากร และตารางความก้าวหน้าเป็นข้อมูลหลัก Build/lint/model ผ่าน, browser 2/2, PostgreSQL/RLS 42 assertions, DEV Security Advisors ไม่มี lints บันทึก Hampton และตรวจ PDF 2 หน้า รูป 6 รูป ติ๊กสองช่วงทุกหน้าครบ ยังไม่ deploy ดู SINGLE-SOURCE-REPORT.md

**แก้เกณฑ์แรงงานล่าสุด:** Hampton by Hilton Sukhumvit 11 รวมแรงงานเฉพาะรายวันและผู้รับเหมา 39 คน / 312 คน-ชั่วโมง แยกยอดพนักงานปฏิบัติการ 14/112 ไว้ในตาราง แก้ช่องติ๊กอากาศและหมายเหตุไม่ซ้ำงาน PDF 2 หน้า รูปครบ 6 รูป Build/lint/model/RLS 40 assertions/browser 2 tests ผ่าน ดู WORKFORCE-NOTES-CORRECTION.md

**เพิ่มข้อมูล Hampton Hotel ตามตัวอย่างแล้ว:** พนักงานรายวัน 15 คน / 120 คน-ชั่วโมง, ผู้รับเหมา 24 / 192, รวมพนักงานเดิมเป็น 53 / 424 และเครื่องมือ 7 รายการ บันทึกแบบจำนวนอย่างเดียวเมื่อไม่ระบุชั่วโมง PDF 2 หน้า รูปเดิม 6 รูปครบ Build/lint/browser tests และตรวจแบ่งหน้าผ่าน ดู REFERENCE-QUANTITIES.md

**ปรับแบบเพิ่มนาฬิกาสภาพอากาศและหมวดรายวัน/ผู้รับเหมา/เครื่องมือ:** Build, lint, report-model และ browser tests 2 ชุดผ่าน ตรวจ PDF Hampton Hotel 2 หน้าและรูปเดิม 6 รูปครบ คงยอด 14 คน / 112 คน-ชั่วโมง ไม่คัดลอกจำนวนจากตัวอย่าง ดู WEATHER-CATEGORIES.md

**ผลล่าสุด 16:18 น.: ผ่านการทดสอบสองบัญชีจริงครบทั้งสองทิศทาง** Login, RLS โครงการ/รายงาน/รูปภาพ, ป้องกันเพิ่มตนเองเป็นสมาชิกบริษัทอื่น และ Storage upload/download/overwrite/delete/signed URL ผ่าน เจ้าของใช้งานได้ อีกบริษัทเข้าถึงไม่ได้ ตรวจไฟล์เจ้าของยังอยู่หลังพยายามลบ ล้าง fixtures แล้วไม่มีไฟล์ตกค้าง เก็บรายงานตัวอย่าง 2 ฉบับและ Auth accounts ไว้ Security Advisors ไม่มี lints และ lint ผ่าน ปิด automation แล้ว ไม่ deploy ดู `outputs/two-account-rls-report.md` และ `LIVE-TEST-RESULT.json` สถานะรอยืนยันอีเมลด้านล่างเป็นประวัติก่อนทดสอบสำเร็จ

**สถานะ 16:12 น.:** สมัคร `welovecyclist@gmail.com` สำเร็จและส่งลิงก์ยืนยันแล้ว ตรวจ Auth แบบอ่านอย่างเดียวพบว่ายังรอยืนยันอีเมล หลังยืนยันจึงจะทดสอบ RLS/รูปภาพด้วยสองบัญชีจริง ไม่มีการ deploy หรือข้ามการยืนยันอีเมล

**รูปแบบรายงานตาม PDF อ้างอิง:** Build/typecheck/lint ผ่าน, browser tests 2 ชุดผ่าน, PostgreSQL/RLS เพิ่มเป็น 40 assertions และทดสอบสูตรรวมคน-ชั่วโมงผ่าน PDF ตัวอย่างใหม่ A4 2 หน้า พร้อมหน้ารูป 6 ช่อง ตรวจทุกหน้าแล้ว ทดสอบภาพ 7 รูปและข้อมูลยาวไม่ล้นหน้า รายงานเดิมเปิดได้และข้อมูลยังครบ ดู [REFERENCE-REPORT.md](REFERENCE-REPORT.md)

**ทดสอบรายงาน 1 วันเพิ่มเติม:** บัญชีแรกบันทึกข้อมูลสมมติวันที่ 23 ตุลาคม 2569 ผ่านหน้าเว็บจริงใน DEV ครบทุกหมวด บันทึกร่าง/โหลดใหม่/ส่งรายงาน/แนบรูป/โหลดรูปกลับผ่าน ตรวจ PDF A4 2 หน้าแล้ว ข้อความและรูปครบ ไม่หลุดขอบ เก็บรายงาน ID `6b0a0d40-37fa-4b3f-9e24-39b00f76e777` ไว้ให้ผู้ใช้ตรวจ ห้ามลบเป็น fixture ของงานอัตโนมัติรอบถัดไป ดู `outputs/daily-report-QA.md` และ `outputs/daily-report-th-2026-10-23.pdf`

**อัปเดตล่าสุด:** เปิดการป้องกันรหัสผ่านที่เคยรั่วไหลบนแพ็กเกจ Pro เดิมแล้ว ไม่มีการเปลี่ยนแพ็กเกจหรือซื้อบริการเพิ่ม Security Advisors ตรวจซ้ำได้ `lints: []` การสมัครบัญชีที่สองยังติด email rate limit และการทดสอบสองบัญชีจริงยังไม่ครบ ดู DEV-CONNECTION.md สำหรับหลักฐานและเวลาประเมินที่ควรลองใหม่

**อัปเดตหลังเชื่อม DEV:** Login ด้วยรหัสผ่านและอัปโหลด/ดาวน์โหลด/ลบรูปผ่าน SDK และหน้าเว็บจริงผ่านแล้ว รวมทั้งการปฏิเสธผู้ไม่เข้าสู่ระบบ และล้างข้อมูลทดสอบแล้ว ส่วนการทดสอบข้ามบริษัทด้วย Auth สองบัญชียังติด email rate limit ของบัญชีที่สอง Security Advisors ล่าสุดแจ้งเตือน leaked password protection ปิดอยู่ ดู [DEV-CONNECTION.md](DEV-CONNECTION.md) สำหรับรายละเอียดล่าสุด ข้อมูลส่วนที่ระบุว่ายังไม่เชื่อมบริการจริงด้านล่างเป็นผลตรวจรอบแรก

วันที่ 23 ตุลาคม 2569 (Asia/Bangkok)

## สภาพแวดล้อมและการแยกโปรเจกต์

- โฟลเดอร์งานเดิมว่าง ไม่มีแอพหรือ Git repository ให้ต่อยอด และไม่พบ AGENTS.md ในโฟลเดอร์งาน/โฟลเดอร์แม่ที่ตรวจ
- สร้าง local Git repository ใหม่ที่ `outputs/site-daily-th` ไม่มี remote และไม่ได้สร้าง commit
- Node.js 24.14.0, npm 11.19.1, Next.js 16.4.2, React 19.3.1, TypeScript 6.0.3, Tailwind CSS 4.3.3, Supabase JS 2.118.0
- Dependencies pin เวอร์ชันและมี package-lock.json
- อ่านเอกสาร Next.js ที่มากับเวอร์ชันติดตั้ง และเอกสาร Supabase Auth/Storage ปัจจุบัน
- ไม่มีการอ่าน/ใช้ production credentials, เชื่อมต่อสโตร์พร้อม, สร้าง hosted Supabase project, รัน remote migration, push Git หรือ deploy

## ผลการตรวจ

| รายการ | ผล |
|---|---|
| `npm run build` | ผ่าน: compile, TypeScript และสร้าง production output |
| `npm run typecheck` | ผ่าน |
| `npm run lint` | ผ่าน หลังแก้ unused suppression |
| `npm run test:rls` | ผ่าน 37 assertions บน embedded PostgreSQL |
| `npm test` | ผ่าน 2 end-to-end tests บน Microsoft Edge headless |
| หน้าจอ desktop | ตรวจภาพ 1280px แล้ว |
| หน้าจอมือถือ | ตรวจภาพ 390px แล้ว ไม่มี horizontal overflow ของหน้า; ตารางเลื่อนในกรอบตัวเอง |
| PDF ภาษาไทย | สร้าง A4 2 หน้า ดึงข้อความไทยได้ และ render ทุกหน้าเพื่อตรวจแล้ว |
| `npm audit --omit=dev` | ไม่พบช่องโหว่ใน production dependencies ณ เวลาตรวจ |
| `npm audit` | พบ 5 high ใน dev tooling ตามรายละเอียดด้านล่าง |

## เส้นทางใช้งานที่ทดสอบ

1. เข้าหน้ารายงานโดยยังไม่เข้าสู่ระบบ → กลับหน้า Login
2. เปิดโหมดตัวอย่าง → Dashboard
3. สร้างโครงการใหม่พร้อมสถานที่และลูกค้า
4. เลือกโครงการและสร้างรายงานพร้อมแรงงาน 18 คน งานที่ทำ ปัญหา และแผนวันถัดไป
5. ส่งรายงานแล้วแก้ไขแรงงานเป็น 20 คน ตรวจค่าที่แสดงหลังบันทึก
6. เพิ่มรูป PNG พร้อมคำบรรยาย โหลดหน้าใหม่ และตรวจข้อมูล/รูปยังอยู่
7. สร้าง PDF ภาษาไทย ตรวจ print CSS ซ่อน sidebar และสร้างภาพตรวจหน้ารายงาน
8. เปิดแกลเลอรี กลับเข้ารายงาน และลบรูปโดยยืนยัน
9. เปิด Dashboard ขนาดมือถือ ตรวจไม่ล้นขอบ เปิดเมนู และออกจากระบบ
10. ตรวจไม่พบ JavaScript page errors ระหว่างเส้นทางดังกล่าว

รูปใน PDF ตัวอย่างเป็นภาพประกอบอาคารที่ใช้ทดสอบ ไม่ใช่ภาพโครงการก่อสร้างจริง

## การตรวจ SQL/RLS

นำ migration ไฟล์จริงรันใน PGlite โดยสร้าง Auth/Storage schema ขั้นต่ำสำหรับทดสอบ ตรวจ owner สองบริษัท, viewer และ editor ที่เป็นสมาชิกสองบริษัท

- สร้างบริษัทและ owner ใน transaction เดียว
- สมาชิกเห็นเฉพาะบริษัท/โครงการ/รายงาน/รูปที่มีสิทธิ์
- ปฏิเสธการเพิ่มสมาชิกเองและเปลี่ยน tenant ของโครงการ
- ปฏิเสธการปลอมผู้บันทึกและเปลี่ยน identity ของรายงาน
- Composite foreign key ปฏิเสธรายงาน/รูปที่อ้าง parent ข้ามบริษัท
- รายงานซ้ำในโครงการและวันเดียวกันถูกปฏิเสธ
- Viewer อ่านได้ แต่เขียนรายงาน/โครงการหรืออัปโหลด/ลบรูปไม่ได้
- Storage ปฏิเสธ path ผิดรูปแบบ, report ที่ไม่มีอยู่, บริษัทที่ไม่มีสิทธิ์ และการย้าย/แก้ชื่อ object
- Editor แก้เนื้อหารายงานของเพื่อนร่วมบริษัทได้ แต่เปลี่ยนบริษัท/ผู้บันทึกไม่ได้
- Anonymous อ่านตารางและเรียก bootstrap RPC ไม่ได้

**ขอบเขตของผลทดสอบ:** PGlite ทดสอบ PostgreSQL constraints/grants/RLS จริง แต่ Auth users, JWT identity และ Storage schemas เป็น test stand-ins ยังไม่ได้ทดสอบ Supabase Auth email/password, email confirmation, PostgREST, upload service, signed URL และ MIME/size enforcement บน Supabase จริง ไม่มี Docker ในเครื่องสำหรับเปิด full local stack จึงยังไม่ได้รัน hosted Security Advisors หรือ full-stack integration test ต้องตรวจส่วนนี้บน Supabase DEV แยกก่อนใช้ข้อมูลจริง

## Dependency audit

Audit เต็มพบ high 5 รายการใน chain ของเครื่องมือตรวจโค้ด:

```text
eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces
```

เกี่ยวข้องกับ [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) ซึ่งรายงานความเสี่ยง stack exhaustion เมื่อรับ nested patterns ที่ไม่เหมาะสมจากภายนอก ขณะตรวจไม่มี safe patch ที่ npm เสนอในเวอร์ชันปัจจุบัน; คำแนะนำอัตโนมัติคือ downgrade eslint-config-next ข้าม major ไป 14.x จึงไม่ทำเพื่อหลีกเลี่ยง config ไม่ตรงกับ Next.js 16 ต้องติดตามรุ่นแก้ไขก่อน production/CI ที่รับ pattern จากแหล่งไม่เชื่อถือ ไม่พบรายการนี้ใน production dependency audit

## ไฟล์ส่งมอบ

- Source และ SQL migration: โฟลเดอร์ `site-daily-th`
- Source archive ไม่รวม node_modules, build output, .git หรือ secrets: `site-daily-th-mvp-1.0.zip`
- ภาพหน้าจอ: `dashboard-desktop.png`, `dashboard-mobile.png`
- PDF ตัวอย่าง: `sample-daily-report-th.pdf`

การพัฒนาและการตรวจในเครื่องเสร็จแล้ว การเชื่อมต่อบริการจริงและการ deploy ยังไม่ได้ดำเนินการ ใช้ README เป็นขั้นตอนเชื่อมต่อโปรเจกต์พัฒนาและตรวจความพร้อมต่อไป
