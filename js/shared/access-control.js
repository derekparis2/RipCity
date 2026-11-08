// =====================================================
// SHARED ACCESS CONTROL HELPERS
// =====================================================
// One shared access path keeps every page tenant-aware. Facility coaches/admins
// should only work inside their approved facility; future platform-owner access
// should be added separately with an explicit migration.

(function () {
  const DEFAULT_REQUEST_TIMEOUT_MS = 15000;

  const MODULE_REQUIREMENTS_BY_PAGE = {
    "coach-workouts.html": ["workouts"],
    "coach-exercises.html": ["workouts"],
    "workout-session.html": ["workouts"],
    "coach-testing.html": ["testing_days"],
    "coach-leaderboards.html": ["leaderboards"],
    "member-habits.html": ["habits"],
    "member-goals.html": ["goals"],
    "member-leaderboards.html": ["leaderboards"],
    "member-training.html": ["workouts", "testing_days"]
  };

  function withTimeout(request, message = "The app took too long to respond.", timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {
    let timeoutId;
    const timeout = new Promise((resolve, reject) => {
      timeoutId = window.setTimeout(() => {
        const error = new Error(message);
        error.code = "request_timeout";
        reject(error);
      }, timeoutMs);
    });

    return Promise.race([Promise.resolve(request), timeout])
      .finally(() => window.clearTimeout(timeoutId));
  }

  function getJoinedMemberships(profile) {
    return profile?.facility_members ||
      profile?.["facility_members!facility_members_profile_id_fkey"] ||
      [];
  }

  function choosePrimaryMembership(profile) {
    const memberships = getJoinedMemberships(profile);

    return memberships.find(row => row.status === "approved") ||
      memberships[0] ||
      null;
  }

  async function getSession() {
    const { data, error } = await withTimeout(
      db.auth.getSession(),
      "Checking your session took too long. Check your connection and try again."
    );

    if (error) throw error;

    return data.session;
  }

  async function getCurrentLegalAcceptance() {
    const { data, error } = await withTimeout(
      db.rpc("get_current_legal_acceptance"),
      "Checking the current terms took too long. Check your connection and try again."
    );
    if (error) throw error;
    if (!data?.length) throw new Error("Current legal documents are not configured.");
    return data[0];
  }

  function getLegalConsentUrl() {
    const page = `${window.location.pathname.split("/").pop() || ""}${window.location.search || ""}`;
    return `legal-consent.html?next=${encodeURIComponent(page)}`;
  }

  async function getProfileWithMemberships(userId, extraProfileColumns = "") {
    const profileColumns = [
      "id",
      "email",
      "full_name",
      "global_role",
      extraProfileColumns
    ].filter(Boolean).join(",");

    const { data, error } = await withTimeout(
      db
        .from("profiles")
        .select(`
          ${profileColumns},
          facility_members:facility_members!facility_members_profile_id_fkey (
            id,
            role,
            status,
            facility_id
          )
        `)
        .eq("id", userId)
        .limit(1),
      "Loading your account took too long. Check your connection and try again."
    );

    if (error) throw error;
    if (!data?.length) throw new Error("Account profile could not be found.");

    return data[0];
  }

  function isCoachRole(role) {
    return role === "coach" || role === "admin";
  }

  function isAdminRole(role) {
    return role === "admin";
  }

  function isMemberRole(role) {
    return role === "athlete" || role === "h2k_member";
  }

  function getHomeUrlForRole(role) {
    return isCoachRole(role) ? "coach-dashboard.html" : "member-dashboard.html";
  }

  function normalizeFacilityConfiguration(configuration) {
    if (!configuration || typeof configuration !== "object") return null;

    const modules = Object.fromEntries(
      (configuration.modules || []).map(module => [module.module_key, {
        enabled: module.enabled !== false,
        settings: module.settings || {}
      }])
    );
    const programs = Object.fromEntries(
      (configuration.programs || []).map(program => [program.program_key, program])
    );

    return {
      ...configuration,
      modules,
      programs
    };
  }

  function getFacilityInitials(name) {
    return String(name || "Facility")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(word => word[0])
      .join("")
      .toUpperCase();
  }

  function applyFacilityBranding(configuration) {
    if (!configuration) return;

    document.documentElement.style.setProperty("--facility-primary", configuration.primary_color || "#69b7ff");
    document.documentElement.style.setProperty("--facility-secondary", configuration.secondary_color || "#f7f7f7");
    document.documentElement.dataset.facilitySlug = configuration.slug || "";

    document.querySelectorAll(".auth-brand h1, .brand h1").forEach(element => {
      element.textContent = String(configuration.name || "Facility").toUpperCase();
    });

    document.querySelectorAll(".auth-brand img, .brand-mark img").forEach(image => {
      const parent = image.parentElement;
      parent?.querySelector(".facility-brand-initials")?.remove();

      if (configuration.logo_url) {
        image.src = configuration.logo_url;
        image.alt = `${configuration.name} logo`;
        image.hidden = false;
        return;
      }

      // Preserve Rip City's bundled logo when its database configuration does
      // not provide a hosted logo. Other facilities receive a text monogram
      // until a logo URL is configured.
      if (configuration.slug === "rip-city") {
        image.alt = `${configuration.name} logo`;
        image.hidden = false;
        return;
      }

      image.hidden = true;
      const initials = document.createElement("span");
      initials.className = "facility-brand-initials";
      initials.textContent = getFacilityInitials(configuration.name);
      initials.setAttribute("aria-label", configuration.name || "Facility");
      parent?.prepend(initials);
    });

    if (/rip city/i.test(document.title)) {
      document.title = document.title.replace(/rip city/ig, configuration.name || "Facility");
    }
  }

  function isModuleEnabled(configuration, moduleKey) {
    return configuration?.modules?.[moduleKey]?.enabled !== false;
  }

  function isProgramEnabled(configuration, programKey) {
    return configuration?.programs?.[programKey]?.enabled !== false;
  }

  function getProgramLabel(configuration, programKey, options = {}) {
    const plural = Boolean(options.plural);
    const defaults = programKey === "h2k"
      ? { display_name: "H2K Member", plural_name: "H2K Members" }
      : { display_name: "Athlete", plural_name: "Athletes" };
    const program = configuration?.programs?.[programKey] || defaults;
    return String(plural ? program.plural_name : program.display_name);
  }

  function getFacilityTerm(configuration, termKey, fallback = "") {
    return String(configuration?.terminology?.[termKey] || fallback);
  }

  function getFacilityTimeZone(configuration = window.RipCityFacility) {
    return configuration?.time_zone || "America/New_York";
  }

  function getFacilityDateKey(date = new Date(), configuration = window.RipCityFacility) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: getFacilityTimeZone(configuration),
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));

    return `${values.year}-${values.month}-${values.day}`;
  }

  function applyFacilityLanguage(configuration) {
    document.querySelectorAll("[data-facility-program-label]").forEach(element => {
      element.textContent = getProgramLabel(
        configuration,
        element.dataset.facilityProgramLabel,
        { plural: element.dataset.labelForm === "plural" }
      );
    });

    document.querySelectorAll("[data-facility-term]").forEach(element => {
      element.textContent = getFacilityTerm(
        configuration,
        element.dataset.facilityTerm,
        element.textContent
      );
    });
  }

  function applyFacilityFeatureVisibility(configuration) {
    document.querySelectorAll("[data-facility-module]").forEach(element => {
      element.hidden = !isModuleEnabled(configuration, element.dataset.facilityModule);
    });

    document.querySelectorAll("[data-facility-modules]").forEach(element => {
      const moduleKeys = String(element.dataset.facilityModules || "")
        .split(/\s+/)
        .filter(Boolean);
      element.hidden = Boolean(moduleKeys.length) &&
        !moduleKeys.some(moduleKey => isModuleEnabled(configuration, moduleKey));
    });

    document.querySelectorAll("[data-facility-program]").forEach(element => {
      const enabled = isProgramEnabled(configuration, element.dataset.facilityProgram);
      element.hidden = !enabled;
      if (element instanceof HTMLOptionElement) {
        element.disabled = !enabled;
        if (!enabled && element.selected) element.selected = false;
      }
    });
  }

  function getRequiredModulesForCurrentPage() {
    const page = window.location.pathname.split("/").pop() || "";
    return MODULE_REQUIREMENTS_BY_PAGE[page] || [];
  }

  function currentPageHasEnabledModule(configuration) {
    const requiredModules = getRequiredModulesForCurrentPage();
    return !requiredModules.length || requiredModules.some(moduleKey => isModuleEnabled(configuration, moduleKey));
  }

  async function getFacilityConfiguration(facilityId) {
    const { data, error } = await withTimeout(
      db.rpc("get_facility_configuration", { p_facility_id: facilityId }),
      "Loading facility settings took too long. Check your connection and try again."
    );
    if (error) throw error;
    return normalizeFacilityConfiguration(data);
  }

  function publishFacilityConfiguration(configuration) {
    window.RipCityFacility = configuration;
    applyFacilityBranding(configuration);
    applyFacilityFeatureVisibility(configuration);
    applyFacilityLanguage(configuration);
    window.dispatchEvent(new CustomEvent("ripcity:facility-config", {
      detail: configuration
    }));
  }

  async function requireApprovedAccess(options = {}) {
    const {
      allowRoles = null,
      onDeniedMessage = null,
      pendingUrl = "pending.html",
      loginUrl = "login.html",
      deniedUrl = null
    } = options;

    const session = await getSession();

    if (!session) {
      window.location.href = loginUrl;
      return null;
    }

    const legalStatus = await getCurrentLegalAcceptance();
    if (!legalStatus.accepted) {
      window.location.href = getLegalConsentUrl();
      return null;
    }

    const profile = await getProfileWithMemberships(session.user.id, options.extraProfileColumns || "");
    const membership = choosePrimaryMembership(profile);

    if (!membership || membership.status !== "approved") {
      window.location.href = pendingUrl;
      return null;
    }

    if (allowRoles && !allowRoles.includes(membership.role)) {
      if (onDeniedMessage) onDeniedMessage("You do not have permission to view this page.", true);
      // RLS already prevents unauthorized data reads, but direct URL entry
      // should never leave someone looking at the wrong role's empty shell.
      window.location.replace(deniedUrl || getHomeUrlForRole(membership.role));
      return null;
    }

    const facilityConfig = await getFacilityConfiguration(membership.facility_id);
    if (!facilityConfig || facilityConfig.status !== "active") {
      if (onDeniedMessage) onDeniedMessage("This facility is not currently active.", true);
      window.location.replace("pending.html");
      return null;
    }

    publishFacilityConfiguration(facilityConfig);

    if (!currentPageHasEnabledModule(facilityConfig)) {
      if (onDeniedMessage) onDeniedMessage("This feature is not enabled for your facility.", true);
      window.location.replace(getHomeUrlForRole(membership.role));
      return null;
    }

    return {
      session,
      profile,
      membership,
      facilityId: membership.facility_id,
      isCoach: isCoachRole(membership.role),
      isAdmin: isAdminRole(membership.role),
      isPlatformOwner: profile.global_role === "platform_owner",
      facilityConfig
    };
  }

  async function requireCoachAccess(options = {}) {
    return requireApprovedAccess({
      ...options,
      allowRoles: ["coach", "admin"]
    });
  }

  async function requireMemberAccess(options = {}) {
    return requireApprovedAccess({
      ...options,
      allowRoles: ["athlete", "h2k_member"]
    });
  }

  async function getMemberProfileForMembership(facilityMemberId) {
    const { data, error } = await db
      .from("member_profiles")
      .select("*")
      .eq("facility_member_id", facilityMemberId)
      .limit(1);

    if (error) throw error;
    if (!data?.length) throw new Error("Member profile could not be found.");

    return data[0];
  }

  window.RipCityAccess = {
    choosePrimaryMembership,
    getMemberProfileForMembership,
    getCurrentLegalAcceptance,
    getFacilityConfiguration,
    getProfileWithMemberships,
    getSession,
    isAdminRole,
    isCoachRole,
    isMemberRole,
    isModuleEnabled,
    isProgramEnabled,
    getProgramLabel,
    getFacilityTerm,
    getFacilityTimeZone,
    getFacilityDateKey,
    applyFacilityBranding,
    applyFacilityFeatureVisibility,
    applyFacilityLanguage,
    requireApprovedAccess,
    requireCoachAccess,
    requireMemberAccess,
    withTimeout
  };
})();
