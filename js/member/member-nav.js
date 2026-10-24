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
      key: "history",
      href: "member-history.html",
      desktop: "Member History",
      mobile: "History",
      icon: '<path d="M5 3h14v3H5zM5 8h9v3H5zM5 13h14v3H5zM5 18h9v3H5z"></path>'
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
