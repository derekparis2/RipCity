const coachNavigationItems = [
  { key: "dashboard", label: "Dashboard", href: "coach-dashboard.html" },
  { key: "roster", label: "Roster", href: "coach-roster.html" },
  { key: "workouts", label: "Workout Builder", href: "coach-workouts.html", module: "workouts" },
  { key: "programming", label: "Workout Planner", href: "coach-programming.html?view=programs", module: "workouts" },
  { key: "testing", label: "Testing Days", href: "coach-testing.html", module: "testing_days" },
  { key: "leaderboards", label: "Leaderboards", href: "coach-leaderboards.html", module: "leaderboards" },
  { key: "approvals", label: "Approvals", href: "coach-approvals.html" },
  { key: "profile", label: "Profile", href: "profile.html" },
];

function initializeCoachNavigation(configuration = window.RipCityFacility) {
  document.querySelectorAll("[data-coach-nav]").forEach((nav) => {
    const activeKey = nav.dataset.coachNav;
    const visibleItems = coachNavigationItems.filter(item => (
      !item.module || configuration?.modules?.[item.module]?.enabled !== false
    ));
    if (window.RipCityPlatformOwner) {
      visibleItems.push({ key: "platform", label: "Exit Admin Mode", href: "platform.html" });
    }
    const renderLink = (item) => {
      const isActive = item.key === activeKey;
      return `
        <a
          class="coach-nav-link${isActive ? " active" : ""}"
          href="${window.RipCityAccess?.getFacilityPageUrl(item.href)?.replace(/&/g, "&amp;") || item.href}"
          ${isActive ? 'aria-current="page"' : ""}
        >${item.label}</a>
      `;
    };
    const primaryKeys = new Set(["dashboard", "roster", "workouts", "programming"]);
    const primaryLinks = visibleItems.filter(item => primaryKeys.has(item.key)).map(renderLink).join("");
    const secondaryItems = visibleItems.filter(item => !primaryKeys.has(item.key));
    const activeSecondary = secondaryItems.find(item => item.key === activeKey);
    const moreLinks = secondaryItems.length ? `<details class="coach-nav-more">
      <summary class="coach-nav-link${activeSecondary ? " active" : ""}">More${activeSecondary ? ` · ${activeSecondary.label}` : ""}</summary>
      <div class="coach-nav-more-links">${secondaryItems.map(renderLink).join("")}</div>
    </details>` : "";

    nav.innerHTML = `
      <button
        class="outline-btn coach-nav-toggle"
        type="button"
        aria-expanded="false"
        aria-label="Open coach navigation"
      >Menu</button>
      <div class="coach-nav-links">${primaryLinks}${moreLinks}</div>
    `;

    const toggle = nav.querySelector(".coach-nav-toggle");
    toggle?.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(isOpen));
      toggle.setAttribute("aria-label", `${isOpen ? "Close" : "Open"} coach navigation`);
      toggle.textContent = isOpen ? "Close" : "Menu";
    });

    if (!nav.dataset.dismissBound) {
      nav.dataset.dismissBound = "true";
      const closeNavigation = () => {
        nav.classList.remove("open");
        const currentToggle = nav.querySelector(".coach-nav-toggle");
        currentToggle?.setAttribute("aria-expanded", "false");
        currentToggle?.setAttribute("aria-label", "Open coach navigation");
        if (currentToggle) currentToggle.textContent = "Menu";
        nav.querySelector(".coach-nav-more")?.removeAttribute("open");
      };
      document.addEventListener("click", event => { if (!nav.contains(event.target)) closeNavigation(); });
      nav.addEventListener("keydown", event => {
        if (event.key !== "Escape") return;
        const summary = nav.querySelector(".coach-nav-more[open] > summary");
        const wasOpen = nav.classList.contains("open");
        closeNavigation();
        (wasOpen ? nav.querySelector(".coach-nav-toggle") : summary || nav.querySelector(".coach-nav-toggle"))?.focus();
      });
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initializeCoachNavigation());
} else {
  initializeCoachNavigation();
}

window.addEventListener("ripcity:facility-config", event => {
  initializeCoachNavigation(event.detail);
});
