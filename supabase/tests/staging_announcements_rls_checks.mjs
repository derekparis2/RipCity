import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const SUPABASE_URL = "https://xjgmjliqqkhfnqphigbk.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_tVBZfT0Mevjl2LqrbtsYag_jV0HQMPD";

async function signIn(email, password) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${email} login failed: ${body.msg || body.error_description}`);
  return { token: body.access_token, userId: body.user.id };
}

async function request(path, token = PUBLISHABLE_KEY, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
      Prefer: "return=representation",
      "Content-Type": "application/json",
      ...options.headers
    }
  });
  const text = await response.text();
  let body = [];
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { response, body };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS: ${message}`);
}

function normalizeRelation(value) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

async function createAnnouncement(token, input) {
  const result = await request("rpc/create_coach_announcement", token, {
    method: "POST",
    body: JSON.stringify({
      announcement_title: input.title,
      announcement_facility_id: input.facilityId,
      announcement_body: input.body,
      announcement_importance: input.importance || "standard",
      announcement_audience_type: input.audienceType,
      target_group_ids: input.groupIds || [],
      target_member_profile_ids: input.memberIds || [],
      announcement_expires_at: input.expiresAt || null
    })
  });
  return { ...result, id: typeof result.body === "string" ? result.body : result.body?.[0] };
}

const prompt = readline.createInterface({ input: stdin, output: stdout });
const password = await prompt.question("Shared staging test password (input is not stored): ");
prompt.close();
if (!password) throw new Error("A staging test password is required.");

const [ripCoach, ripAdmin, ripAthlete, ripH2k, alphaCoach, alphaAthlete] = await Promise.all([
  signIn("rccoach@example.com", password),
  signIn("rcadmin@example.com", password),
  signIn("rcathlete@example.com", password),
  signIn("rch2k@example.com", password),
  signIn("alphacoach@example.com", password),
  signIn("alphaathlete@example.com", password)
]);

const [{ body: ripFacilities }, { body: alphaFacilities }] = await Promise.all([
  request("facilities?select=id,name,slug&slug=eq.rip-city", ripCoach.token),
  request("facilities?select=id,name,slug&slug=eq.test-facility-alpha", alphaCoach.token)
]);
const ripCity = ripFacilities[0];
const alpha = alphaFacilities[0];
assert(ripCity && alpha, "both staging facilities are available");

const { body: ripMemberships } = await request(
  `facility_members?select=profile_id,profile:profiles!facility_members_profile_id_fkey(email),member_profile:member_profiles(id)&facility_id=eq.${ripCity.id}`,
  ripCoach.token
);
const ripAthleteMembership = ripMemberships.find(row => normalizeRelation(row.profile)?.email === "rcathlete@example.com");
const ripAthleteMemberProfileId = normalizeRelation(ripAthleteMembership?.member_profile)?.id;
assert(Boolean(ripAthleteMemberProfileId), "Rip City athlete fixture has a member profile");
const ripH2kMembership = ripMemberships.find(row => normalizeRelation(row.profile)?.email === "rch2k@example.com");
const ripH2kMemberProfileId = normalizeRelation(ripH2kMembership?.member_profile)?.id;
assert(Boolean(ripH2kMemberProfileId), "Rip City H2K fixture has a member profile");

const { body: alphaMemberships } = await request(
  `facility_members?select=profile_id,profile:profiles!facility_members_profile_id_fkey(email),member_profile:member_profiles(id)&facility_id=eq.${alpha.id}`,
  alphaCoach.token
);
const alphaAthleteMembership = alphaMemberships.find(row => normalizeRelation(row.profile)?.email === "alphaathlete@example.com");
const alphaAthleteMemberProfileId = normalizeRelation(alphaAthleteMembership?.member_profile)?.id;
assert(Boolean(alphaAthleteMemberProfileId), "Alpha athlete fixture has a member profile");

const { body: athleteGroups } = await request(
  `group_members?select=group_id,member_profile_id&member_profile_id=eq.${ripAthleteMemberProfileId}&limit=1`,
  ripCoach.token
);
const ripAthleteGroupId = athleteGroups[0]?.group_id;
assert(Boolean(ripAthleteGroupId), "Rip City athlete fixture belongs to a testable group");

const createdIds = [];

try {
  const memberCreate = await createAnnouncement(ripAthlete.token, {
    facilityId: ripCity.id,
    title: "Denied member announcement",
    body: "Members cannot publish announcements.",
    audienceType: "facility"
  });
  assert(!memberCreate.response.ok, "ordinary members cannot create announcements");

  const crossFacilityCreate = await createAnnouncement(ripCoach.token, {
    facilityId: ripCity.id,
    title: "Denied cross-facility announcement",
    body: "This target belongs to another facility.",
    audienceType: "targeted",
    memberIds: [alphaAthleteMemberProfileId]
  });
  assert(!crossFacilityCreate.response.ok, "coach cannot target a member in another facility");

  const facilityAnnouncement = await createAnnouncement(ripCoach.token, {
    facilityId: ripCity.id,
    title: "Staging facility announcement",
    body: "Visible to every approved Rip City member.",
    audienceType: "facility"
  });
  if (!facilityAnnouncement.response.ok) {
    throw new Error(`facility announcement failed: ${JSON.stringify(facilityAnnouncement.body)}`);
  }
  createdIds.push(facilityAnnouncement.id);
  assert(Boolean(facilityAnnouncement.id), "coach can create a facility announcement");

  const facilityForAthlete = await request(
    `coach_announcements?select=id&id=eq.${facilityAnnouncement.id}`,
    ripAthlete.token
  );
  const facilityForH2k = await request(
    `coach_announcements?select=id&id=eq.${facilityAnnouncement.id}`,
    ripH2k.token
  );
  const facilityForAlpha = await request(
    `coach_announcements?select=id&id=eq.${facilityAnnouncement.id}`,
    alphaAthlete.token
  );
  assert(facilityForAthlete.body.length === 1, "facility announcement is visible to a Rip City athlete");
  assert(facilityForH2k.body.length === 1, "facility announcement is visible to a Rip City H2K member");
  assert(facilityForAlpha.body.length === 0, "facility announcement is hidden from another facility");

  const athleteAnnouncement = await createAnnouncement(ripCoach.token, {
    facilityId: ripCity.id,
    title: "Staging all-athlete announcement",
    body: "Visible once to every athlete regardless of group count.",
    audienceType: "athletes"
  });
  if (!athleteAnnouncement.response.ok) {
    throw new Error(`all-athlete announcement failed: ${JSON.stringify(athleteAnnouncement.body)}`);
  }
  createdIds.push(athleteAnnouncement.id);

  const allAthletesForAthlete = await request(
    `coach_announcements?select=id&id=eq.${athleteAnnouncement.id}`,
    ripAthlete.token
  );
  const allAthletesForH2k = await request(
    `coach_announcements?select=id&id=eq.${athleteAnnouncement.id}`,
    ripH2k.token
  );
  assert(allAthletesForAthlete.body.length === 1, "all-athletes announcement is visible to an athlete");
  assert(allAthletesForH2k.body.length === 0, "all-athletes announcement is hidden from an H2K member");

  const dismissal = await request("coach_announcement_dismissals", ripAthlete.token, {
    method: "POST",
    body: JSON.stringify({
      announcement_id: athleteAnnouncement.id,
      member_profile_id: ripAthleteMemberProfileId
    })
  });
  assert(dismissal.response.ok && dismissal.body.length === 1, "member can dismiss a visible announcement for today");

  const ownDismissal = await request(
    `coach_announcement_dismissals?select=announcement_id&announcement_id=eq.${athleteAnnouncement.id}`,
    ripAthlete.token
  );
  const otherDismissal = await request(
    `coach_announcement_dismissals?select=announcement_id&announcement_id=eq.${athleteAnnouncement.id}`,
    ripH2k.token
  );
  assert(ownDismissal.body.length === 1, "member can read their own announcement dismissal");
  assert(otherDismissal.body.length === 0, "another member cannot read the dismissal");

  const restoredDismissal = await request(
    `coach_announcement_dismissals?announcement_id=eq.${athleteAnnouncement.id}&member_profile_id=eq.${ripAthleteMemberProfileId}`,
    ripAthlete.token,
    { method: "DELETE" }
  );
  assert(
    restoredDismissal.response.ok && restoredDismissal.body.length === 1,
    "member can restore their own dismissed announcement"
  );
  const dismissalAfterRestore = await request(
    `coach_announcement_dismissals?select=announcement_id&announcement_id=eq.${athleteAnnouncement.id}`,
    ripAthlete.token
  );
  assert(dismissalAfterRestore.body.length === 0, "restored announcement no longer has a dismissal");

  const memberAnnouncement = await createAnnouncement(ripCoach.token, {
    facilityId: ripCity.id,
    title: "Staging individual announcement",
    body: "Visible only to the selected athlete.",
    importance: "important",
    audienceType: "targeted",
    memberIds: [ripAthleteMemberProfileId]
  });
  if (!memberAnnouncement.response.ok) {
    throw new Error(`member announcement failed: ${JSON.stringify(memberAnnouncement.body)}`);
  }
  createdIds.push(memberAnnouncement.id);

  const targetedForAthlete = await request(
    `coach_announcements?select=id&id=eq.${memberAnnouncement.id}`,
    ripAthlete.token
  );
  const targetedForH2k = await request(
    `coach_announcements?select=id&id=eq.${memberAnnouncement.id}`,
    ripH2k.token
  );
  assert(targetedForAthlete.body.length === 1, "selected member can read an individual announcement");
  assert(targetedForH2k.body.length === 0, "unselected member cannot read an individual announcement");

  const importantAnnouncement = await request(
    `coach_announcements?select=id,importance&id=eq.${memberAnnouncement.id}`,
    ripCoach.token
  );
  assert(importantAnnouncement.body[0]?.importance === "important", "important announcement retains its importance level");

  const groupAnnouncement = await createAnnouncement(ripCoach.token, {
    facilityId: ripCity.id,
    title: "Staging group announcement",
    body: "Visible to members of the selected group.",
    audienceType: "targeted",
    groupIds: [ripAthleteGroupId]
  });
  if (!groupAnnouncement.response.ok) {
    throw new Error(`group announcement failed: ${JSON.stringify(groupAnnouncement.body)}`);
  }
  createdIds.push(groupAnnouncement.id);

  const targetedForGroupMember = await request(
    `coach_announcements?select=id&id=eq.${groupAnnouncement.id}`,
    ripAthlete.token
  );
  assert(targetedForGroupMember.body.length === 1, "selected group member can read a group announcement");

  const crossFacilityDelete = await request(
    `coach_announcements?id=eq.${facilityAnnouncement.id}`,
    alphaCoach.token,
    { method: "DELETE" }
  );
  assert(
    crossFacilityDelete.response.ok && crossFacilityDelete.body.length === 0,
    "coach from another facility cannot delete the announcement"
  );

  const adminDelete = await request(
    `coach_announcements?id=eq.${facilityAnnouncement.id}`,
    ripAdmin.token,
    { method: "DELETE" }
  );
  assert(adminDelete.response.ok && adminDelete.body.length === 1, "facility admin can delete a coach announcement");
  createdIds.splice(createdIds.indexOf(facilityAnnouncement.id), 1);
} finally {
  for (const id of createdIds) {
    await request(`coach_announcements?id=eq.${id}`, ripCoach.token, { method: "DELETE" });
  }
}

console.log("Targeted-announcement staging RLS checks passed and fixtures were cleaned up.");
