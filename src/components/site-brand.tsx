import Image from "next/image";

export function SiteBrand({
  large = false,
  tagline = false,
}: {
  large?: boolean;
  tagline?: boolean;
}) {
  return (
    <span className={`site-brand${large ? " site-brand-large" : ""}`}>
      <Image
        className="site-brand-logo"
        src="/branding/siteen-daily.png"
        alt="โลโก้ SiteEN DAILY"
        width={large ? 160 : 88}
        height={large ? 160 : 88}
        sizes={large ? "(max-width: 700px) 128px, 160px" : "88px"}
        loading="eager"
      />
      {tagline && (
        <span className="site-brand-tagline">
          <span>จัดการหน้างาน</span>
          <span>ให้เป็นเรื่องง่าย</span>
        </span>
      )}
    </span>
  );
}
