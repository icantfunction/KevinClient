import { siteConfig } from "@/lib/site-config";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <p className="footer-mark">{siteConfig.name}</p>
      <p className="footer-locations">
        {siteConfig.locations.join(" · ")}
      </p>
      <p className="footer-meta">
        <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>
        <span aria-hidden> · </span>
        <a href={`tel:${siteConfig.phoneTel}`}>{siteConfig.phone}</a>
      </p>
      <p className="footer-meta" style={{ marginTop: "0.6rem" }}>
        © {new Date().getFullYear()} {siteConfig.name}
      </p>
    </footer>
  );
}
