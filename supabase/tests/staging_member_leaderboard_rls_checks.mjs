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

async function request(path, token, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers
    }
  });
  const text = await response.text();
  let body = [];
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  return { response, body };
}

async function leaderboard(token, metricKey = "currentStreak", groupId = null) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const part = type => parts.find(item => item.type === type)?.value;
  const todayKey = `${part("year")}-${part("month")}-${part("day")}`;

  return request("rpc/get_member_habit_leaderboard", token, {
    method: "POST",
    body: JSON.stringify({
      metric_key: metricKey,
      scope_group_id: groupId,
      as_of_date: todayKey
    })
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS: ${message}`);
}

function normalizeRelation(value) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function assertLimitedResponse(rows, ownMemberProfileId, label) {
  const ownRow = rows.find(row => row.member_profile_id === ownMemberProfileId);
  assert(Boolean(ownRow?.is_self), `${label} includes the caller's own row`);
  assert(
    rows.every(row => row.is_self || (row.rank !== null && Number(row.rank) <= 5)),
    `${label} exposes only top-five positions plus the caller`
  );
  assert(rows.every(row => !("email" in row)), `${label} does not expose member email addresses`);
}

const prompt = readline.createInterface({ input: stdin, output: stdout });
const password = await prompt.question("Shared staging test password (input is not stored): ");
prompt.close();
if (!password) throw new Error("A staging test password is required.");

const [ripCoach, ripAthlete, ripH2k, alphaAthlete] = await Promise.all([
  signIn("rccoach@example.com", password),
  signIn("rcathlete@example.com", password),
  signIn("rch2k@example.com", password),
  signIn("alphaathlete@example.com", password)
]);

const { body: ripMemberships } = await request(
  "facility_members?select=facility_id,role,profile:profiles!facility_members_profile_id_fkey(email),member_profile:member_profiles(id,member_type)&status=eq.approved",
  ripCoach.token
);
const byEmail = email => ripMemberships.find(row => normalizeRelation(row.profile)?.email === email);
const athleteMembership = byEmail("rcathlete@example.com");
const h2kMembership = byEmail("rch2k@example.com");
const athleteProfile = normalizeRelation(athleteMembership?.member_profile);
const h2kProfile = normalizeRelation(h2kMembership?.member_profile);
assert(Boolean(athleteProfile?.id && h2kProfile?.id), "Rip City Athlete and H2K fixtures are available");

const ripFacilityId = athleteMembership.facility_id;
const athleteIds = new Set(
  ripMemberships
    .map(row => normalizeRelation(row.member_profile))
    .filter(profile => profile?.member_type === "athlete")
    .map(profile => profile.id)
);
const h2kIds = new Set(
  ripMemberships
    .map(row => normalizeRelation(row.member_profile))
    .filter(profile => profile?.member_type === "h2k")
    .map(profile => profile.id)
);

const athleteBoard = await leaderboard(ripAthlete.token);
assert(athleteBoard.response.ok, "Athlete can open the member leaderboard RPC");
assertLimitedResponse(athleteBoard.body, athleteProfile.id, "Athlete leaderboard");
assert(athleteBoard.body.every(row => athleteIds.has(row.member_profile_id)), "Athlete leaderboard contains only Rip City athletes");
assert(athleteBoard.body.every(row => !h2kIds.has(row.member_profile_id)), "Athlete leaderboard hides every H2K member");

const h2kBoard = await leaderboard(ripH2k.token);
assert(h2kBoard.response.ok, "H2K member can open the member leaderboard RPC");
assertLimitedResponse(h2kBoard.body, h2kProfile.id, "H2K leaderboard");
assert(h2kBoard.body.every(row => h2kIds.has(row.member_profile_id)), "H2K leaderboard contains only Rip City H2K members");
assert(h2kBoard.body.every(row => !athleteIds.has(row.member_profile_id)), "H2K leaderboard hides every athlete");

const alphaBoard = await leaderboard(alphaAthlete.token);
assert(alphaBoard.response.ok, "Alpha athlete can open an isolated member leaderboard");
assert(alphaBoard.body.every(row => !athleteIds.has(row.member_profile_id) && !h2kIds.has(row.member_profile_id)), "another facility never receives Rip City leaderboard rows");

const { body: ownGroups } = await request(
  `group_members?select=group_id&member_profile_id=eq.${athleteProfile.id}`,
  ripAthlete.token
);
const ownGroupId = ownGroups[0]?.group_id;
assert(Boolean(ownGroupId), "Rip City athlete belongs to a group used for scope testing");
const ownGroupBoard = await leaderboard(ripAthlete.token, "fourWeekAverage", ownGroupId);
assert(ownGroupBoard.response.ok, "member can view a leaderboard for their own group");
assertLimitedResponse(ownGroupBoard.body, athleteProfile.id, "Own-group leaderboard");

const { body: athleteGroups } = await request(
  `groups?select=id&facility_id=eq.${ripFacilityId}&member_type=in.(athlete,both)&id=neq.${ownGroupId}`,
  ripCoach.token
);
const unrelatedGroupId = athleteGroups[0]?.id;
assert(Boolean(unrelatedGroupId), "a different same-facility group is available for denial testing");
const unrelatedGroupBoard = await leaderboard(ripAthlete.token, "fourWeekAverage", unrelatedGroupId);
assert(!unrelatedGroupBoard.response.ok, "member cannot scope a leaderboard to a group they do not belong to");

const coachBoard = await leaderboard(ripCoach.token);
assert(!coachBoard.response.ok, "coach cannot use the member-only leaderboard RPC");

const unsupportedMetric = await leaderboard(ripAthlete.token, "privateMetric");
assert(!unsupportedMetric.response.ok, "member cannot request an unapproved leaderboard metric");

console.log("Member-leaderboard staging RLS checks passed.");
