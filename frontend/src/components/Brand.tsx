import brand from "../../public/brand/manifest.json";
export function KlinekraftLogo() {
  // Never substitute a reconstructed mark when the original is unavailable.
  return brand.available ? (
    <img className="brand-symbol" src={brand.logo} alt="Klinekraft symbol" />
  ) : null;
}
export function KlinekraftWordmark() {
  return (
    <div className="wordmark">
      KLINEKRAFT<span>TERMINAL</span>
    </div>
  );
}
export function KlinekraftBrandLockup() {
  return (
    <div className="brand">
      <KlinekraftLogo />
      <KlinekraftWordmark />
    </div>
  );
}
export function installBrandIcon() {
  if (!brand.available || document.querySelector('link[rel="icon"]')) return;
  const link = document.createElement("link");
  link.rel = "icon";
  link.href = "/brand/favicon.png";
  document.head.append(link);
}
