# โฮสต์ที่เหมาะกับ SiteEN DAILY

ตรวจเอกสารผู้ให้บริการ 24 ตุลาคม 2026 ยังไม่ซื้อแพ็กเกจ สร้าง production หรือ deploy

ข้อเสนอสำหรับโค้ดปัจจุบัน: **Hostinger VPS สำหรับเว็บ/API/PDF + Supabase สำหรับฐานข้อมูล Auth และรูป** หากมีผู้รับผิดชอบดูแล VPS เหตุผลเป็นการประเมินจากลักษณะโค้ด ไม่ใช่ผล load test ของโฮสต์จริง

อัปเดต: เตรียม Docker/Compose และ renderer Chromium สำหรับ Linux แล้ว ดู [HOSTINGER-VPS.md](HOSTINGER-VPS.md) ยังไม่ deploy และยังต้องตรวจ Linux container/ทรัพยากรบนปลายทางจริง

## เปรียบเทียบ

| บริการ | บทบาทที่เหมาะ | สิ่งที่ต้องเตรียมสำหรับระบบนี้ |
|---|---|---|
| Hostinger VPS | รัน Next.js/Node.js และ headless browser สำหรับ PDF ในเซิร์ฟเวอร์เดียว | มี root access ควบคุม system dependencies และ runtime ได้ ต้องตั้ง Linux/Chromium แทน Edge ในเครื่อง Windows รวม reverse proxy/HTTPS, process restart, patch, backup และ monitoring |
| Vercel | ดูแลเว็บ Next.js และการออก release สะดวก | ปรับ PDF ให้รันบนโฮสต์ได้ และเปลี่ยนวิธีส่งรูป เพราะ Function จำกัด request/response 4.5 MB ขณะที่แอปปัจจุบันรับ JSON/base64 ถึง 32 MiB อาจส่งเฉพาะ ID แล้วอ่านข้อมูลที่ server หรือใช้บริการ PDF แยก |
| Supabase | คง Database, Auth, RLS และ private Storage เดิม | เป็น backend ของระบบนี้ ยังต้องมีที่รัน Next.js และ PDF ไม่จำเป็นต้องย้ายข้อมูลออกเพื่อใช้โฮสต์อื่น |
| Cloudflare | DNS/CDN/การป้องกันเว็บ หรือรันเว็บบน Workers | การรัน Next.js ใช้เส้นทางที่รองรับ Workers และต้องปรับการสร้าง PDF เป็น Browser Run/บริการที่รองรับ แทนการ launch Edge process แบบปัจจุบัน จึงเป็นงานปรับ runtime เพิ่ม |

Hostinger มี managed Node.js บนแผน Web/Cloud บางแผนแล้ว จึงไม่ควรเหมารวมว่ารัน Next.js ไม่ได้ อย่างไรก็ตามการรองรับ Node.js ไม่ยืนยันว่าติดตั้ง browser/system libraries และรับงาน PDF นี้ได้ ต้องตรวจข้อจำกัดของแผนจริง VPS ให้ควบคุมส่วนนี้ได้มากกว่า

หากไม่ต้องการดูแล OS ให้พิจารณา **Vercel + Supabase + บริการ PDF ที่จัดการให้** โดยปรับเส้นทาง PDF/รูปก่อน ไม่ควรอัปโหลดโค้ดปัจจุบันแล้วถือว่า PDF พร้อมใช้งานทันที

Cloudflare ใช้ร่วมกับ Hostinger ได้ ไม่จำเป็นต้องใช้ทุกบริการพร้อมกัน ต้องตรวจการ cache ให้ข้อมูลส่วนตัว/เอกสาร/API ที่ยืนยันตัวตนไม่ถูก cache แบบสาธารณะ

## ก่อนเลือกแพ็กเกจ

ยืนยันงบและราคาต่ออายุ จำนวนวิศวกร จำนวน PDF พร้อมกัน ขนาดรูปต่อรายงาน region ใกล้ผู้ใช้/ฐานข้อมูล backup/restore และผู้ดูแลเซิร์ฟเวอร์ ยังไม่ได้แนะนำขนาด VPS เป็นค่ารับรอง ต้องทดสอบ PDF และโหลดจริงก่อน

## แหล่งข้อมูล

- [Hostinger Node.js hosting options / VPS root access](https://www.hostinger.com/support/node-js-hosting-options-at-hostinger/)
- [Vercel Functions limits](https://vercel.com/docs/functions/limitations)
- [Supabase architecture](https://supabase.com/docs/guides/getting-started/architecture)
- [Cloudflare Next.js on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [Cloudflare Browser Run PDF](https://developers.cloudflare.com/browser-run/quick-actions/pdf-endpoint/)
