import SiteApp from "@/components/site-app";
import { Suspense } from "react";
export default function Page() {
  return (
    <Suspense fallback={<div className="loading">กำลังโหลด…</div>}>
      <SiteApp />
    </Suspense>
  );
}
