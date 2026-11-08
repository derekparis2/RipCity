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

  let profile = null;
  let facilities = [];

  const message = document.getElementById("platform-message");
  const list = document.getElementById("platform-facility-list");
  const createPanel = document.getElementById("platform-create-panel");
  const editPanel = document.getElementById("platform-edit-panel");

  function showMessage(text, isError = false) {
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
      terminology: { ...DEFAULT_TERMINOLOGY },
      modules: Object.fromEntries(MODULES.map(([key]) => [key, { enabled: true, settings: {} }])),
      programs: {
        athlete: { program_key: "athlete", display_name: "Athlete", plural_name: "Athletes", enabled: true, sort_order: 10 },
        h2k: { program_key: "h2k", display_name: "H2K Member", plural_name: "H2K Members", enabled: true, sort_order: 20 }
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
        : { ...base.programs, ...(configuration.programs || {}) }
    };
  }

  function renderForm(container, configuration, mode) {
    const config = normalizeConfig(configuration);
    const slugField = mode === "create" ? `
      <label>Facility Slug<input name="slug" value="${escapeHtml(config.slug)}" placeholder="new-facility" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*"></label>
    ` : `<label>Facility Slug<input value="${escapeHtml(config.slug)}" disabled></label>`;

    container.innerHTML = `
      <form class="platform-config-form" data-platform-config-form data-mode="${mode}" data-facility-id="${escapeHtml(config.id || "")}">
        <section class="platform-config-section">
          <h4>Identity &amp; location</h4>
          <div class="form-row">
            <label>Facility Name<input name="name" value="${escapeHtml(config.name)}" required></label>
            ${slugField}
          </div>
          <div class="form-row">
            <label>IANA Time Zone<input name="time_zone" value="${escapeHtml(config.time_zone)}" required placeholder="America/New_York"></label>
            <label>Logo URL<input name="logo_url" type="url" value="${escapeHtml(config.logo_url || "")}" placeholder="https://..."></label>
          </div>
          <div class="form-row">
            <label>Primary Color<input name="primary_color" type="color" value="${escapeHtml(config.primary_color || "#69b7ff")}"></label>
            <label>Secondary Color<input name="secondary_color" type="color" value="${escapeHtml(config.secondary_color || "#f7f7f7")}"></label>
          </div>
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
          <div class="platform-program-grid">
            ${["athlete", "h2k"].map(key => {
              const program = config.programs[key];
              return `
                <div class="platform-option-card">
                  <label><input type="checkbox" name="program_${key}_enabled" ${program.enabled !== false ? "checked" : ""}><span>Enable ${key === "athlete" ? "Athlete" : "H2K"}</span></label>
                  <label>Singular label<input name="program_${key}_display" value="${escapeHtml(program.display_name)}" required></label>
                  <label>Plural label<input name="program_${key}_plural" value="${escapeHtml(program.plural_name)}" required></label>
                </div>
              `;
            }).join("")}
          </div>
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
    if (mode === "create") {
      const nameInput = form.elements.name;
      const slugInput = form.elements.slug;
      let slugWasEdited = false;
      slugInput.addEventListener("input", () => { slugWasEdited = true; });
      nameInput.addEventListener("input", () => {
        if (slugWasEdited) return;
        slugInput.value = nameInput.value.toLowerCase().trim()
          .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      });
    }
    form.addEventListener("submit", saveConfiguration);
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
        settings: {}
      })),
      p_programs: ["athlete", "h2k"].map((programKey, index) => ({
        program_key: programKey,
        display_name: String(data.get(`program_${programKey}_display`) || "").trim(),
        plural_name: String(data.get(`program_${programKey}_plural`) || "").trim(),
        enabled: form.elements[`program_${programKey}_enabled`].checked,
        sort_order: (index + 1) * 10
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
    window.RipCityAccess.selectFacility(null);
    await db.auth.signOut();
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
