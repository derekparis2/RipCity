(function () {
  const MODULES = [
    ["workouts", "Workouts"],
    ["habits", "Habits"],
    ["goals", "Goals"],
    ["leaderboards", "Leaderboards"],
    ["announcements", "Announcements"],
    ["testing_days", "Testing Days"]
  ];

  const DEFAULT_TERMINOLOGY = {
    member_singular: "Member",
    member_plural: "Members",
    coach_singular: "Coach",
    coach_plural: "Coaches",
    group_singular: "Group",
    group_plural: "Groups"
  };

  const TIME_ZONES = [
    ["America/New_York", "Eastern Time — New York"],
    ["America/Chicago", "Central Time — Chicago"],
    ["America/Denver", "Mountain Time — Denver"],
    ["America/Phoenix", "Arizona — Phoenix"],
    ["America/Los_Angeles", "Pacific Time — Los Angeles"],
    ["America/Anchorage", "Alaska — Anchorage"],
    ["Pacific/Honolulu", "Hawaii — Honolulu"],
    ["UTC", "UTC"]
  ];
  function timeZoneOptions(selected) {
    const zones = new Map(TIME_ZONES);
    const additional = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
    for (const zone of [...additional, selected]) if (zone && !zones.has(zone)) zones.set(zone, zone.replaceAll("_", " "));
    return [...zones].map(([value, label]) => `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`).join("");
  }

  let profile = null;
  let facilities = [];

  const message = document.getElementById("platform-message");
  const list = document.getElementById("platform-facility-list");
  const createPanel = document.getElementById("platform-create-panel");
  const editPanel = document.getElementById("platform-edit-panel");

  function showMessage(text, isError = false) {
  if (window.AppFeedback) { window.AppFeedback.show(message, text, isError, { key: "platform-message" }); return; }
    message.textContent = text || "";
    message.classList.toggle("error-message", isError);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function buildAdminInviteUrl(inviteCode) {
    const url = new URL("signup.html", window.location.href);
    url.searchParams.set("admin_invite", inviteCode);
    return url.toString();
  }

  async function copyText(value) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const input = document.createElement("input");
    input.value = value;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.left = "-9999px";
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand("copy");
    input.remove();
    if (!copied) throw new Error("Copy failed.");
  }

  function defaultConfiguration() {
    return {
      name: "",
      slug: "",
      logo_url: "",
      primary_color: "#69b7ff",
      secondary_color: "#f7f7f7",
      time_zone: "America/New_York",
      ui_theme: "midnight",
      appearance_settings: {},
      terminology: { ...DEFAULT_TERMINOLOGY },
      modules: Object.fromEntries(MODULES.map(([key]) => [key, { enabled: true, settings: {} }])),
      programs: {
        athlete: { program_key: "athlete", display_name: "Athlete", plural_name: "Athletes", enabled: true, sort_order: 10 },
        h2k: { program_key: "h2k", display_name: "Member", plural_name: "Members", enabled: true, sort_order: 20 }
      }
    };
  }

  function normalizeConfig(configuration) {
    const base = defaultConfiguration();
    return {
      ...base,
      ...configuration,
      terminology: { ...base.terminology, ...(configuration.terminology || {}) },
      modules: Array.isArray(configuration.modules)
        ? Object.fromEntries(configuration.modules.map(item => [item.module_key, item]))
        : { ...base.modules, ...(configuration.modules || {}) },
      programs: Array.isArray(configuration.programs)
        ? Object.fromEntries(configuration.programs.map(item => [item.program_key, item]))
        : configuration.programs ? { ...configuration.programs } : base.programs
    };
  }

  function renderForm(container, configuration, mode) {
    const config = normalizeConfig(configuration);
    const registrationTools = mode === "edit" ? `<section class="platform-config-section"><h4>Member registration</h4>
      <label>Facility Code<input name="registration_code" readonly value="${escapeHtml(config.registration_code || "")}"></label>
      <div class="platform-form-actions"><button type="button" class="outline-btn" data-copy-registration>Copy Registration Link</button><button type="button" class="outline-btn" data-rotate-registration>Rotate Code</button></div>
      <p class="platform-facility-meta">The code identifies this facility. New members still require approval.</p></section>` : "";
    const slugField = mode === "create" ? `
      <label>Facility Slug<input name="slug" value="${escapeHtml(config.slug)}" placeholder="new-facility" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*"></label>
    ` : `<label>Facility Slug<input value="${escapeHtml(config.slug)}" disabled></label>`;

    container.innerHTML = `
      <form class="platform-config-form" data-platform-config-form data-mode="${mode}" data-facility-id="${escapeHtml(config.id || "")}">
        ${registrationTools}
        <section class="platform-config-section">
          <h4>Identity &amp; location</h4>
          <div class="form-row">
            <label>Facility Name<input name="name" value="${escapeHtml(config.name)}" required></label>
            ${slugField}
          </div>
          <div class="form-row">
            <label>Time Zone<select name="time_zone" required>${timeZoneOptions(config.time_zone)}</select></label>
            <label>Logo URL<input name="logo_url" type="url" value="${escapeHtml(config.logo_url || "")}" placeholder="https://..."></label>
          </div>
          <div class="form-row">
            <label>Primary Color<input name="primary_color" type="color" value="${escapeHtml(config.primary_color || "#69b7ff")}"></label>
            <label>Secondary Color<input name="secondary_color" type="color" value="${escapeHtml(config.secondary_color || "#f7f7f7")}"></label>
          </div>
        </section>

        <section class="platform-config-section">
          <h4>Appearance</h4>
          <div class="form-row">
            <label>Design style<select name="appearance_style">${[["performance","Performance — current Rip City layout"],["clean","Clean — airy and minimal"],["community","Community — warm and welcoming"]].map(([key,label])=>`<option value="${key}"${(config.appearance_settings?.style || "performance")===key?" selected":""}>${label}</option>`).join("")}</select></label>
            <label>Background<select name="appearance_background">${[["default","Style default"],["light","Light"],["dark","Dark"]].map(([key,label])=>`<option value="${key}"${(config.appearance_settings?.background || "default")===key?" selected":""}>${label}</option>`).join("")}</select></label>
          </div>
          <label>Performance surface palette<select name="ui_theme">
            ${[["midnight", "Midnight"], ["slate", "Slate"], ["forest", "Forest"]].map(([key, label]) => `<option value="${key}"${config.ui_theme === key ? " selected" : ""}>${label}</option>`).join("")}
          </select></label>
          <p class="platform-facility-meta">Performance preserves the current layout. Clean and Community change typography, spacing, surfaces, and navigation styling. Your primary and secondary colors remain editable in every style.</p>
          <button class="outline-btn" type="button" data-style-colors>Use selected style’s suggested colors</button>
          <div class="platform-dashboard-editors"></div>
          <div class="form-row"><label>Preview dashboard<select name="appearance_preview_role"><option value="member">Member</option><option value="coach">Coach / admin</option></select></label></div>
          <p class="platform-facility-meta">Preview uses sample content. Module switches and section settings affect the preview; Save Configuration publishes the changes.</p>
          <iframe class="platform-style-preview" title="Facility appearance preview" sandbox="allow-same-origin"></iframe>
        </section>
        <section class="platform-config-section">
          <h4>Modules</h4>
          <div class="platform-module-grid">
            ${MODULES.map(([key, label]) => `
              <label class="platform-option-card">
                <input type="checkbox" name="module_${key}" ${config.modules[key]?.enabled !== false ? "checked" : ""}>
                <span>${label}</span>
              </label>
            `).join("")}
          </div>
        </section>

        <section class="platform-config-section">
          <h4>Member programs</h4>
          <button class="outline-btn" type="button" data-add-program>Add Program</button>
          <p class="platform-facility-meta">Add any number of member programs; each member chooses one. Disable unused programs to preserve their history. Teams and training groups are managed separately in Roster.</p>
          <div class="platform-program-grid">
            ${Object.keys(config.programs).map(key => {
              const program = config.programs[key];
              return `
                <div class="platform-option-card">
                  <h4>${escapeHtml(program.display_name || "Member program")}</h4>
                  <label><input type="checkbox" name="program_${key}_enabled" ${program.enabled !== false ? "checked" : ""}><span>Enable this program</span></label>
                  <label>Registration details<select name="program_${key}_profile_type">
                    <option value="athlete"${(program.profile_type || (key === "athlete" ? "athlete" : "general")) === "athlete" ? " selected" : ""}>Athlete details (sport, position, school)</option>
                    <option value="general"${(program.profile_type || (key === "athlete" ? "athlete" : "general")) === "general" ? " selected" : ""}>General member details</option>
                  </select></label>
                  <label>Singular label<input name="program_${key}_display" value="${escapeHtml(program.display_name)}" required></label>
                  <label>Plural label<input name="program_${key}_plural" value="${escapeHtml(program.plural_name)}" required></label>
                  <fieldset class="platform-program-features"><legend>Features for these members</legend>
                    ${MODULES.map(([moduleKey, label]) => `<label><input type="checkbox" name="program_${key}_module_${moduleKey}"${program.module_overrides?.[moduleKey] !== false ? " checked" : ""}><span>${label}</span></label>`).join("")}
                  </fieldset>
                  <p class="platform-facility-meta">Facility-wide feature switches take precedence.</p>
                </div>
              `;
            }).join("")}
          </div>
        </section>

        <section class="platform-config-section">
          <h4>Dashboard content</h4>
          <label>Member welcome line<input name="content_member_title" maxlength="500" value="${escapeHtml(config.dashboard_content?.member_title || "")}" placeholder="Your training starts here"></label>
          <label>Member welcome message<textarea name="content_member_message" maxlength="500">${escapeHtml(config.dashboard_content?.member_message || "")}</textarea></label>
          <label>Coach welcome line<input name="content_coach_title" maxlength="500" value="${escapeHtml(config.dashboard_content?.coach_title || "")}" placeholder="Your coaching dashboard"></label>
          <label>Coach welcome message<textarea name="content_coach_message" maxlength="500">${escapeHtml(config.dashboard_content?.coach_message || "")}</textarea></label>
          <label><input type="checkbox" name="content_show_feedback"${config.slug === "rip-city" && config.dashboard_content?.show_feedback !== false ? " checked" : ""}${config.slug !== "rip-city" ? " disabled" : ""}>Show beta feedback (Rip City testing only)</label>
          <label><input type="checkbox" name="content_show_scores"${config.dashboard_content?.show_scores !== false ? " checked" : ""}>Show habit score cards</label>
        </section>
        <section class="platform-config-section">
          <h4>Shared terminology</h4>
          <div class="form-row">
            <label>Member<input name="term_member_singular" value="${escapeHtml(config.terminology.member_singular)}" required></label>
            <label>Members<input name="term_member_plural" value="${escapeHtml(config.terminology.member_plural)}" required></label>
          </div>
          <div class="form-row">
            <label>Coach<input name="term_coach_singular" value="${escapeHtml(config.terminology.coach_singular)}" required></label>
            <label>Coaches<input name="term_coach_plural" value="${escapeHtml(config.terminology.coach_plural)}" required></label>
          </div>
          <div class="form-row">
            <label>Group<input name="term_group_singular" value="${escapeHtml(config.terminology.group_singular)}" required></label>
            <label>Groups<input name="term_group_plural" value="${escapeHtml(config.terminology.group_plural)}" required></label>
          </div>
        </section>

        <div class="platform-form-actions">
          <button class="primary-btn" type="submit">${mode === "create" ? "Create Facility" : "Save Configuration"}</button>
        </div>
      </form>
    `;

    const form = container.querySelector("form");
    form.facilityModuleSettings = structuredClone(config.modules);
    form.facilityProgramKeys = Object.keys(config.programs);
    initializeAppearanceEditor(form, config);
    if (mode === "create") {
      const nameInput = form.elements.name;
      const slugInput = form.elements.slug;
      let slugWasEdited = Boolean(slugInput.value);
      slugInput.addEventListener("input", () => { slugWasEdited = true; });
      nameInput.addEventListener("input", () => {
        if (slugWasEdited) return;
        slugInput.value = nameInput.value.toLowerCase().trim()
          .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      });
    }
    form.querySelector("[data-copy-registration]")?.addEventListener("click", async () => {
      const url = new URL("signup.html",window.location.href);
      url.searchParams.set("code",form.elements.registration_code.value);
      try { await copyText(url.href); showMessage("Member registration link copied."); }
      catch { showMessage(`Registration link: ${url.href}`); }
    });
    form.querySelector("[data-rotate-registration]")?.addEventListener("click", async event => {
      if (!window.confirm("Rotate this facility registration code? Existing code links will stop working; approved accounts are unchanged.")) return;
      const button=event.currentTarget;
      button.disabled = true;
      try {
        const {data,error}=await db.rpc("rotate_facility_registration_code",{p_facility_id:config.id});
        if(error) throw error;
        config.registration_code=data; form.elements.registration_code.value=data; showMessage("Facility code rotated.");
      } catch(error) {showMessage(error.message,true);} finally {button.disabled=false;}
    });
    function syncProgramFeatureControls() {
      for (const key of form.facilityProgramKeys) for (const [moduleKey] of MODULES) {
        form.elements[`program_${key}_module_${moduleKey}`].disabled = !form.elements[`module_${moduleKey}`].checked;
      }
    }
    form.querySelector("[data-add-program]").addEventListener("click", () => {
      const values = readPayload(form);
      const programs = Object.fromEntries(values.p_programs.map(program => [program.program_key, program]));
      let key = `program-${Object.keys(programs).length + 1}`;
      while (programs[key]) key = `program-${Object.keys(programs).length + 1}-${Math.random().toString(36).slice(2, 6)}`;
      programs[key] = {program_key:key,display_name:"New Program",plural_name:"New Program Members",profile_type:"general",enabled:true,module_overrides:{}};
      renderForm(container, {...config, name:values.p_name, slug:mode === "create" ? values.p_slug : config.slug,
        logo_url:values.p_logo_url,primary_color:values.p_primary_color,secondary_color:values.p_secondary_color,
        time_zone:values.p_time_zone,ui_theme:values.p_ui_theme,dashboard_content:values.p_dashboard_content,appearance_settings:values.p_appearance_settings,
        terminology:values.p_terminology,modules:values.p_modules,programs}, mode);
    });
    form.addEventListener("change", syncProgramFeatureControls);
    syncProgramFeatureControls();
    form.addEventListener("submit", saveConfiguration);
  }

  function initializeAppearanceEditor(form, config) {
    form.appearanceDraft = window.FacilityAppearance.normalize(config.appearance_settings);
    const editor = form.querySelector(".platform-dashboard-editors");
    const frame = form.querySelector(".platform-style-preview");
    function renderSectionControls() {
      editor.innerHTML = Object.entries(window.FacilityAppearance.sections).map(([role, sections]) => `
        <div><h4>${role === "member" ? "Member" : "Coach / admin"} sections</h4><ol class="platform-section-order" data-section-role="${role}">
          ${form.appearanceDraft[`${role}_order`].map((key, index, order) => `<li>
            <label><input type="checkbox" data-section-key="${key}"${form.appearanceDraft[`${role}_hidden`].includes(key) ? "" : " checked"}>${escapeHtml(sections[key])}</label>
            <button class="outline-btn" type="button" data-move="-1" data-key="${key}" aria-label="Move ${escapeHtml(sections[key])} up"${index === 0 ? " disabled" : ""}>↑</button>
            <button class="outline-btn" type="button" data-move="1" data-key="${key}" aria-label="Move ${escapeHtml(sections[key])} down"${index === order.length - 1 ? " disabled" : ""}>↓</button>
          </li>`).join("")}</ol></div>`).join("");
    }
    renderSectionControls();
    editor.addEventListener("change", event => {
      const input = event.target.closest("[data-section-key]");
      if (!input) return;
      const role = input.closest("[data-section-role]").dataset.sectionRole;
      const key = input.dataset.sectionKey;
      const hidden = new Set(form.appearanceDraft[`${role}_hidden`]);
      if (input.checked) hidden.delete(key); else hidden.add(key);
      form.appearanceDraft[`${role}_hidden`] = [...hidden];
      updatePreview();
    });
    editor.addEventListener("click", event => {
      const button = event.target.closest("[data-move]");
      if (!button) return;
      const role = button.closest("[data-section-role]").dataset.sectionRole;
      const order = form.appearanceDraft[`${role}_order`];
      const index = order.indexOf(button.dataset.key);
      const next = index + Number(button.dataset.move);
      if (next < 0 || next >= order.length) return;
      [order[index], order[next]] = [order[next], order[index]];
      renderSectionControls();
      editor.querySelector(`[data-section-role="${role}"] [data-key="${button.dataset.key}"][data-move="${button.dataset.move}"]`)?.focus();
      updatePreview();
    });
    form.querySelector("[data-style-colors]").addEventListener("click", () => {
      const colors = { performance: ["#69b7ff", "#f7f7f7"], clean: ["#325ddb", "#b7c9f4"], community: ["#936047", "#8b9d78"] }[form.elements.appearance_style.value];
      form.elements.primary_color.value = colors[0];
      form.elements.secondary_color.value = colors[1];
      updatePreview();
    });
    let pendingPreview;
    function updatePreview() {
      window.clearTimeout(pendingPreview);
      pendingPreview = window.setTimeout(renderPreview, 100);
    }
    function renderPreview() {
      const values = readPayload(form);
      const role = form.elements.appearance_preview_role.value;
      const sections = window.FacilityAppearance.sections[role];
      const payload = {
        ...config, name: values.p_name || "Your Facility", primary_color: values.p_primary_color,
        secondary_color: values.p_secondary_color, ui_theme: values.p_ui_theme,
        appearance_settings: values.p_appearance_settings, dashboard_content: values.p_dashboard_content
      };
      const modules = Object.fromEntries(values.p_modules.map(module => [module.module_key, module.enabled]));
      const moduleFor = { announcements: "announcements", attention: "habits", workouts: "workouts", ...(role === "member" ? { scores: "habits" } : {}) };
      const copy = values.p_dashboard_content;
      const content = {
        welcome: `<h2>Dashboard</h2><p>${role === "member" ? "Your training and progress at a glance." : "Your facility at a glance."}</p><p class="dashboard-welcome-line">${escapeHtml(copy[`${role}_title`])}</p><p class="dashboard-welcome-message">${escapeHtml(copy[`${role}_message`])}</p>`,
        announcements: '<p class="eyebrow">ANNOUNCEMENTS</p><h3>Build a consistent week.</h3><p>Three sessions. One day at a time. Keep the momentum going.</p>',
        feedback: '<h3>Tell us what to improve.</h3><p>Share feedback with your facility team.</p>',
        scores: role === "member" ? '<div class="stat-card"><span>Weekly habit score</span><strong>82%</strong></div><div class="stat-card"><span>Workouts this week</span><strong>2</strong></div>' : '<div class="stat-card"><span>Approved members</span><strong>24</strong></div><div class="stat-card"><span>Needs attention</span><strong>3</strong></div>',
        tools: '<h3>Your training and progress</h3><p>Workouts, habits, goals, and leaderboards.</p><button class="primary-btn" type="button" disabled>Open training</button>',
        attention: '<h3>Needs attention</h3><p>Jordan Lee · Habit follow-up</p><button class="outline-btn" type="button" disabled>View member</button>',
        workouts: '<h3>Workout review</h3><p>Lower body strength · 3 completed sessions</p>'
      };
      const markup = Object.keys(sections).map(key => {
        let hidden = (moduleFor[key] && !modules[moduleFor[key]]) || (key === "feedback" && !copy.show_feedback) || (role === "member" && key === "scores" && !copy.show_scores);
        return `<section class="${key === "welcome" ? "hero-card h2k-hero app-page-heading" : key === "scores" ? "stats-grid" : "panel"}" data-dashboard-role="${role}" data-dashboard-section="${key}"${hidden ? " hidden" : ""}>${content[key]}</section>`;
      }).join("");
      const stylesheet = new URL("css/styles.css?v=facility-styles-1", window.location.href).href;
      const designStylesheet = new URL("css/facility-styles.css?v=facility-styles-12", window.location.href).href;
      const layoutStylesheet = new URL("css/app-layout.css?v=consistent-spacing-4", window.location.href).href;
      frame.onload = () => {
        const doc = frame.contentDocument;
        if (!doc) return;
        const root = doc.documentElement;
        root.dataset.facilitySlug = config.slug || "preview";
        root.dataset.facilityTheme = values.p_ui_theme;
        root.style.setProperty("--facility-primary", values.p_primary_color);
        root.style.setProperty("--facility-secondary", values.p_secondary_color);
        root.style.setProperty("--accent", values.p_primary_color);
        root.style.setProperty("--accent-ink", window.FacilityAppearance.contrast(values.p_primary_color));
        window.FacilityAppearance.apply(payload, doc);
      };
      frame.srcdoc = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${escapeHtml(stylesheet)}"><link rel="stylesheet" href="${escapeHtml(designStylesheet)}"><link rel="stylesheet" href="${escapeHtml(layoutStylesheet)}"><style>body{min-height:0}.coach-page{width:100%;padding:20px}.panel{margin:20px 0}.stats-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.h2k-header{flex-wrap:wrap}.hero-card h3{font-size:30px}.coach-nav{display:flex;gap:12px;flex-wrap:wrap}.brand-preview{max-width:56px;max-height:56px;object-fit:contain}</style></head><body class="auth-body coach-dashboard-page"><main class="app-shell coach-page"><header class="h2k-header"><div class="auth-brand">${/^https?:\/\//i.test(values.p_logo_url) ? `<img class="brand-preview" src="${escapeHtml(values.p_logo_url)}" alt="Facility logo">` : ""}<div><h1>${escapeHtml(payload.name)}</h1><p>${role === "member" ? "Member" : "Coach / admin"} dashboard</p></div></div><nav class="coach-nav" aria-label="Preview navigation"><span class="coach-nav-link active">Dashboard</span>${modules.workouts ? '<span class="coach-nav-link">Training</span>' : ""}${modules.leaderboards ? '<span class="coach-nav-link">Leaderboards</span>' : ""}</nav></header>${markup}</main></body></html>`;
    }
    form.addEventListener("input", updatePreview);
    form.addEventListener("change", updatePreview);
    renderPreview();
  }

  function readPayload(form) {
    const data = new FormData(form);
    return {
      p_name: String(data.get("name") || "").trim(),
      p_slug: String(data.get("slug") || "").trim(),
      p_logo_url: String(data.get("logo_url") || "").trim(),
      p_primary_color: String(data.get("primary_color") || "").trim(),
      p_secondary_color: String(data.get("secondary_color") || "").trim(),
      p_time_zone: String(data.get("time_zone") || "").trim(),
      p_ui_theme: String(data.get("ui_theme") || "midnight"),
      p_appearance_settings: {
        ...window.FacilityAppearance.normalize(form.appearanceDraft),
        style: String(data.get("appearance_style") || "performance"),
        background: String(data.get("appearance_background") || "default")
      },
      p_dashboard_content: {
        member_title: String(data.get("content_member_title") || "").trim(),
        member_message: String(data.get("content_member_message") || "").trim(),
        coach_title: String(data.get("content_coach_title") || "").trim(),
        coach_message: String(data.get("content_coach_message") || "").trim(),
        show_feedback: form.elements.content_show_feedback.checked,
        show_scores: form.elements.content_show_scores.checked
      },
      p_terminology: {
        member_singular: String(data.get("term_member_singular") || "").trim(),
        member_plural: String(data.get("term_member_plural") || "").trim(),
        coach_singular: String(data.get("term_coach_singular") || "").trim(),
        coach_plural: String(data.get("term_coach_plural") || "").trim(),
        group_singular: String(data.get("term_group_singular") || "").trim(),
        group_plural: String(data.get("term_group_plural") || "").trim()
      },
      p_modules: MODULES.map(([moduleKey]) => ({
        module_key: moduleKey,
        enabled: form.elements[`module_${moduleKey}`].checked,
        settings: form.facilityModuleSettings?.[moduleKey]?.settings || {}
      })),
      p_programs: form.facilityProgramKeys.map((programKey, index) => ({
        profile_type: String(data.get(`program_${programKey}_profile_type`) || "general"),
        program_key: programKey,
        display_name: String(data.get(`program_${programKey}_display`) || "").trim(),
        plural_name: String(data.get(`program_${programKey}_plural`) || "").trim(),
        enabled: form.elements[`program_${programKey}_enabled`].checked,
        sort_order: (index + 1) * 10,
        module_overrides: Object.fromEntries(MODULES.map(([moduleKey]) => [moduleKey,
          form.elements[`program_${programKey}_module_${moduleKey}`]?.checked !== false
        ]))
      }))
    };
  }

  async function saveConfiguration(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('button[type="submit"]');
    const payload = readPayload(form);
    const isCreate = form.dataset.mode === "create";
    if (!isCreate) {
      delete payload.p_slug;
      payload.p_facility_id = form.dataset.facilityId;
    }

    submit.disabled = true;
    submit.textContent = isCreate ? "Creating..." : "Saving...";
    showMessage("");
    try {
      const rpc = isCreate ? "create_platform_facility" : "replace_platform_facility_configuration";
      const { error } = await db.rpc(rpc, payload);
      if (error) throw error;
      showMessage(isCreate ? "Facility created. You can now enter its admin mode." : "Facility configuration saved.");
      createPanel.classList.add("hidden");
      editPanel.classList.add("hidden");
      await loadFacilities();
    } catch (error) {
      showMessage(error.message || "Facility configuration could not be saved.", true);
    } finally {
      submit.disabled = false;
      submit.textContent = isCreate ? "Create Facility" : "Save Configuration";
    }
  }

  function renderFacilities() {
    if (!facilities.length) {
      list.innerHTML = '<div class="empty-state">No facilities have been created yet.</div>';
      return;
    }
    list.innerHTML = facilities.map(facility => `
      <article class="platform-facility-card">
        <div class="panel-heading">
          <div><p class="eyebrow">${escapeHtml(facility.facility_slug)}</p><h4>${escapeHtml(facility.facility_name)}</h4></div>
          <span class="platform-status">${escapeHtml(facility.facility_status)}</span>
        </div>
        <div class="platform-facility-meta">
          <span>${escapeHtml(facility.facility_time_zone)}</span>
          <span>Created ${escapeHtml(new Date(facility.created_at).toLocaleDateString())}</span>
        </div>
        <div class="platform-facility-actions">
          <button class="outline-btn" type="button" data-edit-facility="${facility.facility_id}">Configure</button>
          <button class="outline-btn" type="button" data-invite-admin="${facility.facility_id}" ${facility.facility_status !== "active" ? "disabled" : ""}>Copy First Admin Link</button>
          <button class="primary-btn" type="button" data-enter-facility="${facility.facility_id}" ${facility.facility_status !== "active" ? "disabled" : ""}>Enter Admin Mode</button>
        </div>
      </article>
    `).join("");
  }

  async function loadFacilities() {
    const { error: exitError } = await db.rpc("exit_platform_facility_admin");
    if (exitError) throw exitError;
    window.RipCityAccess.selectFacility(null);
    list.innerHTML = '<div class="empty-state">Loading facilities...</div>';
    const { data, error } = await db.rpc("list_platform_facilities");
    if (error) throw error;
    facilities = data || [];
    renderFacilities();
  }

  async function editFacility(facilityId) {
    showMessage("");
    try {
      const configuration = await window.RipCityAccess.getFacilityConfiguration(facilityId);
      document.getElementById("platform-edit-title").textContent = `Configure ${configuration.name}`;
      renderForm(document.getElementById("platform-edit-form"), configuration, "edit");
      editPanel.classList.remove("hidden");
      createPanel.classList.add("hidden");
      editPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      showMessage(error.message || "Facility configuration could not be loaded.", true);
    }
  }

  async function enterAdminMode(facilityId, button) {
    button.disabled = true;
    button.textContent = "Opening...";
    showMessage("");
    try {
      const { error } = await db.rpc("enter_platform_facility_admin", { p_facility_id: facilityId });
      if (error) throw error;
      window.RipCityAccess.selectFacility(facilityId);
      window.location.href = "coach-dashboard.html";
    } catch (error) {
      showMessage(error.message || "Admin mode could not be opened.", true);
      button.disabled = false;
      button.textContent = "Enter Admin Mode";
    }
  }

  async function createAdminInvite(facilityId, button) {
    button.disabled = true;
    button.textContent = "Creating...";
    showMessage("");
    try {
      const { data, error } = await db.rpc("create_platform_admin_invite", {
        p_facility_id: facilityId
      });
      if (error) throw error;
      if (!data?.length) throw new Error("The administrator invite could not be created.");
      const inviteUrl = buildAdminInviteUrl(data[0].invite_code);
      try {
        await copyText(inviteUrl);
        showMessage("Administrator signup link copied. It can be used once and expires in seven days.");
      } catch (copyError) {
        console.error(copyError);
        showMessage(`Copy this administrator signup link: ${inviteUrl}`, true);
      }
    } catch (error) {
      showMessage(error.message || "Administrator invite could not be created.", true);
    } finally {
      button.disabled = false;
      button.textContent = "Copy First Admin Link";
    }
  }

  async function initialize() {
    try {
      const session = await window.RipCityAccess.getSession();
      if (!session) {
        window.location.replace("login.html");
        return;
      }
      const legal = await window.RipCityAccess.getCurrentLegalAcceptance();
      if (!legal.accepted) {
        window.location.replace("legal-consent.html?next=platform.html");
        return;
      }
      const isOwner = await window.RipCityAccess.getCurrentUserIsPlatformOwner();
      if (!isOwner) {
        profile = await window.RipCityAccess.getProfileWithMemberships(session.user.id);
        const membership = window.RipCityAccess.choosePrimaryMembership(profile);
        if (!membership) {
          window.location.replace("pending.html");
        } else {
          window.location.replace(
            window.RipCityAccess.isCoachRole(membership.role)
              ? "coach-dashboard.html"
              : "member-dashboard.html"
          );
        }
        return;
      }
      window.RipCityPlatformOwner = true;
      profile = await window.RipCityAccess.getProfileWithMemberships(session.user.id);
      const ownerIdentity = document.getElementById("platform-owner-identity");
      if(ownerIdentity) ownerIdentity.textContent = `Global platform owner · ${profile.full_name || profile.email || "Owner"}`;
      renderForm(document.getElementById("platform-create-form"), defaultConfiguration(), "create");
      await loadFacilities();
    } catch (error) {
      showMessage(error.message || "Platform facilities could not be loaded.", true);
      list.innerHTML = '<div class="empty-state">Facility directory unavailable.</div>';
    }
  }

  document.getElementById("open-create-facility-btn").addEventListener("click", () => {
    createPanel.classList.remove("hidden");
    editPanel.classList.add("hidden");
    createPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.getElementById("close-create-facility-btn").addEventListener("click", () => createPanel.classList.add("hidden"));
  document.getElementById("close-edit-facility-btn").addEventListener("click", () => editPanel.classList.add("hidden"));
  document.getElementById("refresh-platform-btn").addEventListener("click", () => loadFacilities().catch(error => showMessage(error.message, true)));
  document.getElementById("platform-logout-btn").addEventListener("click", async () => {
    if (!await window.AppFeedback.signOut()) return;
    window.RipCityAccess.selectFacility(null);
    window.location.href = "login.html";
  });
  list.addEventListener("click", event => {
    const editButton = event.target.closest("[data-edit-facility]");
    if (editButton) editFacility(editButton.dataset.editFacility);
    const enterButton = event.target.closest("[data-enter-facility]");
    if (enterButton) enterAdminMode(enterButton.dataset.enterFacility, enterButton);
    const inviteButton = event.target.closest("[data-invite-admin]");
    if (inviteButton) createAdminInvite(inviteButton.dataset.inviteAdmin, inviteButton);
  });

  initialize();
})();
