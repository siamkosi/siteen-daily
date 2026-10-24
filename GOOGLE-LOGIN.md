# Google Login — SiteEN DAILY

เพิ่มปุ่ม **เข้าสู่ระบบด้วย Google** ในหน้าเข้าสู่ระบบ/สมัครบัญชี และหน้า `/auth/callback` แล้ว โดยยังไม่ deploy

**ตั้งค่า DEV สำเร็จแล้ว 24 ตุลาคม 2026 เวลา 14:30 น.** Google Cloud project `siteen-daily`, OAuth client SiteEN DAILY DEV และ Supabase Google provider เปิดใช้งานแล้ว ทดสอบ Google Login จริงทั้งบัญชี owner/editor โดยคง User ID และสมาชิกเดิม รายละเอียด: [GOOGLE-LOGIN-PROVISIONED.md](D:/Sandbox27/SiteEN/GOOGLE-LOGIN-PROVISIONED.md)

## ตั้งค่า Supabase DEV และ Google Cloud

สถานะก่อนตั้งค่า: public Auth settings ของ DEV ระบุ `external.google=false` ต่อมาผู้ใช้อนุญาตให้ตั้งค่าทั้งสองบริการและยืนยันนโยบาย/รายชื่อทดสอบแล้ว ขั้นตอนด้านล่างเป็นคู่มือสำหรับการติดตั้งใหม่ ไม่ใช่งานที่ยังค้างของ DEV ปัจจุบัน

1. Google Cloud → Google Auth Platform (หรือ APIs & Services → Credentials) ใช้ OAuth Client ประเภท **Web application** ของ SiteEN DAILY
2. ตั้ง branding/audience และข้อมูลติดต่อของแอป หาก OAuth consent screen อยู่ใน Testing ให้เพิ่มอีเมลผู้ทดสอบที่ต้องการ ผู้ใช้เลือกบัญชีและให้ความยินยอมด้วยตนเอง
3. **Authorized redirect URI ของ Google** ต้องเป็น:

   `https://hvcwskmqwvrjsrysllly.supabase.co/auth/v1/callback`

   นี่คือ callback ของ Supabase ไม่ใช่ `/auth/callback` ของเว็บ

4. Supabase DEV → Authentication → Sign In / Providers → Google ใส่ Client ID และ Client Secret จาก Google Cloud แล้วเปิด provider โดยไม่ข้าม nonce check
5. Supabase → Authentication → URL Configuration เพิ่ม **Redirect URLs ของเว็บ**:

   - `http://127.0.0.1:3000/auth/callback`
   - หากใช้ localhost ด้วย ให้เพิ่ม `http://localhost:3000/auth/callback`
   - ก่อน production เพิ่ม `https://โดเมนจริง/auth/callback` และตั้ง Site URL เป็นโดเมนจริง

6. เปิด `http://127.0.0.1:3000/login` กด Google แล้วเลือกบัญชีเดิมของบริษัท เช่น siamkosi@gmail.com ตรวจอีเมลและบทบาทหลังกลับมา ห้ามสร้างสมาชิก/เปลี่ยนบทบาทเพื่อแก้กรณีเข้าผิดบัญชี

Client Secret อยู่ใน Supabase/Google Cloud เท่านั้น ไม่ต้องใส่ Google Secret หรือ Google Client ID ใน `NEXT_PUBLIC_*` ของเว็บ

## การทำงานและสิทธิ์

- ใช้ Supabase Auth เดิมผ่าน `signInWithOAuth({ provider: 'google' })` หน้า callback รอ SDK ประมวลผลเซสชัน แล้วตรวจผู้ใช้กับ Auth ก่อนเปิด `/dashboard` ใช้ flow ของ browser client เดิม ไม่เปลี่ยนระบบรหัสผ่าน/กู้รหัสผ่าน
- ปลายทางกำหนดจาก origin ปัจจุบันและ path คงที่ ไม่รับ `next`/`redirect` จากผู้เรียก รายละเอียด callback ถูกล้างจาก URL และตั้ง no-referrer/noindex
- แสดงตัวเลือกบัญชี Google ทุกครั้ง ไม่ขอ Gmail API scopes หรือขอสิทธิ์อ่าน/ส่งอีเมล
- Supabase รองรับการเชื่อม identity อัตโนมัติเมื่ออีเมลตรงบัญชีเดิมและผ่านเงื่อนไขยืนยันตัวตน ต้องทดสอบยืนยัน UUID เดิมกับบัญชีจริงก่อนเปิด production ไม่รวมบัญชีเองจาก email ใน frontend
- สมาชิกและบทบาทยังอ่านจาก memberships/RLS ตาม user ID เดิม siamkosi@gmail.com ต้องยังเป็น owner และ welovecyclist@gmail.com ต้องยังเป็น editor บัญชีใหม่ไม่ได้สิทธิ์บริษัท 27 วิศวกรรมอัตโนมัติ
- หาก provider ยังไม่เปิดหรือเครือข่ายมีปัญหา ปุ่มจะแสดงข้อความและให้ลองใหม่ได้ โดยยังใช้อีเมล/รหัสผ่านได้
- การตั้ง provider บน hosted Supabase ไม่ได้เกิดจากการแก้ `supabase/config.toml` ในเครื่อง

## ตรวจรับ

- อัตโนมัติ: ปุ่มและ provider availability, callback สำเร็จ/ยกเลิก/โทเคนไม่ถูกต้อง, ไม่ตาม external next, สิทธิ์ owner/editor/ไม่มีสมาชิก และ login เดิม
- จริงหลังผู้ใช้ตั้ง provider: กด Google ด้วยบัญชีเดิม ตรวจ UUID/สมาชิก/บริษัทเริ่มต้น เปิด Hampton และ PDF โดยไม่แก้เนื้อหา ตรวจออกจากระบบ/เข้าสู่ระบบใหม่ และมือถือ
- ผลทดสอบ OAuth จำลองไม่ใช่หลักฐานว่า Google consent screen และ Client Secret จริงตั้งถูกต้อง
- กรณี Google ใหม่ผ่านอัตโนมัติ 8 รายการ และ regression ทั้งชุดผ่าน 54/54 รายการ รวม build/TypeScript/lint ผ่าน ตรวจหน้า login ใน DEV ทั้ง desktop และขนาดมือถือจำลองแล้ว
- ผลก่อนตั้งค่าตอน 14:00 น. provider ยังปิดอยู่; หลังตั้งค่าและทดสอบจริงตอน 14:30 น. provider เปิดแล้ว และสองบัญชีเดิมใช้ Google Login ได้ตามรายงาน provisioned

อ้างอิง: [Supabase Google Sign-in](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking)
