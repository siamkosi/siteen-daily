# ผลทดสอบ Docker / Linux ของ SiteEN DAILY

24 ตุลาคม 2026 — **Linux verification ผ่านแล้ว ยังไม่ deploy** ทดสอบบน Docker Desktop/WSL ในเครื่องพัฒนา ด้วยข้อมูลสมมติทั้งหมด ไม่มีการแก้โครงการ รายงาน บัญชี สิทธิ์ หรือ Supabase

## สภาพแวดล้อมที่ตรวจจริง

| ส่วน | รุ่น / ค่า |
|---|---|
| Docker Desktop | 4.96.3.244472 แบบ per-user |
| Docker Engine / Compose | 29.9.2 / v5.6.1 |
| WSL / kernel | 3.0.3.0 / 6.18.54.1-microsoft-standard-WSL2 |
| Image | `siteen-daily-pdf-verify:pdf-check` สร้างในเครื่อง ไม่ push |
| Node / base OS | 24.22.1 / Debian Bookworm |
| Playwright / Chromium | 1.64.1 / 156.0.8078.4 |
| Container | user `node` (UID 1000), read-only rootfs, non-privileged, drop capabilities ALL, no-new-privileges, seccomp |
| ขีดจำกัดที่ใช้ | 2 GiB RAM, 2 CPU, 512 PID, `/tmp` tmpfs 512 MiB |
| พอร์ต | ไม่มี host port ที่ publish ในการทดสอบ |

Image ทดสอบต่อจาก stage `app` เดียวกับ production `runtime` และเพิ่ม Poppler สำหรับตรวจเอกสาร QA overlay mount เฉพาะ verifier ปัจจุบันแบบอ่านอย่างเดียวกับโฟลเดอร์ผลทดสอบ โค้ด renderer และ Next.js ที่ทดสอบมาจาก image ที่ build บน Linux

## ผลตรวจรับ

| รายการ | ผล |
|---|---|
| Linux build / TypeScript | ผ่าน |
| Lint รวม reusable QA scripts | ผ่าน |
| Daily Report และ Daily Request | ผ่าน สองหน้าต่อไฟล์ ภาษาไทย ตาราง ฟอนต์/โครงร่าง glyph ฝังใน PDF รูป title และลายน้ำยกเลิก |
| ตรวจภาพล่าสุด | ผ่าน PNG ทั้ง 4 หน้า ไม่มีข้อความตัด รูปหาย หรือสระ/วรรณยุกต์อ่านไม่ได้ |
| Chromium sandbox จริง | หน้า `chrome://sandbox` แสดง Layer 1 = Namespace, PID/Network namespaces = Yes และ Seccomp-BPF = Yes |
| Linux HTTP / API | health 200 + no-store, login 200, PDF ไม่มี token 401, origin อื่น/ไม่มี origin 403 |
| Container configuration guards | ปฏิเสธ fake secret key, public config ไม่ตรง image, public HTTP origin และปิด sandbox ก่อนเริ่มแอป |
| สองงานพร้อมกัน | ผ่าน สร้าง 4 PDF รวม 8 หน้า ใน 12 วินาที |
| ทรัพยากรของงานคู่ | RAM สูงสุด 714,739,712 bytes (ประมาณ 682 MiB), PID สูงสุด 268, PID-limit denial = 0, ไม่มี OOM |

ตัวเลขทรัพยากรเป็นงานสมมติขนาดเล็กที่มีโลโก้หนึ่งรูปต่อ PDF ทดสอบ renderer โดยตรง ยังไม่ใช่ load test ของ API พร้อม Auth/DB หรือรายงานจริงที่มีรูปมาก/ขนาดใกล้ 32 MiB จึงยังใช้รับรองขนาด VPS ไม่ได้

ชุด HTTP ทดสอบภายใน container ไม่มีการ publish พอร์ต และไม่เรียก Auth/DB เพราะใช้ config สมมติและตรวจการปฏิเสธก่อน authenticate การทดสอบ Google Login และสิทธิ์บัญชีจริงบน HTTPS เป้าหมายยังต้องทำภายหลัง

## สิ่งที่แก้จากการทดสอบจริง

- ลดการเปลี่ยนเจ้าของไฟล์ใน Docker build ให้เฉพาะ `.next/cache` แทน dependencies ทั้งหมด ซึ่งช้ามากบนเครื่องนี้ Dependencies ยังคงอ่านได้โดยผู้ใช้ `node`
- กำหนด `XDG_CONFIG_HOME` และ `XDG_CACHE_HOME` ใน `/tmp` ผ่าน Compose ให้ Chromium/Crashpad ทำงานกับ read-only rootfs ได้
- อนุญาต syscall `chroot` ใน seccomp เพิ่มจาก namespace calls เพื่อให้ Chromium ลดสิทธิ์เข้าถึง filesystem ภายใน user namespace ของตนได้ โดยยัง drop capabilities ALL ไม่เพิ่ม container capability ดู [ที่มาโปรไฟล์](deploy/THIRD-PARTY-NOTICES.md)
- เพิ่ม PID limit จาก 256 เป็น 512: งานคู่เดิมพิมพ์ล้มเหลวที่ peak 256 หลังปรับสร้างครบได้ที่ peak 268 โดยไม่มี denial
- เก็บผล QA ผ่าน bind mount เพราะ `/tmp` แบบ tmpfs หายเมื่อ container หยุด ไม่ใช้ `docker cp` จาก stopped tmpfs
- ตรวจลายน้ำเอียงด้วย raw text แทน layout extraction ที่แยกคำตามแนวเอียง และสร้าง `verification.json` แยกผล Poppler ออกจากผลการสร้าง PDF

ไม่ได้ปิด sandbox, ใช้ privileged mode, ให้ SYS_ADMIN หรือปิด seccomp เพื่อให้ทดสอบผ่าน ไม่เปลี่ยน Auth/RLS, API quota หรือความคมชัด/ขนาดรูปสำหรับ PDF

## หลักฐาน

- [Daily Report ทดสอบ](output/qa/linux-pdf/report.pdf) และ [Daily Request ทดสอบ](output/qa/linux-pdf/request.pdf)
- `output/qa/linux-pdf/`: PDF, PNG ทั้ง 4 หน้า, text/font/info, `result.json` และ `verification.json`
- `output/qa/linux-pdf-sandbox/`: สถานะ sandbox จาก Chromium จริง
- `output/qa/linux-http-check/`: HTTP results และ server log
- `output/qa/linux-pdf-concurrent/`: PDF จากงานคู่และ `metrics.json`
- `output/qa/docker-install/`: build logs, container inspect, guard results และ `linux-suite-final.json`

หลักฐานเป็นข้อมูลสมมติ ถูก ignore และไม่เข้า image/build context ทั้ง suite สุดท้ายต้อง exit 0 พร้อม `verification.json` status=passed อย่าถือ `result.json` ที่บอกว่าสร้างไฟล์ได้เพียงอย่างเดียวว่า Poppler/ภาพผ่านแล้ว

## ทดสอบซ้ำ

ดูคำสั่ง build และ verifier หลักใน [HOSTINGER-VPS.md](HOSTINGER-VPS.md) สร้าง `output/qa/linux-pdf` ก่อนรัน และให้ UID 1000 ใน container เขียนโฟลเดอร์ผลทดสอบได้

บน Windows ใช้ CLI ที่ติดตั้งแล้วได้โดยตรง:

```powershell
$dockerCli = Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin/docker.exe'
& $dockerCli info --format '{{.OSType}}'
& $dockerCli compose --env-file deploy/.env.pdf-check -f compose.yaml -f compose.pdf-verify.yaml run --rm --no-deps app
```

ต้องได้ engine `linux` จริง และ verifier exit 0 ข้างต้นไม่เปิด production service

Reusable checks เพิ่มเติมบน Linux shell หลัง build image เดียวกันแล้ว (เรียกทีละชุด ไม่ต้อง publish พอร์ต):

```sh
mkdir -p output/qa/linux-pdf-sandbox output/qa/linux-http-check output/qa/linux-pdf-concurrent

docker compose --env-file deploy/.env.pdf-check -f compose.yaml -f compose.pdf-verify.yaml run --rm --no-deps \
  -v "$PWD/scripts/verify-pdf-sandbox.mjs:/tmp/check.mjs:ro" \
  -v "$PWD/output/qa/linux-pdf-sandbox:/tmp/pdf-sandbox" \
  app node --experimental-strip-types /tmp/check.mjs

docker compose --env-file deploy/.env.pdf-check -f compose.yaml -f compose.pdf-verify.yaml run --rm --no-deps \
  -v "$PWD/scripts/verify-linux-http.mjs:/tmp/check.mjs:ro" \
  -v "$PWD/output/qa/linux-http-check:/tmp/siteen-api-check" \
  app node /tmp/check.mjs

docker compose --env-file deploy/.env.pdf-check -f compose.yaml -f compose.pdf-verify.yaml run --rm --no-deps \
  -v "$PWD/scripts/verify-pdf-concurrency.sh:/tmp/check.sh:ro" \
  -v "$PWD/output/qa/linux-pdf-concurrent:/tmp/pdf-concurrent" \
  app sh /tmp/check.sh
```

ตรวจ exit codes, PDF/PNG และ metrics ทุกครั้ง โดยเฉพาะ `pids_limit_denials` ต้องเป็น 0 หากเปลี่ยน browser, Node, dependencies, resource limits หรือ host kernel ต้องทดสอบใหม่

## ยังต้องทำก่อนเปิดทีม

รันชุดเดียวกันบน Hostinger VPS จริง ตรวจ kernel/user namespaces/AppArmor และทดสอบข้อมูล/ภาพจริงผ่าน HTTPS ตามจำนวนผู้ใช้ ตรวจโดเมน/Origin/Auth URLs/Google Audience/SMTP รวม backup/restore และ rollback ตาม [รายการก่อน deploy](READINESS-BEFORE-DEPLOY.md) ผลบน Docker Desktop/WSL ไม่แทนผลตรวจบน VPS เป้าหมาย
