import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "SiteEN DAILY | รายงานหน้างาน",
  applicationName: "SiteEN DAILY",
  icons: {
    icon: { url: "/branding/siteen-daily.png", type: "image/png" },
    apple: "/branding/siteen-daily.png",
  },
  description: "บันทึกหน้างานก่อสร้าง สำหรับทีมช่างและวิศวกรไทย",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
