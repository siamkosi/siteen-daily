# SiteEN DAILY — ตรวจความพร้อมก่อน Hostinger VPS

24 ตุลาคม 2026 — ตรวจซ้ำหลังแก้การต่ออายุรูปและสคริปต์เลขรุ่น (หลักฐานสด 18:10–18:14 น. Asia/Bangkok) **ยังไม่ deploy**

**ผลประเมิน: พร้อมเตรียมและนำไปตรวจรับบน VPS แต่ยังไม่พร้อมเปิด production ให้ทีมทันที** งาน Linux PDF ในเครื่องผ่านแล้ว ยังต้องเตรียมปลายทาง อีเมล สำรองข้อมูล และการเก็บรุ่น/ย้อนกลับ

**สองจุดค้างล่าสุดปิดแล้ว:** ต่ออายุลิงก์รูปและส่งเลขรุ่นในสคริปต์บริการจริง ตรวจ SHA-256 ทั้ง 15 ไฟล์ตามหลักฐานรอบแก้แล้วตรงกันทั้งหมด และ Build ID ปัจจุบันตรงกับรุ่นทดสอบ ผลแพลตฟอร์ม/Advisors/audit ในตารางด้านล่างตรวจสดรอบนี้ ไม่อ่านข้อมูลบริษัทหรือรายงานซ้ำ

หลักฐานรอบแก้ล่าสุดเวลา 16:45 น.: browser regression **64/64 ผ่าน** รวม 6 กรณีใหม่ (จำลองเวลาและข้อมูล), SDK contract **3/3 ผ่าน**, PostgreSQL/RLS **295 assertions ผ่าน**, build/TypeScript/lint/format/report-model ผ่าน รอบตรวจความพร้อมนี้ใช้หลักฐานที่ตรงกับโค้ดปัจจุบัน ไม่รันชุดเดิมทั้งหมดซ้ำ ดู `output/readiness/signed-image-verification.json`

## ขอบเขตและผลสด

รอบนี้อ่านโค้ด/ไฟล์ตั้งค่า ตรวจ Git, dependency audit, public Auth settings, metadata โครงการ Supabase, migrations และ Advisors ตอนเริ่มตรวจ localhost ไม่ได้รัน จึงเปิด production build เดิมในเครื่องแล้วตรวจ HTTP guards อีกครั้ง อัปเดตเฉพาะเอกสาร/หลักฐาน ไม่แก้โค้ดแอป ฐานข้อมูล หรือการตั้งค่า hosted ไม่อ่านรายงาน/สมาชิก ไม่ส่งอีเมล ไม่ใช้ SSH/DNS และไม่ deploy

| รายการ | ผล / หลักฐาน |
|---|---|
| Supabase DEV | `hvcwskmqwvrjsrysllly`, ACTIVE_HEALTHY, PostgreSQL 17.11 |
| Migrations | ชื่อและเลขรุ่นในเครื่องตรงกับ DEV ทั้ง 15 รายการ รวมการป้องกันแก้เอกสารทับกัน ไม่ใช่การเทียบ checksum ทุกคำสั่ง SQL |
| Security Advisor | ไม่พบรายการแจ้งเตือน ไม่ใช่การรับรองว่าปลอดช่องโหว่ทุกประเภท |
| Performance Advisor | INFO: foreign key ไม่มี covering index 9 จุด และ Auth connection strategy 1 จุด |
| npm audit | ทั้งหมดและ production-only พบช่องโหว่ 0 รายการในรอบนี้ |
| Public Auth settings | Google/email เปิด, email confirmation เปิด, anonymous ปิด, signup เปิด การสมัครไม่ได้เท่ากับได้สิทธิ์เข้าบริษัทเดิม |
| Git | tracked files 0, commits 0, remote 0 |
| Production config ใน repo | ยังไม่มี `deploy/.env.vps`; มี template เท่านั้น ไม่ใช่หลักฐานว่า VPS/โดเมนภายนอกยังไม่ได้ซื้อ |
| Local app | health/login ตอบ 200 หลังเปิด build เดิม; API PDF ไม่มี login ตอบ 401, Origin ต่างเว็บ/ไม่มี Origin ตอบ 403 โดยไม่เรียกสร้าง PDF หรือส่งอีเมล |
| Linux PDF | อ้างอิงชุดที่เพิ่งผ่านเวลา 16:01 น.: build/TypeScript/lint, ไทย/รูป/ลายน้ำ/สองหน้า, namespace+Seccomp-BPF sandbox, HTTP/API และ configuration guards |
| งาน PDF คู่ | 4 PDF ใน 12 วินาที, peak ประมาณ 682 MiB / 268 PID ภายใต้ 2 GiB/2 CPU/512 PID ไม่มี denial/OOM |

ไม่ได้รันชุด Linux หรือ browser regression เดิมทั้งหมดซ้ำในรอบอ่านนี้ ไฟล์ runtime/renderer ที่ตรวจไม่มีเวลาแก้หลัง Linux baseline แต่ **Linux image ที่ผ่านเวลา 16:01 น. สร้างก่อนการแก้ฝั่ง client ล่าสุด** จึงยังต้องสร้าง release image จากโค้ดปัจจุบันและตรวจรับบน VPS เป้าหมาย ผลเดิมอ้างอิงได้จาก [รายงาน Linux](DOCKER-LINUX-VERIFICATION.md) และ [คู่มือ VPS](HOSTINGER-VPS.md) ตัวเลขงานคู่เป็นข้อมูลสมมติขนาดเล็ก ไม่ใช่ผล load test รูปจริงใกล้เพดาน 32 MiB

## งานโค้ด/การทดสอบที่ควรทำก่อนเปิดทีม

1. **แก้แล้ว: ต่ออายุลิงก์รูปอัตโนมัติ** — คงอายุลิงก์ 3,600 วินาทีและ private buckets; ขอลิงก์ใหม่เมื่อครบ 55 นาที ตรวจซ้ำเมื่อกลับแท็บ/ออนไลน์ รีเฟรชเฉพาะรูปโดยไม่โหลดเอกสารทั้งหน้า แกลเลอรีคงโครงการ ช่วงวันที่ และหน้าที่เลือก PDF ขอลิงก์รูปขนาดเต็มใหม่ก่อนฝังภาพ ดู [PHOTO-OPTIMIZATION.md](PHOTO-OPTIMIZATION.md) ยังต้องตรวจรับเครือข่ายและอุปกรณ์จริงบนปลายทาง
2. **แก้แล้ว: สคริปต์บริการจริงส่งเลขรุ่น** — ทุก PATCH รายงานใน `tests/live-integration.mjs` ส่ง `expected_version` จาก snapshot เดิม ตรวจเลขรุ่นเพิ่มและการปฏิเสธรุ่นเก่าด้วย `40001`; กรณีวัสดุติดลบตรวจ constraint `23514` เฉพาะชื่อ `valid_report_material_rows` จึงไม่ผ่านหลอกเพราะขาดเลขรุ่น ไม่ปิด guard และไม่ retry ทับข้อมูล สคริปต์ยังเป็น opt-in และยังไม่ได้รันสร้าง/เขียนข้อมูล DEV รอบนี้ ทดสอบรูปแบบคำขอด้วย SDK และข้อมูลจำลองในเครื่องแทน
3. **ยังเหลือหน้าแนะนำระบบและนโยบายความเป็นส่วนตัวสำหรับ Google production** — ไม่พบ route/link privacy ใน source ปัจจุบัน ต้องเตรียมหน้า public บนโดเมนที่ถือครอง พร้อมแยก OAuth project/client สำหรับ production จาก DEV และตั้ง URLs จริงให้ครบ ไม่ใช่เพียงเปิด provider ซึ่งเปิดอยู่แล้ว ดู [ข้อกำหนด Google](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance) รอบนี้ไม่ได้อ่าน Google Console ซ้ำหรือเปลี่ยน Audience/Test users

หลักฐานโค้ด: `src/lib/photos.ts`, `src/lib/use-report-photos.ts`, `src/components/photo-gallery.tsx`, `src/components/site-app.tsx`, `src/lib/export-report-pdf.ts`, `tests/live-integration.mjs` และ migration `document_edit_concurrency`

## สิ่งที่ต้องเตรียมสำหรับปลายทาง

| งาน | ต้องมี / เกณฑ์ผ่าน |
|---|---|
| VPS และผู้ดูแล | ยืนยัน Hostinger VPS/IP/region/ทรัพยากร, SSH key, Docker Engine + Compose, ผู้ดูแล updates และเหตุขัดข้อง สเปก container 2 GiB ไม่ใช่ข้อสรุปว่า VPS 2 GB เพียงพอ เพราะ OS/build/proxy ต้องใช้พื้นที่และ RAM เพิ่ม |
| โดเมนและ HTTPS | เลือกโดเมนจริง ตั้ง DNS/reverse proxy เช่น Caddy, certificate renewal และ firewall เว็บผ่าน 80/443 ส่วน Next.js 3000 bind loopback ตาม Compose ไม่เปิดโดยตรงต่อสาธารณะ |
| Production Supabase | ตัดสินใจแยก production หรือคง project ปัจจุบันพร้อมแผนข้อมูล เพราะ DEV มีข้อมูลใช้งานจริงแล้ว ตรวจ migrations/RLS/private buckets บนปลายทาง และแผนย้าย Auth users/สมาชิก/โครงการ/เอกสาร/รูป หาก UUID เปลี่ยนต้องแก้ default-company mapping ใน `src/lib/workspace-preference.ts` |
| Environment | เตรียม public Supabase URL/key ตอน build และ runtime ให้ตรงกัน, `APP_ORIGIN` เป็น exact HTTPS origin, secret อยู่นอก image/Git ใช้ค่าจาก template สำหรับ resource limits และ XDG temporary directories ที่ผ่านการทดสอบแล้ว |
| Login / Gmail | ยืนยัน OAuth client/project สำหรับ production, Audience, branding/contact/privacy และ URLs ของ Google/Supabase ให้ตรงโดเมน ทดสอบบัญชี owner/editor/viewer และบัญชีที่ยังไม่มีสมาชิก ผล Google Console ที่บันทึกก่อนหน้าคือ Testing; รอบนี้ยืนยันสดเฉพาะ provider enabled ไม่เปลี่ยน Audience/Test users |
| อีเมล | ยืนยัน custom SMTP/From address และทดสอบยืนยันอีเมล/กู้รหัสผ่านรับจริงจากอุปกรณ์อื่น ค่า SMTP บน hosted project ยังไม่ได้ยืนยันในรอบนี้ ค่า local config ใช้แทนหลักฐานไม่ได้ |
| Backup / Restore | สำรองทั้ง Database และเนื้อไฟล์ Storage กำหนดรอบ ผู้รับผิดชอบ ที่เก็บแยก และทดลอง restore ในที่แยก Backup เฉพาะ VPS ไม่ครอบคลุม Supabase ที่เป็นคนละระบบ |
| Release / Rollback | สร้าง Git baseline/private remote หลังตรวจไม่ให้ข้อมูลจริงหรือ secrets เข้า repo เก็บ lockfile, release tag/image และวิธีคืนรุ่นก่อนโดยไม่ลบข้อมูล/volumes วางแผนแยก rollback โค้ดกับ migration |
| Monitoring / ทีม | แจ้งเว็บล่ม, PDF failure/429/timeout, RAM/disk/log/Storage usage, ผู้รับแจ้ง และแนวทางเพิ่ม/ถอนสมาชิก เก็บ PDF ที่ส่งลงนามและกำหนดเลขเอกสาร/Revision |

Hostinger มี [Ubuntu 24.04 Docker template](https://www.hostinger.com/support/8306612-how-to-use-the-docker-vps-template-at-hostinger/) แต่ยังต้องตรวจ Compose/runtime และ sandbox ของ OS เป้าหมายจริง ยังไม่ได้เข้าถึงหรือตั้งค่า VPS ในการตรวจนี้

สำหรับอีเมล Supabase ระบุว่า default SMTP ไม่เหมาะกับ production และมีข้อจำกัดผู้รับ/อัตราส่ง จึงต้องยืนยัน custom SMTP และทดสอบ delivery จริง ([เอกสาร SMTP](https://supabase.com/docs/guides/auth/auth-smtp)) ส่วน database backup **ไม่รวมเนื้อไฟล์ Storage** ต้องสำรองรูปแยก ([เอกสาร Backups](https://supabase.com/docs/guides/platform/backups))

## ตรวจรับบน VPS เมื่อได้รับอนุญาตให้ทดสอบปลายทาง

- รัน Linux PDF verifier, sandbox, HTTP/config guards และงานคู่บน kernel/VPS จริง พร้อมดูภาพและเก็บ resource metrics
- ทดสอบผ่าน HTTPS ด้วยบัญชีแยก owner/editor/viewer รวมสิทธิ์ข้ามบริษัท บันทึกชนกัน ถังขยะ/คืนเอกสาร/ยกเลิก และ PDF ของเอกสารยกเลิก
- ทดสอบรูปกล้องจริง จำนวนมาก หลายหน้า ขนาด payload ใกล้เพดาน และมือถือ Android/Chrome กับ iPhone/Safari
- ทดสอบเปิดฟอร์ม/แกลเลอรีทิ้งเกินหนึ่งชั่วโมง โดยฟอร์มไม่หายและ PDF ยังมีรูปครบ
- ทดสอบ Gmail/password login, callbacks, กู้รหัสผ่าน, การคืนรุ่น และ restore ข้อมูลก่อนประกาศเปิดทีม

การตรวจรับปลายทางเป็นขั้นตอนภายหลัง รายงานนี้ไม่ได้อนุญาตหรือเริ่ม deploy

## งานที่พิจารณาภายหลังได้

- Owner กำหนดโควตารูปในหน้า storage ตามที่ผู้ใช้เลือกไว้แล้ว ไม่ใช่ข้อบังคับว่าต้องซื้อพื้นที่ตอนนี้
- จัดลำดับ index/connection strategy ตาม [คำแนะนำ foreign keys](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) และ [production checklist](https://supabase.com/docs/guides/deployment/going-into-prod) เป็น INFO ด้าน performance ไม่ใช่ security vulnerability ที่ตรวจพบ
- ก่อนเอกสารสะสมมาก ให้เพิ่ม server-side filters/aggregates เพราะปัจจุบันอ่านโครงการ/รายงานแบบแบ่ง 500 แถวแล้วรวมใน browser
- ถ้าต้องบังคับคุณภาพเวลา Daily Request ทุกช่องทาง ให้เพิ่ม validation ที่ DB/API ด้วย ปัจจุบัน UI ตรวจให้ แต่ไม่ใช่ทุกกฎที่บังคับในฐานข้อมูล

ตรวจ changelog Supabase ปัจจุบันและประกาศ PostgreSQL 17.11/TLS แล้ว ไม่พบการใช้ legacy encryption/ltree/btree_gist/custom operators ใน source/migrations ของแอป ไม่ได้สแกนหรือแก้ extensions ในฐานข้อมูลสด ประกาศ [ถอด TLS ciphers เก่าเร็วสุด 10 พฤศจิกายน](https://supabase.com/changelog/cbc-tls-ciphers-deprecated) ให้รวมอุปกรณ์จริงของทีมใน UAT; ไม่ได้พบว่าอุปกรณ์ทีมได้รับผลกระทบแล้ว

## หลักฐานรอบนี้

- `output/readiness/hostinger-recheck-summary.json`
- `output/readiness/hostinger-recheck-platform.json` (project/migrations/Advisors เท่านั้น)
- `output/readiness/hostinger-recheck-audit-all.json`
- `output/readiness/hostinger-recheck-audit-production.json`
- `output/readiness/hostinger-recheck-public-auth.json` (ไม่มี API key หรือ Client Secret)
- `output/readiness/hostinger-recheck-http.json`
- `output/readiness/hostinger-recheck-changelog.md`
- `output/readiness/signed-image-verification.json` และ `signed-image-browser-final.json` (ผลหลังแก้ล่าสุด โค้ดยังตรงกัน)
- `output/qa/docker-install/status.json` (ผล Linux baseline ก่อนแก้ client ล่าสุด)

ไม่อ่านข้อมูล Hampton/บริษัท/สมาชิกซ้ำและไม่ยืนยันจำนวนเอกสารจากรายงานเก่าว่าเป็นจำนวนปัจจุบัน
