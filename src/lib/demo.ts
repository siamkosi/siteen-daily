import { Dataset, today } from "./types";
export const DEMO_WORKSPACE = "11111111-1111-4111-8111-111111111111";
export const DEMO_USER = "22222222-2222-4222-8222-222222222222";
export function seed(): Dataset {
  const created_at = new Date().toISOString();
  return {
    projects: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        workspace_id: DEMO_WORKSPACE,
        name: "บ้านพักอาศัย ลาดพร้าว 71",
        location: "ลาดพร้าว กรุงเทพมหานคร",
        client: "คุณธนพล",
        status: "active",
        created_at,
      },
      {
        id: "44444444-4444-4444-8444-444444444444",
        workspace_id: DEMO_WORKSPACE,
        name: "อาคารสำนักงาน บางนา",
        location: "บางนา กรุงเทพมหานคร",
        client: "บริษัท เอสพี จำกัด",
        status: "active",
        created_at,
      },
      {
        id: "55555555-5555-4555-8555-555555555555",
        workspace_id: DEMO_WORKSPACE,
        name: "ปรับปรุงร้านค้า รังสิต",
        location: "คลองหลวง ปทุมธานี",
        client: "คุณมณี",
        status: "completed",
        created_at,
      },
    ],
    reports: [
      {
        id: "66666666-6666-4666-8666-666666666666",
        workspace_id: DEMO_WORKSPACE,
        project_id: "33333333-3333-4333-8333-333333333333",
        report_date: today(),
        weather: "แดดออก",
        workers: 12,
        work_done:
          "ติดตั้งแบบหล่อเสาชั้น 1 จำนวน 8 ต้น\nผูกเหล็กคานด้านทิศเหนือ เตรียมตรวจรับก่อนเทคอนกรีต",
        materials: "เหล็ก DB16 จำนวน 40 เส้น",
        equipment: "เครื่องตัดเหล็ก 1 เครื่อง",
        issues: "รอแบบขยายบันไดจากผู้ออกแบบ",
        tomorrow: "ตรวจแบบหล่อและเทคอนกรีตเสา",
        status: "draft",
        created_by: DEMO_USER,
        created_at,
      },
    ],
    photos: [],
  };
}
const key = "site-daily-th:demo:v1";
export function loadDemo(): Dataset {
  const saved = localStorage.getItem(key);
  return saved ? JSON.parse(saved) : seed();
}
export function saveDemo(data: Dataset) {
  localStorage.setItem(key, JSON.stringify(data));
}

// Sample workspaces are available only on the developer's loopback host.
// Real workspace access is always enforced independently by Auth and RLS.
export function isLocalDemoHost(hostname: string) {
  return ["localhost", "127.0.0.1", "[::1]", "::1"].includes(hostname);
}
