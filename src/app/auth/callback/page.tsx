import type { Metadata } from "next";
import OAuthCallback from "@/components/oauth-callback";

export const metadata: Metadata = {
  title: "เข้าสู่ระบบด้วย Google | SiteEN DAILY",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function Page() {
  return <OAuthCallback />;
}
