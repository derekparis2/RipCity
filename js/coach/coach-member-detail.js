let detailAccess = null;
let detailMember = null;

function showDetailMessage(message, isError = false) {
  const element = document.getElementById("coach-member-detail-message");
  element.textContent = message;
  element.classList.toggle("error-message", isError);
}

function renderDetailMember() {
  const profile = detailMember.member_profile?.[0] || detailMember.member_profile || {};
  const groups = (detailMember.group_members || []).map(item => item.group?.name).filter(Boolean);
  document.getElementById("coach-member-detail-summary").innerHTML = `
    <div class="coach-member-detail-heading">
      ${window.RipCityUI.avatarMarkup(detailMember.profile?.full_name, detailMember.profile?.profile_picture_url, "roster-avatar")}
      <div><p class="eyebrow">${window.RipCityUI.text(profile.member_type === "h2k" ? "H2K MEMBER" : "ATHLETE")}</p><h2>${window.RipCityUI.text(detailMember.profile?.full_name, "Unnamed Member")}</h2><p>${window.RipCityUI.text(detailMember.profile?.email)}</p></div>
    </div>
    <div class="member-goal-meta"><span>${window.RipCityUI.text(groups.join(", ") || "No groups")}</span>${profile.h2k_band_color ? `<span>${window.RipCityUI.text(`${profile.h2k_band_color} Band`)}</span>` : ""}</div>`;
}

async function loadMember() {
  const membershipId = new URLSearchParams(window.location.search).get("membership");
  if (!membershipId) throw new Error("Choose a member from the roster first.");

  const { data, error } = await db.from("facility_members").select(`
    id, facility_id, role, status,
    profile:profiles!facility_members_profile_id_fkey (id, full_name, email, profile_picture_url),
    member_profile:member_profiles (id, member_type, h2k_band_color)
  `).eq("id", membershipId).eq("facility_id", detailAccess.membership.facility_id).single();

  if (error) throw error;
  if (!data.member_profile) throw new Error("That account is not a member profile.");

  const memberProfile = data.member_profile?.[0] || data.member_profile;
  const { data: groupRows, error: groupError } = await db.from("group_members")
    .select("group:groups (name)")
    .eq("member_profile_id", memberProfile.id);

  if (groupError) throw groupError;

  detailMember = {
    ...data,
    group_members: groupRows || []
  };
  renderDetailMember();
}

async function init() {
  try { detailAccess = await window.RipCityAccess.requireCoachAccess(); if (!detailAccess) return; await loadMember(); } catch (error) { showDetailMessage(error.message || "Could not load member.", true); }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("coach-member-detail-logout").addEventListener("click", async () => { await db.auth.signOut(); window.location.href = "login.html"; });
  init();
});