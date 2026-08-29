// =====================================================
// SHARED UI SAFETY HELPERS
// =====================================================
// The app renders coach/member-entered text from Supabase. Escape values before
// putting them into template strings so stored content cannot become HTML.

(function () {
  // Shared beta feedback form shown on member and coach surfaces.
  const FEEDBACK_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdNy5HIv7SIW89IPFP_ZGjaWwXQZMUTiGGIikLXXy0PmhGbVQ/viewform?usp=header";

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function text(value, fallback = "") {
    const normalized = value === null || value === undefined || value === ""
      ? fallback
      : value;

    return escapeHtml(normalized);
  }

  function attr(value) {
    return escapeHtml(value);
  }

  function percent(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) return 0;

    return Math.max(0, Math.min(100, Math.round(number)));
  }

  function safeInitials(name, fallback = "RC") {
    const words = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (!words.length) return fallback;

    return words
      .slice(0, 2)
      .map(word => word.charAt(0).toUpperCase())
      .join("");
  }

  function avatarMarkup(name, imageUrl = "", extraClass = "") {
    const classes = ["avatar", extraClass, imageUrl ? "has-image" : ""]
      .filter(Boolean)
      .join(" ");

    if (imageUrl) {
      return `
        <div class="${attr(classes)}">
          <img src="${attr(imageUrl)}" alt="${attr(`${name || "Member"} profile photo`)}" loading="lazy" />
        </div>
      `;
    }

    return `<div class="${attr(classes)}">${text(safeInitials(name))}</div>`;
  }

  function setupFeedbackLinks() {
    document.querySelectorAll("[data-feedback-link]").forEach(link => {
      if (!FEEDBACK_FORM_URL) {
        link.href = "#";
        link.classList.add("is-disabled");
        link.setAttribute("aria-disabled", "true");
        return;
      }

      link.href = FEEDBACK_FORM_URL;
      link.classList.remove("is-disabled");
      link.removeAttribute("aria-disabled");
    });
  }

  document.addEventListener("DOMContentLoaded", setupFeedbackLinks);

  window.RipCityUI = {
    attr,
    avatarMarkup,
    escapeHtml,
    feedbackFormUrl: FEEDBACK_FORM_URL,
    percent,
    safeInitials,
    setupFeedbackLinks,
    text
  };
})();
