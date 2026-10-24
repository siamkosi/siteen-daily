# เตรียม Hostinger VPS สำหรับ SiteEN DAILY

วันที่ 24 ตุลาคม 2026 — ติดตั้ง Docker Desktop/WSL และ **ทดสอบ Linux container ผ่านแล้ว ยังไม่ deploy** ตรวจ PDF ภาษาไทยสองหน้า รูป ลายน้ำ sandbox, HTTP/API และ PDF สองงานพร้อมกันด้วยข้อมูลสมมติ ดู [DOCKER-LINUX-VERIFICATION.md](DOCKER-LINUX-VERIFICATION.md) ยังไม่ได้ซื้อ VPS เปลี่ยน DNS หรือแก้ Supabase และยังต้องตรวจบน Hostinger VPS เป้าหมายจริง

แนวทาง: Next.js และ PDF อยู่ใน Docker บน Linux VPS; Database/Auth/private Storage ยังคงใช้ Supabase ต้องตัดสินใจ DEV/staging/production และแผนข้อมูลก่อนใช้งานจริง

อัปเดตตรวจความพร้อมเวลา 18:14 น.: หลัง Linux baseline ได้แก้การต่ออายุรูปและสคริปต์เลขรุ่นแล้ว ชุด browser ล่าสุดผ่าน 64/64 และโค้ดยังตรงกับหลักฐาน ต้องสร้าง release image จาก source ปัจจุบันและตรวจรับบน VPS จริงต่อ ยังไม่ได้ยืนยันปลายทาง/SMTP/backup หรือ deploy ดู [รายการค้างล่าสุด](HOSTINGER-PREDEPLOY-REVIEW.md)

ผลรอบ Windows เดิม: production build/TypeScript/lint และ regression 58 กรณีผ่านแล้ว รอบนี้เพิ่ม Linux build/TypeScript, lint, PDF/Poppler/ตรวจภาพ, Chromium sandbox จริง และชุด HTTP/concurrency/config guards ผ่าน ผลหลักฐานใหม่อยู่ใน `output/qa/linux-pdf/` และ `output/qa/docker-install/` ซึ่งไม่เข้า Git/image ไม่ได้รัน browser regression เดิมทั้งหมดซ้ำเพราะไม่ได้แก้ UI หรือกติกาข้อมูล

## สิ่งที่เตรียมแล้ว

- `Dockerfile`: Node 24.22.1 / Debian Bookworm, `npm ci`, Chromium ที่ตรงกับ `playwright-core` ใน lockfile และ OS libraries ฟอนต์ Noto Sans Thai รวมใน image และฝังลงใน PDF ไม่ต้องเรียก Google Fonts
- Renderer เลือก Chromium บน Linux และ Edge บน Windows ค่า `PDF_BROWSER` มาจาก server เท่านั้น ผู้เรียก API เลือก executable/flags ไม่ได้ Linux production ต้องเปิด Chromium sandbox
- Compose รัน user `node`, drop capabilities ทั้งหมด, seccomp สำหรับ Chromium namespace sandbox, read-only rootfs, tmpfs และ cache volume ใช้ `XDG_CONFIG_HOME`/`XDG_CACHE_HOME` ใน `/tmp` ให้ Chromium/Crashpad เขียนไฟล์ชั่วคราวได้ ค่าเริ่มต้น 2 GB/2 CPU/512 PID ผ่านงานสมมติสองงานพร้อมกัน ไม่ใช่ผลรับรองขนาด VPS สำหรับงานจริง
- `/api/health` เป็น process check ราคาถูก ไม่เปิดเผย config และไม่เรียก Chromium/ฐานข้อมูล **healthy ไม่ได้แปลว่า PDF หรือ Supabase พร้อม**
- ไม่เปลี่ยน Auth/RLS, Origin check, quota/concurrency, CSP, การปิด JavaScript/network ของ renderer หรือเงื่อนไขสิทธิ์อ่านเอกสาร
- `.dockerignore` ใช้ allowlist จึงไม่คัดลอก `.env.local`, secrets, ข้อมูล QA/PDF จริง หรือ `output/` เข้า image มีเพียง public Supabase config ฝังใน frontend และ manifest ที่ใช้ตรวจ build/runtime ให้ตรงกัน

ใช้ production dependencies เต็มชุดแทน standalone tracing เพื่อให้ Playwright และข้อมูล browser ใช้งานได้ตรงรุ่น การอัปเดต lockfile/Node/browser ต้อง build image และทดสอบ PDF ใหม่

## ตรวจ Linux แบบยังไม่ deploy

ทำส่วนนี้ในเครื่อง Linux ทดสอบที่ติดตั้ง Docker Engine + Compose v2 แล้ว รันจาก root ของ repository ไม่ต้องใช้ credentials จริงหรือเปิดพอร์ตเว็บ สร้างไฟล์เฉพาะทดสอบที่ถูก ignore:

```sh
cat > deploy/.env.pdf-check <<'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://pdf-check.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_fake_pdf_check_only
APP_ORIGIN=http://127.0.0.1:3000
SITEEN_RELEASE=pdf-check
EOF
mkdir -p output/qa/linux-pdf
docker compose --env-file deploy/.env.pdf-check -f compose.yaml -f compose.pdf-verify.yaml config --quiet
docker compose --env-file deploy/.env.pdf-check -f compose.yaml -f compose.pdf-verify.yaml build app
docker compose --env-file deploy/.env.pdf-check -f compose.yaml -f compose.pdf-verify.yaml run --no-deps --name siteen-pdf-check app
```

คำสั่ง `run` ไม่ publish พอร์ตของ service และไม่ได้เริ่ม Next.js ชุดทดสอบเรียก renderer จริง สร้าง Daily Report/Request จากข้อมูลสมมติเท่านั้น ไม่ login ไม่ติดต่อ Supabase ไม่ใช้ข้อมูลโครงการจริง โฟลเดอร์ผลทดสอบต้องเขียนได้สำหรับ UID 1000 ของ container บน Linux host ให้เตรียม ownership/permission เฉพาะโฟลเดอร์นี้ให้ตรงกับผู้ใช้ที่รันทดสอบ

ต้องได้ exit code 0 และบรรทัด `PASS: Linux Chromium` ผลจะอยู่ใน `output/qa/linux-pdf/` บน host ทันที QA overlay mount เฉพาะโฟลเดอร์ผลและ verifier ปัจจุบันแบบอ่านอย่างเดียว ไม่ต้อง `docker cp` จาก `/tmp` หลังจบ container เพราะ tmpfs หายเมื่อหยุด ตรวจหลักฐานก่อนลบเฉพาะ container ทดสอบ:

```sh
docker rm siteen-pdf-check
```

ตรวจ PNG ทั้งสองหน้าของเอกสารทั้งคู่ รวมอักษรไทย สระ/วรรณยุกต์ ตาราง และรูป แล้วตรวจ `result.json` ว่า `platform=linux`, `browser=chromium`, `sandbox=true`, `linux_verified=true` และ `verification.json` ต้องมี `status=passed` ซึ่งยืนยัน Poppler checks ครบ การตรวจลายน้ำใช้ raw text เพราะ layout extraction แยกอักษรตามแนวเอียง หากรันทดสอบซ้ำ ใช้ชื่อ container ใหม่หรือลบเฉพาะ container ทดสอบเก่าหลังเก็บผลแล้ว

มี reusable checks เพิ่มใน `scripts/verify-pdf-sandbox.mjs`, `scripts/verify-linux-http.mjs` และ `scripts/verify-pdf-concurrency.sh` สำหรับรันใน image เดียวกัน ดูวิธีเรียกในรายงานผล การทดสอบสองงานล่าสุดสร้าง 4 PDF ใน 12 วินาที ใช้ RAM สูงสุดประมาณ 682 MiB, PID สูงสุด 268, ไม่มี PID-limit denial จึงปรับเพดานเดิม 256 เป็น 512 แล้ว ค่าจากงานสมมติขนาดเล็กยังไม่ใช่ load test รูป/รายงานจริง

หากไม่ผ่าน ให้เก็บ logs และตรวจ kernel/user namespaces, AppArmor และ Docker/libseccomp รุ่นของเครื่องจริง อย่าแก้ด้วย `--privileged`, `SYS_ADMIN`, `seccomp=unconfined` หรือปิด sandbox ใน production โปรไฟล์และที่มาดู `deploy/THIRD-PARTY-NOTICES.md` ขั้นตอนนี้ยังต้องผ่านบน OS ของ VPS ที่จะใช้จริงด้วย

## ค่าที่ต้องเตรียมก่อนปล่อยเว็บ

คัดลอก `deploy/.env.vps.example` เป็น `deploy/.env.vps` บนระบบที่ได้รับอนุญาต เก็บสิทธิ์อ่านเฉพาะผู้ดูแล ไม่ commit ไม่ส่งในแชต และไม่ใช้ตัวอย่าง fake เป็น config จริง

| ค่า | ใช้เมื่อใด |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ตอน build และ run ต้องเหมือนกัน ชี้ project ที่ตกลงใช้จริง |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable/anon เท่านั้น ห้าม service_role/secret ถ้าเปลี่ยนต้อง rebuild |
| `APP_ORIGIN` | origin HTTPS ตรงโดเมนจริง ไม่มี path หรือ `/` ปิดท้าย ใช้ตรวจ API สร้าง PDF |
| `SITEEN_RELEASE` | tag release ที่ตรวจแล้ว เก็บ image รุ่นก่อนสำหรับ rollback |
| `SITEEN_LOCAL_PORT` | พอร์ต host loopback สำหรับ reverse proxy ค่าเริ่มต้น 3000 |
| RAM/CPU limits | ปรับตามเครื่องและผลทดสอบ PDF พร้อมกัน ไม่ใช้ค่าตัวอย่างตัดสินใจซื้อแพ็กเกจ |
| `SITEEN_PID_LIMIT` | ค่าเริ่มต้น 512; ถ้าลดต้องทดสอบ PDF สองงานพร้อมกันใหม่ เพดาน 256 เคยทำให้การพิมพ์ล้มเหลว |

entrypoint จะปฏิเสธเมื่อ public config ตอน run ไม่ตรงกับ image, ใส่ key ประเภท secret, origin ไม่ถูกต้อง หรือปิด sandbox โดยไม่พิมพ์ค่าลับออก log OAuth Client Secret ต้องอยู่เฉพาะ Supabase ไม่ใช้ใน image/Next public env

## เส้นทางเครือข่ายที่เตรียมไว้

`HTTPS → Caddy บน host → 127.0.0.1:3000 → Next.js/PDF container`

`deploy/Caddyfile.example` เป็นตัวอย่างสำหรับ Caddy ที่ติดตั้งบน host ต้องกำหนด `SITE_DOMAIN` ให้โดเมนที่ถือครองก่อน validate config หากใช้ Caddy ใน container ต้องออกแบบ network ใหม่ เพราะ loopback ไม่ใช่ host เดียวกัน

Compose เปิดพอร์ตเฉพาะ loopback ห้ามเปิด 3000 สู่สาธารณะโดยตรง ตั้ง HTTPS, firewall และ SSH ตามผู้ดูแล VPS ตัวอย่าง reverse proxy รองรับ request body 32 MiB และ response timeout 60 วินาทีให้ตรง API เดิม (base64 เพิ่มขนาดจากรูปจริง) หากวาง Cloudflare/proxy เพิ่ม ต้องตรวจขีดจำกัดและไม่ cache authenticated API/เอกสาร/ข้อมูลบริษัทแบบสาธารณะ

ยังไม่ได้ติดตั้งหรือรัน Caddy/Docker/เว็บบน VPS คำสั่งเปิด service production ให้ทำในงาน deploy ที่ได้รับอนุญาตภายหลัง

## เกณฑ์ก่อน deploy จริง

- [x] Linux container build, PDF/ภาพ, sandbox และงานสมมติสองงานพร้อมกันผ่านบน Docker Desktop/WSL
- [ ] รันการตรวจชุดเดียวกันบน OS/Hostinger VPS เป้าหมาย และตรวจภาพอีกครั้ง
- [ ] ทดสอบผ่าน HTTPS และ API จริงด้วยบัญชี owner/editor/viewer รวมการปฏิเสธสิทธิ์ รูปหลายหน้า รูปขนาดใหญ่ และ PDF พร้อมกันตาม quota เดิม (6 ครั้ง/นาที/ผู้ใช้, 1 งาน/ผู้ใช้, 2 งานรวม)
- [ ] บันทึก RAM/CPU/เวลา PDF และตรวจ OOM/timeout หากทรัพยากรไม่พอให้ปรับขนาดหรือแยก worker ก่อนเปิดทีม
- [ ] เลือกฐานข้อมูลปลายทาง ตรวจ migration/RLS/private Storage และสำรองทั้ง Database และ Storage พร้อมทดลองกู้คืน ไม่ใช้ cache volume เป็น backup ข้อมูล
- [ ] ตั้งโดเมน/HTTPS, `APP_ORIGIN`, Supabase Site URL และ exact callback/reset URLs Google app ยังอยู่ Testing สองบัญชี ต้องเตรียม Audience/ผู้ใช้ทีมก่อนเปิดจริง
- [ ] SMTP/อีเมลยืนยันและกู้รหัสผ่าน ทดสอบรับจริงจากอุปกรณ์อื่น
- [ ] เตรียม image รุ่นก่อนและแผน rollback, OS/security patches, monitoring, disk/log alerts และผู้รับผิดชอบ VPS ไม่ลบ volume เพื่อ rollback
- [ ] ยังมีรายการความพร้อมอื่นใน `READINESS-BEFORE-DEPLOY.md` รวม backup/restore, Git/release และ load test การเตรียม Docker ครั้งนี้ไม่ได้ปิดรายการเหล่านั้น

## แหล่งอ้างอิง

- [Playwright browsers และ dependency installation](https://playwright.dev/docs/browsers)
- [Playwright Docker / non-root sandbox](https://playwright.dev/docs/docker)
- [Node official Docker images](https://hub.docker.com/_/node)
- [Caddy request body](https://caddyserver.com/docs/caddyfile/directives/request_body)
- Next.js guide ที่ตรงกับรุ่นในโปรเจกต์: `node_modules/next/dist/docs/01-app/02-guides/self-hosting.md`
