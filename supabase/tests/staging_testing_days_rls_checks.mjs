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

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS: ${message}`);
}

function relation(value) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

const prompt = readline.createInterface({ input: stdin, output: stdout });
const password = await prompt.question("Shared staging test password (input is not stored): ");
prompt.close();
if (!password) throw new Error("A staging test password is required.");

const [ripAdmin, ripCoach, ripAthlete, ripH2k, alphaCoach] = await Promise.all([
  signIn("rcadmin@example.com", password),
  signIn("rccoach@example.com", password),
  signIn("rcathlete@example.com", password),
  signIn("rch2k@example.com", password),
  signIn("alphacoach@example.com", password)
]);

let testingDayId = null;

try {
  const { body: memberships } = await request(
    "facility_members?select=facility_id,profile:profiles!facility_members_profile_id_fkey(email),member_profile:member_profiles(id,member_type)&status=eq.approved",
    ripCoach.token
  );
  const byEmail = email => memberships.find(row => relation(row.profile)?.email === email);
  const athlete = relation(byEmail("rcathlete@example.com")?.member_profile);
  const h2k = relation(byEmail("rch2k@example.com")?.member_profile);
  const facilityId = byEmail("rcathlete@example.com")?.facility_id;
  assert(Boolean(athlete?.id && h2k?.id && facilityId), "Rip City Testing Day fixtures are available");

  const { body: athleteGroups } = await request(
    `groups?select=id,name&facility_id=eq.${facilityId}&member_type=in.(athlete,both)&order=name.asc`,
    ripCoach.token
  );
  const groupId = athleteGroups[0]?.id;
  assert(Boolean(groupId), "an athlete group is available for overlapping roster selection");

  const { body: alphaGroups } = await request("groups?select=id&order=name.asc", alphaCoach.token);
  const alphaGroupId = alphaGroups[0]?.id;
  assert(Boolean(alphaGroupId), "another-facility group is available for denial testing");

  const memberSave = await request("rpc/save_testing_day", ripAthlete.token, {
    method: "POST",
    body: JSON.stringify({
      p_testing_day_id: null,
      p_name: "Unauthorized Testing Day",
      p_description: null,
      p_testing_date: "2026-12-01",
      p_status: "scheduled",
      p_group_ids: [groupId],
      p_member_profile_ids: [athlete.id],
      p_tests: [{ name: "10-Yard Sprint", unit: "seconds", input_type: "time", ranking_direction: "lower" }]
    })
  });
  assert(!memberSave.response.ok, "ordinary members cannot create Testing Days");

  const crossFacilitySave = await request("rpc/save_testing_day", ripCoach.token, {
    method: "POST",
    body: JSON.stringify({
      p_testing_day_id: null,
      p_name: "Cross-Facility Testing Day",
      p_description: null,
      p_testing_date: "2026-12-01",
      p_status: "scheduled",
      p_group_ids: [alphaGroupId],
      p_member_profile_ids: [athlete.id],
      p_tests: [{ name: "10-Yard Sprint", unit: "seconds", input_type: "time", ranking_direction: "lower" }]
    })
  });
  assert(!crossFacilitySave.response.ok, "coach cannot schedule another facility's group");

  const save = await request("rpc/save_testing_day", ripAdmin.token, {
    method: "POST",
    body: JSON.stringify({
      p_testing_day_id: null,
      p_name: "STAGING Testing Day RLS Fixture",
      p_description: "Temporary automated test fixture",
      p_testing_date: "2026-12-01",
      p_status: "scheduled",
      p_group_ids: [groupId, groupId],
      p_member_profile_ids: [athlete.id],
      p_tests: [
        { name: "10-Yard Sprint", unit: "seconds", input_type: "time", ranking_direction: "lower" },
        { name: "Vertical Jump", unit: "inches", input_type: "number", ranking_direction: "higher" }
      ]
    })
  });
  if (!save.response.ok) throw new Error(`Testing Day creation failed: ${JSON.stringify(save.body)}`);
  testingDayId = save.body[0]?.testing_day_id;
  assert(Boolean(testingDayId), "facility admin can create and schedule a Testing Day");

  const coachEdit = await request("rpc/save_testing_day", ripCoach.token, {
    method: "POST",
    body: JSON.stringify({
      p_testing_day_id: testingDayId,
      p_name: "STAGING Testing Day RLS Fixture",
      p_description: "Temporary automated test fixture edited by coach",
      p_testing_date: "2026-12-01",
      p_status: "scheduled",
      p_group_ids: [groupId, groupId],
      p_member_profile_ids: [athlete.id],
      p_tests: [
        { name: "10-Yard Sprint", unit: "seconds", input_type: "time", ranking_direction: "lower" },
        { name: "Vertical Jump", unit: "inches", input_type: "number", ranking_direction: "higher" }
      ]
    })
  });
  assert(coachEdit.response.ok, "same-facility coach can edit and reschedule the Testing Day");

  const { body: participants } = await request(
    `testing_day_participants?select=id,member_profile_id,selected_individually,participation_status&testing_day_id=eq.${testingDayId}`,
    ripCoach.token
  );
  assert(new Set(participants.map(row => row.member_profile_id)).size === participants.length, "overlapping groups and individuals create one participant per member");
  assert(participants.filter(row => row.member_profile_id === athlete.id).length === 1, "the directly selected athlete is not duplicated by group membership");

  const coachRead = await request(`testing_days?select=id&id=eq.${testingDayId}`, ripCoach.token);
  assert(coachRead.response.ok && coachRead.body.length === 1, "same-facility coach can read the Testing Day");

  const athleteRead = await request(`testing_days?select=id,name,testing_day_tests(id,name)&id=eq.${testingDayId}`, ripAthlete.token);
  assert(athleteRead.response.ok && athleteRead.body.length === 1, "assigned athlete can read the scheduled day and test battery");

  const h2kRead = await request(`testing_days?select=id&id=eq.${testingDayId}`, ripH2k.token);
  const h2kWasSelected = participants.some(row => row.member_profile_id === h2k.id);
  assert(!h2kWasSelected, "the athlete-group fixture does not include the H2K member");
  assert(h2kRead.response.ok && h2kRead.body.length === 0, "an unassigned member cannot read the Testing Day");

  const alphaRead = await request(`testing_days?select=id&id=eq.${testingDayId}`, alphaCoach.token);
  assert(alphaRead.response.ok && alphaRead.body.length === 0, "another facility cannot read the Testing Day");

  const { body: tests } = await request(`testing_day_tests?select=id&testing_day_id=eq.${testingDayId}&order=test_order.asc`, ripCoach.token);
  const athleteParticipant = participants.find(row => row.member_profile_id === athlete.id);
  const resultPayload = {
    testing_day_test_id: tests[0]?.id,
    testing_day_participant_id: athleteParticipant?.id,
    numeric_value: 1
  };
  assert(Boolean(resultPayload.testing_day_test_id && resultPayload.testing_day_participant_id), "result-write denial fixture is available");

  for (const [label, account] of [["facility admin", ripAdmin], ["coach", ripCoach], ["member", ripAthlete]]) {
    const write = await request("testing_results", account.token, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(resultPayload)
    });
    assert(!write.response.ok, `${label} cannot bypass the staff result RPC with a direct table write`);
  }

  const memberResultSave = await request("rpc/save_testing_results", ripAthlete.token, {
    method: "POST",
    body: JSON.stringify({ p_testing_day_id: testingDayId, p_results: [resultPayload] })
  });
  assert(!memberResultSave.response.ok, "member cannot enter official Testing Day results");

  const coachResultSave = await request("rpc/save_testing_results", ripCoach.token, {
    method: "POST",
    body: JSON.stringify({ p_testing_day_id: testingDayId, p_results: [resultPayload] })
  });
  assert(coachResultSave.response.ok, "same-facility coach can enter official Testing Day results");

  const adminResultUpdate = await request("rpc/save_testing_results", ripAdmin.token, {
    method: "POST",
    body: JSON.stringify({ p_testing_day_id: testingDayId, p_results: [{ ...resultPayload, numeric_value: 1.25, notes: "Admin verified" }] })
  });
  assert(adminResultUpdate.response.ok, "facility admin can update the same official result");

  const { body: savedResults } = await request(
    `testing_results?select=id,numeric_value,notes,entered_by&testing_day_test_id=eq.${resultPayload.testing_day_test_id}&testing_day_participant_id=eq.${resultPayload.testing_day_participant_id}`,
    ripCoach.token
  );
  assert(savedResults.length === 1 && Number(savedResults[0].numeric_value) === 1.25, "athlete-first and test-first entry share one canonical result row");

  const athleteOwnResult = await request(
    `testing_results?select=id,numeric_value,result_status&testing_day_participant_id=eq.${athleteParticipant.id}`,
    ripAthlete.token
  );
  assert(athleteOwnResult.response.ok && athleteOwnResult.body.length === 1, "assigned member can read only their own official Testing Day result");

  const h2kOtherResults = await request(
    `testing_results?select=id&testing_day_test_id=eq.${resultPayload.testing_day_test_id}`,
    ripH2k.token
  );
  assert(h2kOtherResults.response.ok && h2kOtherResults.body.length === 0, "another member cannot read an athlete's Testing Day result");

  const prematureFinish = await request("rpc/finish_testing_day", ripCoach.token, {
    method: "POST",
    body: JSON.stringify({ p_testing_day_id: testingDayId })
  });
  assert(!prematureFinish.response.ok, "Testing Day cannot finish while roster outcomes are unexplained");

  const notTestedSave = await request("rpc/save_testing_results", ripCoach.token, {
    method: "POST",
    body: JSON.stringify({
      p_testing_day_id: testingDayId,
      p_results: [{
        testing_day_test_id: tests[1]?.id,
        testing_day_participant_id: athleteParticipant.id,
        result_status: "not_tested",
        notes: "Did not complete second test"
      }]
    })
  });
  assert(notTestedSave.response.ok, "coach can explicitly mark one participant test Not Tested");

  for (const participant of participants.filter(row => row.id !== athleteParticipant.id)) {
    const absence = await request("rpc/set_testing_participant_status", ripCoach.token, {
      method: "POST",
      body: JSON.stringify({ p_testing_day_participant_id: participant.id, p_status: "did_not_participate" })
    });
    assert(absence.response.ok, "coach can explicitly mark a rostered athlete as not participating");
  }

  const memberAbsenceAttempt = await request("rpc/set_testing_participant_status", ripAthlete.token, {
    method: "POST",
    body: JSON.stringify({ p_testing_day_participant_id: athleteParticipant.id, p_status: "did_not_participate" })
  });
  assert(!memberAbsenceAttempt.response.ok, "member cannot change Testing Day participation status");

  const finish = await request("rpc/finish_testing_day", ripAdmin.token, {
    method: "POST",
    body: JSON.stringify({ p_testing_day_id: testingDayId })
  });
  assert(finish.response.ok && finish.body?.status === "completed", "facility admin can finish a fully accounted Testing Day");

  const clearResult = await request("rpc/save_testing_results", ripAdmin.token, {
    method: "POST",
    body: JSON.stringify({
      p_testing_day_id: testingDayId,
      p_results: tests.map(test => ({
        testing_day_test_id: test.id,
        testing_day_participant_id: athleteParticipant.id,
        result_status: "recorded",
        numeric_value: null,
        text_value: null
      }))
    })
  });
  assert(clearResult.response.ok, "facility admin can clear official results through the RPC");
} finally {
  if (testingDayId) {
    await request("rpc/set_testing_day_status", ripAdmin.token, {
      method: "POST",
      body: JSON.stringify({ p_testing_day_id: testingDayId, p_status: "cancelled" })
    });
    const cleanup = await request("rpc/delete_testing_day", ripAdmin.token, {
      method: "POST",
      body: JSON.stringify({ p_testing_day_id: testingDayId })
    });
    if (!cleanup.response.ok) console.error("Testing Day cleanup failed:", cleanup.body);
  }
}

console.log("Testing Day staging RLS checks passed and the session fixture was cleaned up.");
