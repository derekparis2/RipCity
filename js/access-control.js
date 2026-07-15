// =====================================================
// SHARED ACCESS CONTROL HELPERS
// =====================================================
// One shared access path keeps every page tenant-aware. Facility coaches/admins
// should only work inside their approved facility; future platform-owner access
// should be added separately with an explicit migration.

(function () {
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
    const { data, error } = await db.auth.getSession();

    if (error) throw error;

    return data.session;
  }

  async function getProfileWithMemberships(userId, extraProfileColumns = "") {
    const profileColumns = [
      "id",
      "email",
      "full_name",
      "global_role",
      extraProfileColumns
    ].filter(Boolean).join(",");

    const { data, error } = await db
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
      .single();

    if (error) throw error;

    return data;
  }

  function isCoachRole(role) {
    return role === "coach" || role === "admin";
  }

  function isAdminRole(role) {
    return role === "admin";
  }

  async function requireApprovedAccess(options = {}) {
    const {
      allowRoles = null,
      onDeniedMessage = null,
      pendingUrl = "pending.html",
      loginUrl = "login.html"
    } = options;

    const session = await getSession();

    if (!session) {
      window.location.href = loginUrl;
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

  async function getMemberProfileForMembership(facilityMemberId) {
    const { data, error } = await db
      .from("member_profiles")
      .select("*")
      .eq("facility_member_id", facilityMemberId)
      .single();

    if (error) throw error;

    return data;
  }

  window.RipCityAccess = {
    choosePrimaryMembership,
    getMemberProfileForMembership,
    getProfileWithMemberships,
    getSession,
    isAdminRole,
    isCoachRole,
    requireApprovedAccess,
    requireCoachAccess
  };
})();
