// =====================================================
// SHARED UI SAFETY HELPERS
// =====================================================
// The app renders coach/member-entered text from Supabase. Escape values before
// putting them into template strings so stored content cannot become HTML.

(function () {
  // Add the Google Form URL here when the beta feedback form is ready.
  // Leave blank to show the feedback card as "coming soon."
  const FEEDBACK_FORM_URL = "";

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

  window.RipCityUI = {
    attr,
    escapeHtml,
    feedbackFormUrl: FEEDBACK_FORM_URL,
    percent,
    safeInitials,
    text
  };
})();
