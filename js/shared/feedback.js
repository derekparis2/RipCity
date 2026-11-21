// Shared, visible feedback for errors raised outside the current viewport.
(function () {
  const errors = new Map();
  const successTimers = new WeakMap();
  let region;
  let signOutRequest;
  function getRegion() {
    if (region?.isConnected) return region;
    region = document.createElement("section");
    region.id = "app-error-notices";
    region.setAttribute("aria-label", "App errors");
    region.hidden = true;
    document.body.append(region);
    return region;
  }
  function dismiss(key, restoreFocus = false) {
    const entry = errors.get(key);
    if (!entry) return;
    const shouldRestore = restoreFocus && entry.node.contains(document.activeElement);
    entry.node.remove();
    if (entry.element?.dataset.feedbackError === entry.message) {
      entry.element.textContent = "";
      entry.element.hidden = true;
      entry.element.classList.remove("error-message");
      delete entry.element.dataset.feedbackError;
    }
    errors.delete(key);
    if (region) region.hidden = !errors.size;
    if (shouldRestore && entry.trigger?.isConnected && !entry.trigger.disabled) entry.trigger.focus({ preventScroll: true });
  }
  function error(message, { key = "general", element = null } = {}) {
    if (!message) return;
    const container = getRegion();
    let entry = errors.get(key);
    if (!entry) {
      const node = document.createElement("div");
      node.className = "app-error-notice";
      node.setAttribute("role", "alert");
      const copy = document.createElement("span");
      const close = document.createElement("button");
      close.type = "button";
      close.className = "app-error-close";
      close.setAttribute("aria-label", "Dismiss error");
      close.textContent = "×";
      close.addEventListener("click", () => dismiss(key, true));
      node.append(copy, close);
      entry = { node, copy, trigger: document.activeElement };
      errors.set(key, entry);
      container.append(node);
    }
    entry.message = String(message);
    entry.element = element;
    if (element) element.dataset.feedbackError = entry.message;
    entry.copy.textContent = entry.message;
    container.hidden = false;
    container.scrollTop = container.scrollHeight;
  }
  function show(element, message, isError = false, options = {}) {
    const key = options.key || element?.id || "general";
    const text = String(message || "");
    if (element) window.clearTimeout(successTimers.get(element));
    // An empty refresh message must not silently erase an unacknowledged error.
    if (!text && errors.has(key)) return;
    if (!isError && text) dismiss(key);
    if (element) {
      element.textContent = text;
      element.hidden = !text;
      element.classList.toggle("error-message", isError);
      element.setAttribute("role", "status");
      element.setAttribute("aria-live", isError ? "off" : "polite");
    }
    if (isError) error(text, { ...options, key, element });
    else if (text && element && options.autoClose) {
      successTimers.set(element, window.setTimeout(() => {
        if (element.textContent === text && !errors.has(key)) { element.textContent = ""; element.hidden = true; }
      }, 4500));
    }
  }
  async function signOut() {
    if (signOutRequest) return signOutRequest;
    dismiss("sign-out");
    signOutRequest = (async () => {
      let timeoutId;
      try {
        const timeout = new Promise((resolve, reject) => {
          timeoutId = window.setTimeout(() => reject(new Error("Logging out took too long. Check your connection and try again.")), 15000);
        });
        const result = await Promise.race([window.db.auth.signOut(), timeout]);
        if (result?.error) throw result.error;
        return true;
      } catch (failure) {
        error(failure.message || "Could not log out. Please try again.", { key: "sign-out" });
        return false;
      } finally { window.clearTimeout(timeoutId); }
    })();
    try { return await signOutRequest; }
    finally { signOutRequest = null; }
  }
  window.AppFeedback = { show, error, dismiss, signOut };
})();
