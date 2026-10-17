const RIP_CITY_SLUG = "rip-city";
let signupFacility = null;
let signupGroups = [];
let signupGroupsLoaded = false;
let signupCoachInviteCode = "";
let signupCoachInvite = null;

// This file is only for public auth pages:
// signup.html, login.html, and pending.html.
// Coach approval logic lives in coach-approvals.js.

function getCurrentPage() {
  const page = window.location.pathname.split("/").pop() || "index";
  return page.replace(/\.html$/, "");
}

function showMessage(elementId, message, isError = false) {
  const element = document.getElementById(elementId);
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error-message", isError);
}

function escapeOptionText(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[char]);
}

function createClientId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, char => (
    Number(char) ^ window.crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(char) / 4
  ).toString(16));
}

async function getRipCityFacility() {
  // Signup currently joins everyone to the seeded Rip City facility.
  // Later this can be invite-code driven for other facilities.
  const { data, error } = await db
    .from("facilities")
    .select("id, name, slug")
    .eq("slug", RIP_CITY_SLUG)
    .single();

  if (error) throw error;
  return data;
}

async function loadSignupGroups(facilityId) {
  const { data, error } = await db
    .from("groups")
    .select("id, name, group_type, member_type")
    .eq("facility_id", facilityId)
    .in("member_type", ["athlete", "both"])
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
}

function renderSignupGroups(groups) {
  const select = document.getElementById("signup-training-group");
  if (!select) return;

  if (!groups.length) {
    select.innerHTML = `<option value="">No athlete groups available</option>`;
    return;
  }

  select.innerHTML = `
    <option value="">Select training group</option>
    ${groups.map(group => `
      <option value="${group.id}">${escapeOptionText(group.name)}</option>
    `).join("")}
  `;
}

async function ensureSignupGroupsLoaded() {
  if (signupGroupsLoaded) return;

  signupFacility = signupFacility || await getRipCityFacility();
  signupGroups = await loadSignupGroups(signupFacility.id);
  signupGroupsLoaded = true;
  renderSignupGroups(signupGroups);
}

async function getCurrentUserProfile(userId) {
  const { data, error } = await db
    .from("profiles")
    .select(`
      id,
      email,
      full_name,
      global_role,
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

async function redirectByProfile(userId) {
  const profile = await getCurrentUserProfile(userId);
  const memberships = profile.facility_members ||
    profile["facility_members!facility_members_profile_id_fkey"] || [];
  const membership = memberships.find(row => row.status === "approved") || memberships[0];

  if (!membership || membership.status !== "approved") {
    window.location.href = "pending.html";
    return;
  }

  if (membership.role === "coach" || membership.role === "admin") {
    window.location.href = "coach-dashboard.html";
    return;
  }

  // Athletes and H2K members share the member dashboard. Program-specific
  // modules such as H2K habits are enabled from member profile data.
  window.location.href = "member-dashboard.html";
}

function getPasswordRedirectUrl() {
  return `${window.location.origin}/set-password.html`;
}

function getAuthLinkHash() {
  return window.__ripAuthHash || window.location.hash || "";
}

function shouldHandlePasswordLink() {
  const params = new URLSearchParams(getAuthLinkHash().replace(/^#/, ""));
  return (
    params.has("access_token") &&
    ["invite", "recovery"].includes(String(params.get("type") || "").toLowerCase())
  );
}

function normalizeUsername(value) {
  return value.trim().replace(/^@/, "").toLowerCase();
}

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

function isEmailIdentifier(value) {
  return value.includes("@");
}

async function resolveLoginEmail(identifier) {
  const normalizedIdentifier = identifier.trim();

  if (isEmailIdentifier(normalizedIdentifier)) {
    return normalizedIdentifier;
  }

  const { data, error } = await db.rpc("resolve_login_identifier", {
    login_identifier: normalizeUsername(normalizedIdentifier)
  });

  if (error) throw error;
  if (!data) throw new Error("No account found for that username.");

  return data;
}

async function getSignupUser({ email, password, fullName, allowExistingAccount }) {
  if (allowExistingAccount) {
    const { data: sessionData, error: sessionError } = await db.auth.getSession();
    if (sessionError) throw sessionError;

    const sessionUser = sessionData.session?.user;
    if (sessionUser) {
      if (normalizeEmail(sessionUser.email || "") !== normalizeEmail(email)) {
        throw new Error("Log out of the current account before using this coach invite.");
      }
      return sessionUser;
    }
  }

  const { data: authData, error: authError } = await db.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName
      }
    }
  });

  if (authError) throw authError;
  if (authData.session?.user) return authData.session.user;

  // Supabase intentionally returns no session when signUp is called for an
  // existing account. A coach whose first invite claim was interrupted can
  // prove ownership with the same password and resume using a fresh link.
  if (allowExistingAccount) {
    const { data: loginData, error: loginError } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (!loginError && loginData.user) return loginData.user;
  }

  return null;
}

async function ensureSignupProfile({ user, email, fullName, username }) {
  const { data: existingProfile, error: existingProfileError } = await db
    .from("profiles")
    .select("id, email, username")
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfileError) throw existingProfileError;

  if (existingProfile) {
    if (
      normalizeEmail(existingProfile.email || "") !== normalizeEmail(email)
      || normalizeUsername(existingProfile.username || "") !== username
    ) {
      throw new Error("Use the email and username already saved for this account.");
    }
    return;
  }

  const { error: profileError } = await db
    .from("profiles")
    .insert({
      id: user.id,
      email,
      full_name: fullName,
      username,
      global_role: "member"
    });

  if (profileError) throw profileError;
}

async function handleSignup(event) {
  event.preventDefault();

  showMessage("signup-message", "Creating your account...");

  const isCoachSignup = Boolean(signupCoachInviteCode);
  const fullName = document.getElementById("signup-full-name").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const username = normalizeUsername(document.getElementById("signup-username").value);
  const password = document.getElementById("signup-password").value;
  const confirmPassword = document.getElementById("signup-confirm-password").value;
  const memberType = isCoachSignup
    ? null
    : document.querySelector("input[name='member-type']:checked").value;

  const trainingGroupId = document.getElementById("signup-training-group")?.value || "";
  const sport = document.getElementById("signup-sport").value.trim();
  const position = document.getElementById("signup-position").value.trim();
  const school = document.getElementById("signup-school").value.trim();
  const graduationYear = document.getElementById("signup-grad-year").value;
  const bodyWeight = document.getElementById("signup-body-weight").value;
  let coachProfileReady = false;

  try {
    if (password !== confirmPassword) {
      showMessage("signup-message", "Passwords must match.", true);
      return;
    }

    if (!username) {
      showMessage("signup-message", "Username is required.", true);
      return;
    }

    const existingUsernameEmail = await resolveLoginEmail(username).catch(error => {
      if (/No account found/i.test(error.message || "")) return null;
      throw error;
    });

    if (
      existingUsernameEmail
      && (!isCoachSignup || normalizeEmail(existingUsernameEmail) !== normalizeEmail(email))
    ) {
      showMessage("signup-message", "That username is already taken.", true);
      return;
    }

    if (isCoachSignup && !signupCoachInvite) {
      showMessage("signup-message", "This coach invite is invalid, expired, or has already been used.", true);
      return;
    }

    if (memberType === "athlete" && !trainingGroupId) {
      showMessage("signup-message", "Choose a training group before creating your account.", true);
      return;
    }

    const user = await getSignupUser({
      email,
      password,
      fullName,
      allowExistingAccount: isCoachSignup
    });

    if (!user) {
      showMessage(
        "signup-message",
        "Account created. Check your email to confirm your account, then log in.",
        false
      );
      return;
    }

    await ensureSignupProfile({ user, email, fullName, username });
    coachProfileReady = isCoachSignup;

    if (isCoachSignup) {
      const { data: claimedInvite, error: claimError } = await db.rpc("claim_coach_invite", {
        claim_invite_code: signupCoachInviteCode
      });

      if (claimError) throw claimError;
      if (!claimedInvite?.length) throw new Error("The coach invite could not be claimed.");

      window.location.href = "pending.html";
      return;
    }

    const facility = signupFacility || await getRipCityFacility();

    const role = memberType === "athlete" ? "athlete" : "h2k_member";

    // facility_members controls approval/access for the facility.
    const { data: facilityMember, error: memberError } = await db
      .from("facility_members")
      .insert({
        facility_id: facility.id,
        profile_id: user.id,
        role,
        status: "pending"
      })
      .select("id")
      .single();

    if (memberError) throw memberError;

    const memberProfileId = createClientId();

    // member_profiles stores program-specific member details.
    const { error: memberProfileError } = await db
      .from("member_profiles")
      .insert({
        id: memberProfileId,
        facility_member_id: facilityMember.id,
        member_type: memberType,
        sport: memberType === "athlete" ? sport || null : null,
        age_group: null,
        position: memberType === "athlete" ? position || null : null,
        school: memberType === "athlete" ? school || null : null,
        graduation_year: graduationYear ? Number(graduationYear) : null,
        body_weight: bodyWeight ? Number(bodyWeight) : null
      });

    if (memberProfileError) throw memberProfileError;

    if (memberType === "athlete") {
      const { error: groupMemberError } = await db
        .from("group_members")
        .insert({
          group_id: trainingGroupId,
          member_profile_id: memberProfileId
        });

      if (groupMemberError) throw groupMemberError;
    }

    window.location.href = "pending.html";
  } catch (error) {
    console.error(error);
    if (isCoachSignup && coachProfileReady) {
      showMessage(
        "signup-message",
        "Your account was saved, but this coach link could not be claimed. Ask the facility administrator for a new link, then use this same email, username, and password.",
        true
      );
      return;
    }
    showMessage("signup-message", error.message || "Something went wrong while creating your account.", true);
  }
}

async function handleLogin(event) {
  event.preventDefault();

  showMessage("login-message", "Logging in...");

  const identifier = document.getElementById("login-identifier").value.trim();
  const password = document.getElementById("login-password").value;

  try {
    const email = await resolveLoginEmail(identifier);

    const { data, error } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    await redirectByProfile(data.user.id);
  } catch (error) {
    console.error(error);
    showMessage("login-message", error.message || "Login failed.", true);
  }
}

async function handleForgotPassword() {
  const identifier = document.getElementById("login-identifier").value.trim();

  if (!identifier) {
    showMessage("login-message", "Enter your email or username first, then reset your password.", true);
    return;
  }

  showMessage("login-message", "Sending password setup link...");

  try {
    const email = await resolveLoginEmail(identifier);
    const { error } = await db.auth.resetPasswordForEmail(email, {
      redirectTo: getPasswordRedirectUrl()
    });

    if (error) throw error;
    showMessage("login-message", "Check your email for a password setup link.");
  } catch (error) {
    console.error(error);
    showMessage("login-message", error.message || "Could not send password setup link.", true);
  }
}

async function handleSetPassword(event) {
  event.preventDefault();

  const password = document.getElementById("new-password").value;
  const confirmPassword = document.getElementById("confirm-new-password").value;

  if (password !== confirmPassword) {
    showMessage("set-password-message", "Passwords must match.", true);
    return;
  }

  showMessage("set-password-message", "Saving password...");

  try {
    const { data: sessionData } = await db.auth.getSession();

    if (!sessionData.session?.user) {
      showMessage("set-password-message", "This password setup link is expired. Use Forgot password to send a new link.", true);
      return;
    }

    const { data, error } = await db.auth.updateUser({ password });
    if (error) throw error;

    showMessage("set-password-message", "Password saved. Taking you to Rip City...");
    await redirectByProfile(data.user.id);
  } catch (error) {
    console.error(error);
    showMessage("set-password-message", error.message || "Could not save password.", true);
  }
}

async function setupSetPasswordPage() {
  showMessage("set-password-message", "Checking your password setup link...");

  try {
    const { data } = await db.auth.getSession();

    if (!data.session?.user) {
      showMessage("set-password-message", "This password setup link is expired. Use Forgot password from the login page to send a new one.", true);
    } else {
      showMessage("set-password-message", "Create a password for your Rip City account.");
    }
  } catch (error) {
    console.error(error);
    showMessage("set-password-message", "Could not verify this password setup link.", true);
  }

  document.getElementById("set-password-form").addEventListener("submit", handleSetPassword);
}

async function handlePendingLogout() {
  await db.auth.signOut();
  window.location.href = "login.html";
}

function updateSignupMemberTypeFields() {
  const selected = document.querySelector("input[name='member-type']:checked").value;
  const athleteFields = document.querySelectorAll(".athlete-only");
  const trainingGroup = document.getElementById("signup-training-group");
  const isAthlete = selected === "athlete";

  athleteFields.forEach(field => {
    field.classList.toggle("hidden", !isAthlete);

    field.querySelectorAll("input, select, textarea").forEach(input => {
      input.disabled = !isAthlete;
    });
  });

  if (trainingGroup) {
    trainingGroup.required = isAthlete;

    if (!isAthlete) {
      trainingGroup.value = "";
    }
  }
}

async function handleSignupMemberTypeChange() {
  updateSignupMemberTypeFields();

  if (document.querySelector("input[name='member-type']:checked")?.value !== "athlete") {
    showMessage("signup-message", "");
    return;
  }

  showMessage("signup-message", "Loading training groups...");

  try {
    await ensureSignupGroupsLoaded();
    showMessage("signup-message", "");
  } catch (error) {
    console.error(error);
    renderSignupGroups([]);
    showMessage("signup-message", "Could not load training groups. Ask a coach to check signup group access.", true);
  }
}

function setupMemberTypeToggle() {
  const memberTypeInputs = document.querySelectorAll("input[name='member-type']");

  memberTypeInputs.forEach(input => {
    input.addEventListener("change", handleSignupMemberTypeChange);
  });

  updateSignupMemberTypeFields();
}

function applySignupTypeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const type = String(params.get("type") || "").toLowerCase();

  if (!["athlete", "h2k"].includes(type)) return;

  const input = document.querySelector(`input[name='member-type'][value='${type}']`);
  if (!input) return;

  input.checked = true;
  updateSignupMemberTypeFields();
}

function getCoachInviteCodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return String(params.get("coach_invite") || "").trim();
}

function setSignupSubmitDisabled(disabled) {
  const button = document.querySelector("#signup-form button[type='submit']");
  if (button) button.disabled = disabled;
}

function applyCoachSignupLayout() {
  document.getElementById("signup-eyebrow").textContent = "JOIN COACHING STAFF";
  document.getElementById("signup-title").textContent = "Create Coach Account";
  document.getElementById("signup-member-type-grid").classList.add("hidden");

  document.querySelectorAll(".athlete-only, .member-only").forEach(section => {
    section.classList.add("hidden");
    section.querySelectorAll("input, select, textarea").forEach(input => {
      input.disabled = true;
      input.required = false;
    });
  });
}

async function setupCoachSignupPage() {
  applyCoachSignupLayout();
  setSignupSubmitDisabled(true);
  showMessage("signup-message", "Checking coach invite...");

  try {
    const { data, error } = await db.rpc("lookup_coach_invite", {
      lookup_invite_code: signupCoachInviteCode
    });

    if (error) throw error;
    if (!data?.length) throw new Error("This coach invite is invalid, expired, or has already been used.");

    signupCoachInvite = data[0];
    document.getElementById("signup-description").textContent =
      `Create your coach account for ${signupCoachInvite.facility_name}. A facility administrator must approve it before you receive access.`;
    showMessage("signup-message", "");
    setSignupSubmitDisabled(false);
  } catch (error) {
    console.error(error);
    signupCoachInvite = null;
    document.getElementById("signup-description").textContent =
      "Ask a facility administrator to create a new coach signup link.";
    showMessage("signup-message", error.message || "Could not verify this coach invite.", true);
  }

  document.getElementById("signup-form").addEventListener("submit", handleSignup);
}

async function setupSignupPage() {
  signupCoachInviteCode = getCoachInviteCodeFromUrl();

  if (signupCoachInviteCode) {
    await setupCoachSignupPage();
    return;
  }

  setupMemberTypeToggle();
  applySignupTypeFromUrl();

  try {
    signupFacility = await getRipCityFacility();
    if (document.querySelector("input[name='member-type']:checked")?.value === "athlete") {
      await ensureSignupGroupsLoaded();
    }
    updateSignupMemberTypeFields();
  } catch (error) {
    console.error(error);
    renderSignupGroups([]);
    if (document.querySelector("input[name='member-type']:checked")?.value === "athlete") {
      showMessage("signup-message", "Could not load training groups. Ask a coach to check signup group access.", true);
    }
  }

  document.getElementById("signup-form").addEventListener("submit", handleSignup);
}

async function setupPendingPage() {
  document.getElementById("pending-logout-btn").addEventListener("click", handlePendingLogout);

  try {
    const { data } = await db.auth.getSession();
    if (!data.session?.user) {
      window.location.href = "login.html";
      return;
    }

    const profile = await getCurrentUserProfile(data.session.user.id);
    const memberships = profile.facility_members ||
      profile["facility_members!facility_members_profile_id_fkey"] || [];
    const membership = memberships.find(row => row.status === "approved") || memberships[0] || null;

    if (membership?.status === "approved") {
      await redirectByProfile(profile.id);
      return;
    }

    const statusContent = {
      pending: {
        eyebrow: "AWAITING APPROVAL",
        title: membership?.role === "coach" ? "Coach Approval Pending" : "Account Approval Pending",
        description: membership?.role === "coach"
          ? "Your coach account was created successfully. A facility administrator must approve it before you can access coaching tools."
          : "Your account was created successfully. A facility coach or administrator must approve it before you can access the app."
      },
      rejected: {
        eyebrow: "ACCESS NOT APPROVED",
        title: "Account Not Approved",
        description: "This account was not approved for facility access. Contact a facility administrator if you believe this should be reviewed."
      },
      inactive: {
        eyebrow: "ACCESS PAUSED",
        title: "Account Inactive",
        description: "Your facility access has been paused. Your account history is still saved. Contact a facility administrator to request reactivation."
      },
      none: {
        eyebrow: "NO FACILITY ACCESS",
        title: "Account Not Connected",
        description: "This account is not connected to a facility. Contact a facility administrator for help."
      }
    };
    const content = statusContent[membership?.status] || statusContent.none;

    document.title = content.title;
    document.getElementById("account-status-eyebrow").textContent = content.eyebrow;
    document.getElementById("account-status-title").textContent = content.title;
    document.getElementById("pending-description").textContent = content.description;
  } catch (error) {
    console.error(error);
    document.getElementById("account-status-eyebrow").textContent = "ACCESS ERROR";
    document.getElementById("account-status-title").textContent = "Could Not Check Access";
    document.getElementById("pending-description").textContent =
      "We could not confirm your account status. Log out and try again, or contact a facility administrator.";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const currentPage = getCurrentPage();

  if (currentPage === "signup") {
    setupSignupPage();
  }

  if (currentPage === "login") {
    if (shouldHandlePasswordLink()) {
      window.location.replace(`set-password.html${getAuthLinkHash()}`);
      return;
    }

    document.getElementById("login-form").addEventListener("submit", handleLogin);
    document.getElementById("forgot-password-btn").addEventListener("click", handleForgotPassword);
  }

  if (currentPage === "set-password" || currentPage === "reset-password") {
    setupSetPasswordPage();
  }

  if (currentPage === "pending") {
    setupPendingPage();
  }
});
