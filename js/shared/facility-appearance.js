// Presentation only. Feature access is always enforced separately.
(function () {
  const sections = {
    member: { welcome: "Welcome", announcements: "Announcements", feedback: "Feedback", scores: "Habit scores", tools: "Member tools" },
    coach: { welcome: "Welcome", feedback: "Feedback", announcements: "Announcements", scores: "Member totals", attention: "Needs attention", workouts: "Workout review" }
  };
  function normalize(value = {}) {
    return {
      style: ["performance", "clean", "community"].includes(value.style) ? value.style : "performance",
      background: ["default", "light", "dark"].includes(value.background) ? value.background : "default",
      member_order: Array.isArray(value.member_order) ? value.member_order : Object.keys(sections.member),
      coach_order: Array.isArray(value.coach_order) ? value.coach_order : Object.keys(sections.coach),
      member_hidden: Array.isArray(value.member_hidden) ? value.member_hidden : [],
      coach_hidden: Array.isArray(value.coach_hidden) ? value.coach_hidden : []
    };
  }
  function contrast(color) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) return "#101114";
    const rgb = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16) / 255)
      .map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722 > .179 ? "#101114" : "#ffffff";
  }
  function apply(configuration, doc = document) {
    const settings = normalize(configuration.appearance_settings);
    const root = doc.documentElement;
    root.dataset.facilityStyle = settings.style;
    root.dataset.facilityBackground = settings.background;
    root.style.setProperty("--facility-secondary-ink", contrast(configuration.secondary_color || "#f7f7f7"));
    for (const role of Object.keys(sections)) {
      const nodes = [...doc.querySelectorAll(`[data-dashboard-role="${role}"][data-dashboard-section]`)];
      for (const node of nodes) {
        node.toggleAttribute("data-appearance-hidden", settings[`${role}_hidden`].includes(node.dataset.dashboardSection));
      }
      // Reorder only the marked siblings, leaving headers and other page content in place.
      const parents = new Set(nodes.map(node => node.parentElement));
      for (const parent of parents) {
        const siblings = nodes.filter(node => node.parentElement === parent);
        const ordered = [...siblings].sort((a, b) => settings[`${role}_order`].indexOf(a.dataset.dashboardSection) - settings[`${role}_order`].indexOf(b.dataset.dashboardSection));
        const markers = siblings.map(node => { const marker = doc.createComment("dashboard section"); parent.replaceChild(marker, node); return marker; });
        markers.forEach((marker, index) => parent.replaceChild(ordered[index], marker));
      }
    }
  }
  window.FacilityAppearance = { sections, normalize, contrast, apply };
})();
