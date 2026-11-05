const LEGAL_ACKNOWLEDGMENT_VERSION = "2026-10-25";
let signupCoachInviteCode = "";
let signupCoachInvite = null;
let signupInProgress = false;
let loginInProgress = false;
const AUTH_REQUEST_TIMEOUT_MS = 15000;
let currentAuthAttempt = null;

// This file is only for public auth pages:
// signup.html, login.html, and pending.html.
// Coach approval logic lives in coach-approvals.js.

function getCurrentPage() {
  const page = window.location.pathname.split("/").pop() || "index";
  return page.replace(/\.html$/, "");
}

function createAuthAttempt(type) {
  const randomPart = window.crypto?.randomUUID?.().slice(0, 8)
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  currentAuthAttempt = {
    id: randomPart.toUpperCase(),
    type,
    stage: "started",
    startedAt: new Date().toISOString()
  };
  window.__ripCityLastAuthAttempt = currentAuthAttempt;
  return currentAuthAttempt;
}

function setAuthStage(stage) {
  if (currentAuthAttempt) currentAuthAttempt.stage = stage;
}

function getAuthReference(error) {
  const attempt = currentAuthAttempt;
  if (!attempt) return "";
  const stage = error?.authStage || attempt.stage || "unknown";
  return ` Reference ${attempt.id} (${stage}).`;
}

async function runAuthStage(stage, operation) {
  setAuthStage(stage);
  try {
    return await operation();
  } catch (error) {
    error.authStage ||= stage;
    throw error;
  }
}

async function recoverAuthenticatedUser(expectedEmail = "") {
  // A timed-out fetch is not cancelled by Promise.race. Give the Supabase
  // client a moment to receive a late successful response before telling the
  // user to submit again.
  await new Promise(resolve => window.setTimeout(resolve, 600));
  const { data, error } = await db.auth.getSession();
  if (error) return null;
  const user = data.session?.user || null;
  if (user && expectedEmail && normalizeEmail(user.email || "") !== normalizeEmail(expectedEmail)) {
    return null;
  }
  return user;
}

function showMessage(elementId, message, isError = false) {
  const element = document.getElementById(elementId);
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error-message", isError);
}

function withAuthTimeout(request, message, timeoutMs = AUTH_REQUEST_TIMEOUT_MS) {
  let timeoutId;
  const timeout = new Promise((resolve, reject) => {
    timeoutId = window.setTimeout(() => {
      const error = new Error(message || "Rip City took too long to respond.");
      error.code = "request_timeout";
      reject(error);
    }, timeoutMs);
  });

  return Promise.race([Promise.resolve(request), timeout])
    .finally(() => window.clearTimeout(timeoutId));
}

function getAuthErrorMessage(error, fallbackMessage) {
  const message = String(error?.message || "");
  const code = String(error?.code || "");
  const status = Number(error?.status || 0);

  if (
    status === 429
    || code === "over_email_send_rate_limit"
    || /rate limit|too many requests|email.*limit/i.test(message)
  ) {
    return "Too many account emails were requested. Wait about an hour, then try again. If you already created an account, use Log In instead.";
  }

  if (code === "request_timeout") {
    return "Rip City took too long to respond. Check your connection, then try again. Your first request may still have finished.";
  }

  if (code === "invalid_credentials" || /invalid login credentials/i.test(message)) {
    return "The email, username, or password is incorrect.";
  }

  if (code === "user_already_exists" || /already (registered|exists)/i.test(message)) {
    return "An account already exists for that email. Use the same password to finish signup, or log in.";
  }

  return message || fallbackMessage;
}

function setFormSubmitState(formId, disabled, busyLabel, idleLabel) {
  const button = document.querySelector(`#${formId} button[type='submit']`);
  if (!button) return;
  button.disabled = disabled;
  button.textContent = disabled ? busyLabel : idleLabel;
}

async function getCurrentUserProfile(userId) {
  const { data, error } = await withAuthTimeout(
    db
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
      .single(),
    "Loading the account profile took too long."
  );

  if (error) throw error;
  return data;
}

async function getCurrentLegalAcceptance() {
  const { data, error } = await withAuthTimeout(
    db.rpc("get_current_legal_acceptance"),
    "Checking the current terms took too long."
  );
  if (error) throw error;
  if (!data?.length) throw new Error("Current legal documents are not configured.");
  return data[0];
}

function getLegalConsentUrl(nextPage = "") {
  const safeNext = String(nextPage || "").replace(/^\/+/, "");
  return safeNext
    ? `legal-consent.html?next=${encodeURIComponent(safeNext)}`
    : "legal-consent.html";
}

async function redirectByProfile(userId, options = {}) {
  if (!options.skipLegalCheck) {
    const legalStatus = await getCurrentLegalAcceptance();
    if (!legalStatus.accepted) {
      window.location.href = getLegalConsentUrl();
      return;
    }
  }

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
  // program-specific profile fields are enabled from member profile data.
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

  const { data, error } = await withAuthTimeout(
    db.rpc("resolve_login_identifier", {
      login_identifier: normalizeUsername(normalizedIdentifier)
    }),
    "Looking up that username took too long."
  );

  if (error) throw error;
  if (!data) throw new Error("No account found for that username.");

  return data;
}

async function getSignupUser({ email, password, fullName, allowExistingAccount, legalAcknowledgment }) {
  if (allowExistingAccount) {
    const { data: sessionData, error: sessionError } = await withAuthTimeout(
      db.auth.getSession(),
      "Checking the current account took too long."
    );
    if (sessionError) throw sessionError;

    const sessionUser = sessionData.session?.user;
    if (sessionUser) {
      if (normalizeEmail(sessionUser.email || "") !== normalizeEmail(email)) {
        throw new Error("Log out of the current account before using this coach invite.");
      }

      const { data: updatedUserData, error: updateUserError } = await withAuthTimeout(
        db.auth.updateUser({ data: legalAcknowledgment }),
        "Updating the current account took too long."
      );
      if (updateUserError) throw updateUserError;
      return updatedUserData.user || sessionUser;
    }
  }

  const { data: authData, error: authError } = await withAuthTimeout(
    db.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          ...legalAcknowledgment
        }
      }
    }),
    "Creating the account took too long."
  );

  const existingAccountResponse = allowExistingAccount && (
    authError?.code === "user_already_exists"
    || /already (registered|exists)/i.test(authError?.message || "")
    || Boolean(
      authData?.user
      && Array.isArray(authData.user.identities)
      && authData.user.identities.length === 0
    )
  );

  if (authError && !existingAccountResponse) throw authError;
  if (authData?.session?.user) return authData.session.user;

  // Supabase intentionally returns no session when signUp is called for an
  // existing account. A coach whose first invite claim was interrupted can
  // prove ownership with the same password and resume using a fresh link.
  if (existingAccountResponse) {
    const { data: loginData, error: loginError } = await withAuthTimeout(
      db.auth.signInWithPassword({ email, password }),
      "Resuming the existing account took too long."
    );

    if (loginError) throw loginError;
    if (!loginError && loginData.user) {
      const { data: updatedUserData, error: updateUserError } = await withAuthTimeout(
        db.auth.updateUser({ data: legalAcknowledgment }),
        "Updating the existing account took too long."
      );
      if (updateUserError) throw updateUserError;
      return updatedUserData.user || loginData.user;
    }
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

  if (signupInProgress) return;
  signupInProgress = true;
  createAuthAttempt("signup");
  setFormSubmitState("signup-form", true, "Creating Account...", "Create Account");

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

  const sport = document.getElementById("signup-sport").value.trim();
  const position = document.getElementById("signup-position").value.trim();
  const school = document.getElementById("signup-school").value.trim();
  const graduationYear = document.getElementById("signup-grad-year").value;
  const bodyWeight = document.getElementById("signup-body-weight").value;
  const ageBracket = document.querySelector("input[name='signup-age-bracket']:checked")?.value || "";
  const guardianPermissionConfirmed = ageBracket === "13_to_17";
  const legalTermsConfirmed = document.getElementById("signup-legal-confirmation").checked;
  const legalAcknowledgment = {
    age_bracket: ageBracket,
    age_13_or_older_confirmed: Boolean(ageBracket),
    guardian_permission_confirmed: guardianPermissionConfirmed,
    legal_terms_confirmed: legalTermsConfirmed,
    legal_acknowledgment_version: LEGAL_ACKNOWLEDGMENT_VERSION,
    legal_acknowledged_at: new Date().toISOString()
  };
  let coachProfileReady = false;

  try {
    if (!ageBracket || !legalTermsConfirmed) {
      showMessage("signup-message", "Choose your age confirmation and accept the Terms and Privacy Policy.", true);
      return;
    }

    if (password !== confirmPassword) {
      showMessage("signup-message", "Passwords must match.", true);
      return;
    }

    if (!username) {
      showMessage("signup-message", "Username is required.", true);
      return;
    }

    const existingUsernameEmail = await runAuthStage("username-check", () => resolveLoginEmail(username)).catch(error => {
      if (/No account found/i.test(error.message || "")) return null;
      throw error;
    });

    if (
      existingUsernameEmail
      && normalizeEmail(existingUsernameEmail) !== normalizeEmail(email)
    ) {
      showMessage(
        "signup-message",
        "That username belongs to an existing Rip City profile. Log in to that account or choose another username.",
        true
      );
      return;
    }

    if (isCoachSignup && !signupCoachInvite) {
      showMessage("signup-message", "This coach invite is invalid, expired, or has already been used.", true);
      return;
    }

    let user;
    try {
      user = await runAuthStage("create-auth-account", () => getSignupUser({
        email,
        password,
        fullName,
        allowExistingAccount: true,
        legalAcknowledgment
      }));
    } catch (error) {
      if (error.code !== "request_timeout") throw error;
      user = await recoverAuthenticatedUser(email);
      if (!user) throw error;
    }

    if (!user) {
      showMessage(
        "signup-message",
        "Account created. Check your email to confirm your account, then log in.",
        false
      );
      return;
    }

    const { error: legalAcceptanceError } = await runAuthStage("save-legal-acceptance", () => withAuthTimeout(
      db.rpc("record_current_legal_acceptance", {
        p_age_bracket: ageBracket,
        p_guardian_permission_confirmed: guardianPermissionConfirmed,
        p_legal_terms_confirmed: legalTermsConfirmed
      }),
      "Saving the legal acceptance took too long."
    ));
    if (legalAcceptanceError) throw legalAcceptanceError;

    if (isCoachSignup) {
      await ensureSignupProfile({ user, email, fullName, username });
      coachProfileReady = true;

      const { data: claimedInvite, error: claimError } = await withAuthTimeout(
        db.rpc("claim_coach_invite", {
          claim_invite_code: signupCoachInviteCode
        }),
        "Claiming the coach invite took too long."
      );

      if (claimError) throw claimError;
      if (!claimedInvite?.length) throw new Error("The coach invite could not be claimed.");

      window.location.href = "pending.html";
      return;
    }

    const { data: completedSignup, error: completionError } = await runAuthStage("complete-member-profile", () => withAuthTimeout(
      db.rpc("complete_member_signup", {
        p_full_name: fullName,
        p_username: username,
        p_member_type: memberType,
        p_sport: sport || null,
        p_position: position || null,
        p_school: school || null,
        p_graduation_year: graduationYear ? Number(graduationYear) : null,
        p_body_weight: bodyWeight ? Number(bodyWeight) : null
      }),
      "Finishing the Rip City account took too long."
    ));

    if (completionError) throw completionError;
    if (!completedSignup?.length) throw new Error("The Rip City account could not be completed.");

    if (completedSignup[0].membership_status === "pending") {
      window.location.href = "pending.html";
      return;
    }

    await redirectByProfile(user.id);
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
    showMessage(
      "signup-message",
      `${getAuthErrorMessage(error, "Something went wrong while creating your account.")}${getAuthReference(error)}`,
      true
    );
  } finally {
    signupInProgress = false;
    setFormSubmitState("signup-form", false, "Creating Account...", "Create Account");
  }
}

async function handleLogin(event) {
  event.preventDefault();

  if (loginInProgress) return;
  loginInProgress = true;
  createAuthAttempt("login");
  setFormSubmitState("login-form", true, "Logging In...", "Log In");

  showMessage("login-message", "Logging in...");

  const identifier = document.getElementById("login-identifier").value.trim();
  const password = document.getElementById("login-password").value;

  try {
    const email = await runAuthStage("resolve-login", () => resolveLoginEmail(identifier));

    let data;
    try {
      const response = await runAuthStage("password-login", () => withAuthTimeout(
        db.auth.signInWithPassword({ email, password }),
        "Login took too long."
      ));
      if (response.error) throw response.error;
      data = response.data;
    } catch (error) {
      if (error.code !== "request_timeout") throw error;
      const recoveredUser = await recoverAuthenticatedUser(email);
      if (!recoveredUser) throw error;
      data = { user: recoveredUser };
    }

    await runAuthStage("load-destination", () => redirectByProfile(data.user.id));
  } catch (error) {
    console.error(error);
    showMessage(
      "login-message",
      `${getAuthErrorMessage(error, "Login failed.")}${getAuthReference(error)}`,
      true
    );
  } finally {
    loginInProgress = false;
    setFormSubmitState("login-form", false, "Logging In...", "Log In");
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
  const isAthlete = selected === "athlete";

  athleteFields.forEach(field => {
    field.classList.toggle("hidden", !isAthlete);

    field.querySelectorAll("input, select, textarea").forEach(input => {
      input.disabled = !isAthlete;
    });
  });

}

function handleSignupMemberTypeChange() {
  updateSignupMemberTypeFields();
}

function setupAgeChoiceReset() {
  document.querySelectorAll("[data-clear-age-choice]").forEach(button => {
    button.addEventListener("click", () => {
      const groupName = button.dataset.clearAgeChoice;
      document.querySelectorAll(`input[name='${groupName}']`).forEach(input => {
        input.checked = false;
      });
    });
  });
}

function getSafeLegalNextPage() {
  const value = new URLSearchParams(window.location.search).get("next") || "";
  const normalized = value.replace(/^\/+/, "");
  if (!/^[a-z0-9-]+\.html(?:[?#].*)?$/i.test(normalized)) return "";
  if (normalized.toLowerCase().startsWith("legal-consent.html")) return "";
  return normalized;
}

async function continueAfterLegalAcceptance(userId) {
  const nextPage = getSafeLegalNextPage();
  if (nextPage) {
    window.location.href = nextPage;
    return;
  }
  await redirectByProfile(userId, { skipLegalCheck: true });
}

async function handleLegalConsent(event) {
  event.preventDefault();

  const ageBracket = document.querySelector("input[name='legal-age-bracket']:checked")?.value || "";
  const legalTermsConfirmed = document.getElementById("legal-current-documents-confirmation").checked;

  if (!ageBracket || !legalTermsConfirmed) {
    showMessage("legal-consent-message", "Choose your age confirmation and accept the current Terms and Privacy Policy.", true);
    return;
  }

  const submitButton = document.getElementById("legal-consent-submit");
  submitButton.disabled = true;
  submitButton.textContent = "Saving...";
  showMessage("legal-consent-message", "Saving your acceptance...");

  try {
    const { data: sessionData, error: sessionError } = await db.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session?.user) {
      window.location.href = "login.html";
      return;
    }

    const guardianPermissionConfirmed = ageBracket === "13_to_17";
    const { data, error } = await db.rpc("record_current_legal_acceptance", {
      p_age_bracket: ageBracket,
      p_guardian_permission_confirmed: guardianPermissionConfirmed,
      p_legal_terms_confirmed: legalTermsConfirmed
    });
    if (error) throw error;

    const acceptance = data?.[0];
    const { error: metadataError } = await db.auth.updateUser({
      data: {
        age_bracket: ageBracket,
        age_13_or_older_confirmed: true,
        guardian_permission_confirmed: guardianPermissionConfirmed,
        legal_terms_confirmed: true,
        legal_acknowledgment_version: `${acceptance?.terms_version || "current"}/${acceptance?.privacy_version || "current"}`,
        legal_acknowledged_at: acceptance?.accepted_at || new Date().toISOString()
      }
    });
    if (metadataError) console.warn("Legal acceptance was saved, but Auth metadata was not refreshed.", metadataError);

    showMessage("legal-consent-message", "Acceptance saved. Returning to Rip City...");
    await continueAfterLegalAcceptance(sessionData.session.user.id);
  } catch (error) {
    console.error(error);
    showMessage("legal-consent-message", error.message || "Could not save your acceptance.", true);
    submitButton.disabled = false;
    submitButton.textContent = "Accept and Continue";
  }
}

async function setupLegalConsentPage() {
  setupAgeChoiceReset();
  document.getElementById("legal-consent-logout").addEventListener("click", async () => {
    await db.auth.signOut();
    window.location.href = "login.html";
  });

  try {
    const { data: sessionData, error: sessionError } = await db.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session?.user) {
      window.location.href = "login.html";
      return;
    }

    const legalStatus = await getCurrentLegalAcceptance();
    document.getElementById("legal-terms-link").href = legalStatus.terms_path;
    document.getElementById("legal-privacy-link").href = legalStatus.privacy_path;
    document.getElementById("legal-version-detail").textContent =
      `Terms ${legalStatus.terms_version} · Privacy ${legalStatus.privacy_version}`;

    if (legalStatus.accepted) {
      await continueAfterLegalAcceptance(sessionData.session.user.id);
      return;
    }

    document.getElementById("legal-consent-form").addEventListener("submit", handleLegalConsent);
  } catch (error) {
    console.error(error);
    showMessage("legal-consent-message", error.message || "Could not load the current legal documents.", true);
    document.getElementById("legal-consent-submit").disabled = true;
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
  setupAgeChoiceReset();
  signupCoachInviteCode = getCoachInviteCodeFromUrl();

  if (signupCoachInviteCode) {
    await setupCoachSignupPage();
    return;
  }

  setupMemberTypeToggle();
  applySignupTypeFromUrl();

  updateSignupMemberTypeFields();

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

    const legalStatus = await getCurrentLegalAcceptance();
    if (!legalStatus.accepted) {
      window.location.href = getLegalConsentUrl("pending.html");
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

  if (currentPage === "legal-consent") {
    setupLegalConsentPage();
  }
});
