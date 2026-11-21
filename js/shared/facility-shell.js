// Runs in the head before first paint on facility-specific pages.
(function () {
  const root = document.documentElement;
  root.dataset.facilityState = "loading";
  try {
    const selected = new URLSearchParams(window.location.search).get("facility_id")
      || window.sessionStorage.getItem("ripcity:selected-facility-id");
    const appearance = JSON.parse(window.sessionStorage.getItem("facility:appearance") || "null");
    if (!selected || appearance?.id !== selected) return;
    if (["midnight", "slate", "forest"].includes(appearance.theme)) {
      root.dataset.facilityTheme = appearance.theme;
    }
    for (const key of ["--facility-primary", "--facility-secondary", "--accent", "--accent-soft", "--accent-ink"]) {
      const value = appearance.colors?.[key];
      if (typeof value === "string" && /^(#[0-9a-f]{6}|rgba\([\d.,\s]+\))$/i.test(value)) {
        root.style.setProperty(key, value);
      }
    }
  } catch { /* Fall back to the neutral shell if storage is unavailable. */ }
})();
