// =====================================================
// SHARED ACCESS CONTROL HELPERS
// =====================================================
// One shared access path keeps every page tenant-aware. Facility coaches/admins
// should only work inside their approved facility; future platform-owner access
// should be added separately with an explicit migration.

(function () {
  const DEFAULT_REQUEST_TIMEOUT_MS = 15000;

  function withTimeout(request, message = "Rip City took too long to respond.", timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {
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

    return {
      session,
      profile,
      membership,
      facilityId: membership.facility_id,
      isCoach: isCoachRole(membership.role),
      isAdmin: isAdminRole(membership.role),
      isPlatformOwner: profile.global_role === "platform_owner"
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
    getProfileWithMemberships,
    getSession,
    isAdminRole,
    isCoachRole,
    isMemberRole,
    requireApprovedAccess,
    requireCoachAccess,
    requireMemberAccess,
    withTimeout
  };
})();
