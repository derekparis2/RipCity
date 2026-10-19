let coachProfileAccess = null;
let selectedCoachProfilePicture = null;

const COACH_PROFILE_PICTURE_BUCKET = "profile-pictures";
const MAX_COACH_PROFILE_PICTURE_BYTES = 5 * 1024 * 1024;

function showCoachProfileMessage(message, isError = false) {
  const element = document.getElementById("coach-profile-message");
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error-message", isError);
}

function getCoachProfileInputValue(id) {
  return document.getElementById(id)?.value.trim() || "";
}

function setCoachProfileInputValue(id, value) {
  const element = document.getElementById(id);
  if (element) element.value = value || "";
}

function getCoachProfileInitials(name) {
  return String(name || "Coach")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join("") || "C";
}

function getSafeCoachProfileImageUrl(url) {
  if (!url) return "";

  try {
    const parsed = new URL(url, window.location.href);
    return ["http:", "https:", "blob:"].includes(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
}

function setCoachProfilePreviewPicture(url, name) {
  const avatar = document.getElementById("coach-profile-avatar");
  if (!avatar) return;

  const safeUrl = getSafeCoachProfileImageUrl(url);
  avatar.textContent = "";
  avatar.classList.toggle("has-image", Boolean(safeUrl));

  if (!safeUrl) {
    avatar.textContent = getCoachProfileInitials(name);
    return;
  }

  const image = document.createElement("img");
  image.src = safeUrl;
  image.alt = `${name || "Coach"} profile picture`;
  image.addEventListener("error", () => {
    avatar.classList.remove("has-image");
    avatar.textContent = getCoachProfileInitials(name);
  });
  avatar.appendChild(image);
}

function updateCoachProfilePreview() {
  const fullName = getCoachProfileInputValue("coach-profile-full-name") || "Coach Name";
  const username = getCoachProfileInputValue("coach-profile-username") || "username";
  const bio = getCoachProfileInputValue("coach-profile-bio") || "Your bio will show here.";
  const birthday = getCoachProfileInputValue("coach-profile-birthday") || "Not added";
  const role = coachProfileAccess?.membership?.role === "admin" ? "Admin" : "Coach";

  document.getElementById("coach-preview-name").textContent = fullName;
  document.getElementById("coach-preview-username").textContent = `@${username}`;
  document.getElementById("coach-preview-bio").textContent = bio;
  document.getElementById("coach-preview-birthday").textContent = birthday;
  document.getElementById("coach-preview-role").textContent = role;
  setCoachProfilePreviewPicture(getCoachProfileInputValue("coach-profile-picture-url"), fullName);
}

function fillCoachProfileForm() {
  const profile = coachProfileAccess.profile;
  setCoachProfileInputValue("coach-profile-full-name", profile.full_name);
  setCoachProfileInputValue("coach-profile-username", profile.username);
  setCoachProfileInputValue("coach-profile-bio", profile.bio);
  setCoachProfileInputValue("coach-profile-birthday", profile.birthday);
  setCoachProfileInputValue("coach-profile-picture-url", profile.profile_picture_url);
  updateCoachProfilePreview();
}

async function uploadCoachProfilePicture() {
  if (!selectedCoachProfilePicture) {
    return getCoachProfileInputValue("coach-profile-picture-url") || null;
  }

  if (!selectedCoachProfilePicture.type.startsWith("image/")) {
    throw new Error("Profile picture must be an image file.");
  }

  if (selectedCoachProfilePicture.size > MAX_COACH_PROFILE_PICTURE_BYTES) {
    throw new Error("Profile picture must be 5 MB or smaller.");
  }

  const extension = selectedCoachProfilePicture.name
    .split(".")
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${coachProfileAccess.profile.id}/${Date.now()}.${extension}`;
  const { error } = await db.storage
    .from(COACH_PROFILE_PICTURE_BUCKET)
    .upload(path, selectedCoachProfilePicture, {
      cacheControl: "3600",
      upsert: true
    });

  if (error) throw error;

  const { data } = db.storage
    .from(COACH_PROFILE_PICTURE_BUCKET)
    .getPublicUrl(path);
  return data.publicUrl;
}

function handleCoachProfilePictureChange(event) {
  const file = event.target.files?.[0];
  if (!file) {
    selectedCoachProfilePicture = null;
    updateCoachProfilePreview();
    return;
  }

  if (!file.type.startsWith("image/")) {
    showCoachProfileMessage("Profile picture must be an image file.", true);
    event.target.value = "";
    return;
  }

  if (file.size > MAX_COACH_PROFILE_PICTURE_BYTES) {
    showCoachProfileMessage("Profile picture must be 5 MB or smaller.", true);
    event.target.value = "";
    return;
  }

  selectedCoachProfilePicture = file;
  setCoachProfileInputValue("coach-profile-picture-url", URL.createObjectURL(file));
  updateCoachProfilePreview();
  showCoachProfileMessage("");
}

function removeCoachProfilePicture() {
  selectedCoachProfilePicture = null;
  setCoachProfileInputValue("coach-profile-picture-url", "");

  const input = document.getElementById("coach-profile-picture-file");
  if (input) input.value = "";

  updateCoachProfilePreview();
}

async function saveCoachProfile(event) {
  event.preventDefault();
  showCoachProfileMessage("Saving profile...");

  try {
    const fullName = getCoachProfileInputValue("coach-profile-full-name");
    if (!fullName) {
      showCoachProfileMessage("Full name is required.", true);
      return;
    }

    const profilePictureUrl = await uploadCoachProfilePicture();
    const { error } = await db
      .from("profiles")
      .update({
        full_name: fullName,
        username: getCoachProfileInputValue("coach-profile-username") || null,
        bio: getCoachProfileInputValue("coach-profile-bio") || null,
        birthday: getCoachProfileInputValue("coach-profile-birthday") || null,
        profile_picture_url: profilePictureUrl
      })
      .eq("id", coachProfileAccess.profile.id);

    if (error) throw error;

    coachProfileAccess.profile = await window.RipCityAccess.getProfileWithMemberships(
      coachProfileAccess.profile.id,
      "username,bio,birthday,profile_picture_url"
    );
    selectedCoachProfilePicture = null;
    setCoachProfileInputValue("coach-profile-picture-url", profilePictureUrl);
    showCoachProfileMessage("Profile saved.");
    updateCoachProfilePreview();
  } catch (error) {
    console.error(error);
    showCoachProfileMessage(error.message || "Could not save profile.", true);
  }
}

async function logoutCoachProfile() {
  const { error } = await db.auth.signOut();
  if (error) {
    console.error(error);
    showCoachProfileMessage(error.message || "Could not log out.", true);
    return;
  }

  window.location.href = "login.html";
}

async function initCoachProfilePage() {
  showCoachProfileMessage("Loading profile...");

  try {
    coachProfileAccess = await window.RipCityAccess.requireCoachAccess({
      extraProfileColumns: "username,bio,birthday,profile_picture_url",
      onDeniedMessage: showCoachProfileMessage
    });

    if (!coachProfileAccess) return;

    fillCoachProfileForm();
    showCoachProfileMessage("");
  } catch (error) {
    console.error(error);
    showCoachProfileMessage(error.message || "Could not load profile.", true);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initCoachProfilePage();

  document.getElementById("coach-profile-form").addEventListener("submit", saveCoachProfile);
  document.getElementById("coach-profile-logout-btn").addEventListener("click", logoutCoachProfile);
  document.getElementById("coach-profile-picture-file")
    .addEventListener("change", handleCoachProfilePictureChange);
  document.getElementById("coach-profile-picture-remove")
    .addEventListener("click", removeCoachProfilePicture);

  document.querySelectorAll("#coach-profile-form input, #coach-profile-form textarea").forEach(input => {
    input.addEventListener("input", updateCoachProfilePreview);
  });
});
