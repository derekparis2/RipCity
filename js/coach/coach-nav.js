const coachNavigationItems = [
  { key: "dashboard", label: "Dashboard", href: "coach-dashboard.html" },
  { key: "roster", label: "Roster", href: "coach-roster.html" },
  { key: "workouts", label: "Workout Builder", href: "coach-workouts.html" },
  { key: "leaderboards", label: "Leaderboards", href: "coach-leaderboards.html" },
  { key: "approvals", label: "Approvals", href: "coach-approvals.html" },
];

function initializeCoachNavigation() {
  document.querySelectorAll("[data-coach-nav]").forEach((nav) => {
    const activeKey = nav.dataset.coachNav;
    const links = coachNavigationItems.map((item) => {
      const isActive = item.key === activeKey;
      return `
        <a
          class="coach-nav-link${isActive ? " active" : ""}"
          href="${item.href}"
          ${isActive ? 'aria-current="page"' : ""}
        >${item.label}</a>
      `;
    }).join("");

    nav.innerHTML = `
      <button
        class="outline-btn coach-nav-toggle"
        type="button"
        aria-expanded="false"
        aria-label="Open coach navigation"
      >Menu</button>
      <div class="coach-nav-links">${links}</div>
    `;

    const toggle = nav.querySelector(".coach-nav-toggle");
    toggle?.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(isOpen));
      toggle.setAttribute("aria-label", `${isOpen ? "Close" : "Open"} coach navigation`);
      toggle.textContent = isOpen ? "Close" : "Menu";
    });

    document.addEventListener("click", (event) => {
      if (!nav.classList.contains("open") || nav.contains(event.target)) return;
      nav.classList.remove("open");
      toggle?.setAttribute("aria-expanded", "false");
      toggle?.setAttribute("aria-label", "Open coach navigation");
      if (toggle) toggle.textContent = "Menu";
    });
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeCoachNavigation);
} else {
  initializeCoachNavigation();
}
