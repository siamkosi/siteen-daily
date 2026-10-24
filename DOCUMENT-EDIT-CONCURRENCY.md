# การป้องกันบันทึกเอกสารทับกัน

เพิ่มใน DEV วันที่ 24 ตุลาคม 2026 โดยยังไม่ deploy เว็บ

## การใช้งาน

Daily Request และ Daily Report ตรวจเลขรุ่นของฉบับที่เปิดแก้ไขทุกครั้งที่บันทึกร่างหรือส่งเอกสาร คนแรกบันทึกได้ตามปกติ หากอีกคนเปิดฉบับเก่าไว้แล้วบันทึกตาม ระบบจะปฏิเสธการบันทึกทับและแจ้งเตือนภาษาไทย

ฟอร์มที่กรอกไว้ยังอยู่ในแท็บเดิม ปุ่มบันทึกจะหยุดใช้งานสำหรับฉบับเก่านั้น ให้กด **เปิดฉบับล่าสุดในแท็บใหม่** ตรวจข้อมูลและคัดลอกส่วนที่ต้องการไปแก้ไขในฉบับล่าสุด ก่อนปิดหรือรีเฟรชแท็บเดิม ระบบไม่รวมข้อมูลหรือบังคับเขียนทับให้อัตโนมัติ และไม่ได้สำรองฟอร์มที่ยังไม่บันทึกข้ามการปิดแท็บ

## การทำงาน

- `row_version` เริ่มที่ 1 และเพิ่มโดยฐานข้อมูลทุกครั้งที่อัปเดตเอกสาร แยกจากเลขแก้ไขเอกสารที่พิมพ์ใน PDF
- ฟอร์มเก็บข้อมูลและเลขรุ่นจาก snapshot เดียวกันตั้งแต่เปิดแก้ไข การ refresh token หรือกลับมาที่แท็บไม่โหลดฟอร์มใหม่โดยไม่จำเป็น
- PATCH ส่ง `expected_version` พร้อมกรอง ID บริษัท และเลขรุ่นที่เปิดมา การอัปเดตและเปรียบเทียบเกิดที่แถวเดียวกันอย่าง atomic
- Trigger บังคับตรวจเลขรุ่นสำหรับการแก้เนื้อหาของผู้ใช้ที่ยืนยันตัวตน แม้เรียก Data API ตรงโดยไม่ส่งตัวกรองเลขรุ่นก็ข้ามการตรวจไม่ได้
- `expected_version` เป็นอินพุตชั่วคราว Trigger ล้างเป็น null ก่อนเก็บแถว/ประวัติ ผู้ใช้เปลี่ยน `row_version` เองไม่ได้ สิทธิ์ RLS และกฎเดิมยังบังคับใช้
- ย้ายถังขยะ กู้คืน และยกเลิกยังใช้ RPC ที่ตรวจ `updated_at` เดิมและสิทธิ์ตามสถานะ โดยเพิ่มเลขรุ่นด้วย จึงใช้ฟอร์มเก่าก่อนย้ายถังขยะ/กู้คืนมาบันทึกทับไม่ได้
- งานดูแลฐานข้อมูลผ่าน role `postgres`, `supabase_admin`, `service_role` ไม่ต้องส่ง expected version แต่เลขรุ่นยังเพิ่มตามเดิม ไม่มีการเพิ่มกุญแจเหล่านี้ใน frontend
- Demo อ่านข้อมูล localStorage ล่าสุดก่อนเปรียบเทียบรุ่นและรวมรายการ ไม่อาศัยข้อมูล React ที่ค้างอยู่ในแท็บ

## หลักฐาน

- PostgreSQL/RLS ผ่าน 295 assertions รวม owner/editor เปิดรุ่นเดียวกัน การปฏิเสธรุ่นเก่า/ไม่มีเลขรุ่น/ปลอมเลขรุ่น ข้อมูลและประวัติไม่เปลี่ยนเมื่อบันทึกล้มเหลว viewer แก้ไม่ได้ การกู้คืน และการอัปเดตที่ timestamp เท่ากันใน transaction เดียว
- Browser ผ่านกรณีใหม่ 6 รายการ ครบ Request/Report สองบัญชีจำลอง แสดงคำเตือนทั้งรหัส 40001 และ PGRST116 เก็บฟอร์มเดิม เปิดฉบับล่าสุดและแก้ไขต่อได้ รวม demo สองแท็บ
- Regression ทั้งชุดผ่าน 46/46 รายการ รวม PDF รูปภาพ สมาชิก ถังขยะ และโควตารูป; build, TypeScript, lint และ report-model ผ่าน
- ตรวจ schema/trigger ใน Supabase DEV หลัง migration และ Security Advisor ไม่พบรายการแจ้งเตือน
- ใช้ข้อมูลสมมติทดสอบ ไม่มีการแก้เนื้อหา Hampton หรือโครงการใหม่ของผู้ใช้

Migration: `supabase/migrations/20261024063917_document_edit_concurrency.sql`

## Live integration script alignment — 24 October 2026

`tests/live-integration.mjs` now uses `tests/live-document-write.mjs` for every report PATCH, including invalid-material and foreign-company attempts. It sends the opened snapshot's `row_version` as `expected_version` and scopes by workspace/document ID. A snapshot without a valid version fails before any request. It does not fetch a newer version or retry conflicts automatically.

The script checks the returned version increment, rejects an explicitly stale edit with `40001`, and verifies saved fields/version remain unchanged. Negative materials must fail the actual `valid_report_material_rows` constraint (`23514`), so a missing-version error cannot masquerade as validation success. The helper's SDK wire contract covers both `daily_reports` and `daily_requests` locally; the live script's existing fixtures remain reports only.

Local contract check: `node --test --test-isolation=none tests/live-document-write.test.mjs`. The live script remains opt-in with private registered test-account credentials and the fixed DEV URL guard. It has **not** been run against hosted DEV in this change because it creates labeled workspaces/documents. No production credentials or service role are used.

Verification after alignment: 3 SDK contract tests, 295 embedded PostgreSQL/RLS assertions, and the final 64/64 browser regression run passed. No concurrency guard, Auth role or hosted schema was changed.

เว็บรุ่นเก่าที่เปิดไว้ก่อนเปลี่ยนแปลงอาจบันทึกไม่ผ่านเพราะยังไม่ส่งเลขรุ่น ให้คัดลอกข้อมูลที่ยังไม่บันทึกก่อนรีเฟรชเพื่อโหลดรุ่นใหม่
