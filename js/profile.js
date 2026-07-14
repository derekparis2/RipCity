// =====================================================
// MEMBER PROFILE PAGE
// =====================================================
// This page lets an approved member edit their profile.
// It updates the shared profiles table and member_profiles table.

let profileAccess = null;
let currentMemberProfile = null;

// ----------------------------
// Page messages / small helpers
// ----------------------------

function showProfileMessage(message, isError = false) {
  const element = document.getElementById("profile-message");
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error-message", isError);
}

async function getProfileSession() {
  const { data, error } = await db.auth.getSession();

  if (error) throw error;

  return data.session;
}

async function getProfileUser(userId) {
  // Shared account/profile fields live in profiles.
  // Program/member-specific fields are loaded separately from member_profiles.
  const { data, error } = await db
    .from("profiles")
    .select(`
      id,
      email,
      full_name,
      global_role,
      username,
      bio,
      birthday,
      profile_picture_url,
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

async function getMemberProfile(facilityMemberId) {
  // member_profiles is keyed from facility_members, not directly from auth users.
  const { data, error } = await db
    .from("member_profiles")
    .select("*")
    .eq("facility_member_id", facilityMemberId)
    .single();

  if (error) throw error;

  return data;
}

async function requireApprovedProfileUser() {
  // Profile editing is only available after the facility has approved access.
  const session = await getProfileSession();

  if (!session) {
    window.location.href = "login.html";
    return null;
  }

  const profile = await getProfileUser(session.user.id);

  const membership =
    profile.facility_members?.[0] ||
    profile["facility_members!facility_members_profile_id_fkey"]?.[0];

  if (!membership || membership.status !== "approved") {
    window.location.href = "pending.html";
    return null;
  }

  return {
    session,
    profile,
    membership
  };
}

function setInputValue(id, value) {
  const element = document.getElementById(id);
  if (!element) return;

  element.value = value || "";
}

function getInputValue(id) {
  const element = document.getElementById(id);
  if (!element) return "";

  return element.value.trim();
}

function updateProfilePreview() {
  // The preview updates as the user types so the profile page feels less like
  // a plain settings form and more like a member card.
  const fullName = getInputValue("profile-full-name") || "Member Name";
  const username = getInputValue("profile-username") || "username";
  const bio = getInputValue("profile-bio") || "Your bio will show here.";
  const birthday = getInputValue("profile-birthday") || "Not added";
  const sport = getInputValue("profile-sport") || getInputValue("profile-training-focus") || "Not added";

  const program =
    currentMemberProfile?.member_type === "h2k"
      ? "H2K Member"
      : "Athlete";

  document.getElementById("preview-name").textContent = fullName;
  document.getElementById("preview-username").textContent = `@${username}`;
  document.getElementById("preview-bio").textContent = bio;
  document.getElementById("preview-birthday").textContent = birthday;
  document.getElementById("preview-program").textContent = program;
  document.getElementById("preview-sport").textContent = sport;

  const avatar = document.getElementById("profile-avatar");
  avatar.textContent = fullName.charAt(0).toUpperCase();
}

function fillProfileForm() {
  // Populate the edit form from both profile tables.
  const profile = profileAccess.profile;
  const member = currentMemberProfile;

  setInputValue("profile-full-name", profile.full_name);
  setInputValue("profile-username", profile.username);
  setInputValue("profile-bio", profile.bio);
  setInputValue("profile-birthday", profile.birthday);
  setInputValue("profile-picture-url", profile.profile_picture_url);

  setInputValue("profile-sport", member.sport);
  setInputValue("profile-position", member.position);
  setInputValue("profile-school", member.school);
  setInputValue("profile-grad-year", member.graduation_year);
  setInputValue("profile-height", member.height);
  setInputValue("profile-body-weight", member.body_weight);
  setInputValue("profile-training-focus", member.training_focus);
  setInputValue("profile-favorite-lift", member.favorite_lift);

  updateProfilePreview();
}

async function saveProfile(event) {
  event.preventDefault();

  showProfileMessage("Saving profile...");

  try {
    const fullName = getInputValue("profile-full-name");

    if (!fullName) {
      showProfileMessage("Full name is required.", true);
      return;
    }

    // Save public/account-level fields first.
    const { error: profileError } = await db
      .from("profiles")
      .update({
        full_name: fullName,
        username: getInputValue("profile-username") || null,
        bio: getInputValue("profile-bio") || null,
        birthday: getInputValue("profile-birthday") || null,
        profile_picture_url: getInputValue("profile-picture-url") || null
      })
      .eq("id", profileAccess.profile.id);

    if (profileError) throw profileError;

    const gradYear = getInputValue("profile-grad-year");
    const bodyWeight = getInputValue("profile-body-weight");

    // Save training/program fields second.
    const { error: memberError } = await db
      .from("member_profiles")
      .update({
        sport: getInputValue("profile-sport") || null,
        position: getInputValue("profile-position") || null,
        school: getInputValue("profile-school") || null,
        graduation_year: gradYear ? Number(gradYear) : null,
        height: getInputValue("profile-height") || null,
        body_weight: bodyWeight ? Number(bodyWeight) : null,
        training_focus: getInputValue("profile-training-focus") || null,
        favorite_lift: getInputValue("profile-favorite-lift") || null,
        updated_at: new Date().toISOString()
      })
      .eq("id", currentMemberProfile.id);

    if (memberError) throw memberError;

    // Reload fresh data after saving.
    profileAccess.profile = await getProfileUser(profileAccess.profile.id);
    currentMemberProfile = await getMemberProfile(profileAccess.membership.id);

    fillProfileForm();
    showProfileMessage("Profile saved.");
  } catch (error) {
    console.error(error);
    showProfileMessage(error.message || "Could not save profile.", true);
  }
}

async function logoutProfile() {
  await db.auth.signOut();
  window.location.href = "login.html";
}

async function initProfilePage() {
  showProfileMessage("Loading profile...");

  try {
    profileAccess = await requireApprovedProfileUser();

    if (!profileAccess) return;

    currentMemberProfile = await getMemberProfile(profileAccess.membership.id);

    fillProfileForm();
    showProfileMessage("");
  } catch (error) {
    console.error(error);
    showProfileMessage(error.message || "Could not load profile.", true);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initProfilePage();

  document.getElementById("profile-form").addEventListener("submit", saveProfile);
  document.getElementById("profile-logout-btn").addEventListener("click", logoutProfile);

  // Keep the right-side preview in sync with form edits.
  document.querySelectorAll("#profile-form input, #profile-form textarea").forEach(input => {
    input.addEventListener("input", updateProfilePreview);
  });
});
