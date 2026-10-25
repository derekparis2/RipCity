(function () {
  const items = [
    {
      key: "dashboard",
      href: "member-dashboard.html",
      desktop: "Dashboard",
      mobile: "Dash",
      icon: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"></path>'
    },
    {
      key: "training",
      href: "member-training.html",
      desktop: "Training Calendar",
      mobile: "Training",
      icon: '<path d="M2 10h3v4H2zM19 10h3v4h-3zM6 7h3v10H6zM15 7h3v10h-3zM9 11h6v2H9z"></path>'
    },
    {
      key: "habits",
      href: "member-habits.html",
      desktop: "Habits",
      mobile: "Habits",
      icon: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.3 13.4-4-4 1.4-1.4 2.6 2.6 5.2-5.2 1.4 1.4z"></path>'
    },
    {
      key: "leaderboards",
      href: "member-leaderboards.html",
      desktop: "Leaderboards",
      mobile: "Leaders",
      icon: '<path d="M7 3h10v3h3v3c0 2.8-2.2 5-5 5h-.1A5 5 0 0 1 13 16.6V19h4v2H7v-2h4v-2.4A5 5 0 0 1 9.1 14H9c-2.8 0-5-2.2-5-5V6h3V3Zm0 5H6v1c0 1.5 1 2.7 2.4 3A7 7 0 0 1 7 8Zm10 0a7 7 0 0 1-1.4 4A3 3 0 0 0 18 9V8h-1Z"></path>'
    },
    {
      key: "goals",
      href: "member-goals.html",
      desktop: "Goals",
      mobile: "Goals",
      icon: '<path d="M12 2a10 10 0 1 0 10 10h-3a7 7 0 1 1-7-7V2Zm0 5a5 5 0 1 0 5 5h-3a2 2 0 1 1-2-2V7Zm0 4a1 1 0 1 0 1 1h-1v-1Z"></path>'
    },
    {
      key: "profile",
      href: "profile.html",
      desktop: "Profile",
      mobile: "Profile",
      icon: '<path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5Z"></path>'
    }
  ];

  function renderNavigation() {
    document.querySelectorAll("[data-member-nav]").forEach(nav => {
      const activePage = nav.dataset.memberNav;
      nav.innerHTML = items.map(item => `
        <a
          class="nav-link nav-link-anchor ${item.key === activePage ? "active" : ""}"
          href="${item.href}"
          data-member-nav-key="${item.key}"
          ${item.key === activePage ? 'aria-current="page"' : ""}
        >
          <span class="mobile-nav-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">${item.icon}</svg>
          </span>
          <span class="desktop-nav-text">${item.desktop}</span>
          <span class="mobile-nav-text">${item.mobile}</span>
        </a>
      `).join("");
    });
  }

  function setH2KVisibility(isH2K) {
    // Retained for older pages that still call this helper. Habits are now a
    // shared Rip City member feature, so athlete and H2K navigation is equal.
  }

  window.RipCityMemberNav = {
    render: renderNavigation,
    setH2KVisibility
  };

  renderNavigation();
})();
