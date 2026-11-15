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

const prompt = readline.createInterface({ input: stdin, output: stdout });
const password = await prompt.question("Shared staging test password (input is not stored): ");
prompt.close();
if (!password) throw new Error("A staging test password is required.");

const [ripAdmin, ripCoach] = await Promise.all([
  signIn("rcadmin@example.com", password),
  signIn("rccoach@example.com", password)
]);

const { body: facilities } = await request(
  "facilities?select=id,slug&slug=eq.rip-city",
  ripAdmin.token
);
const ripCity = facilities[0];
assert(Boolean(ripCity), "Rip City staging facility is available");

const adminMembership = await request(
  `facility_members?select=id,role,status,profile_id,facility_id&facility_id=eq.${ripCity.id}&profile_id=eq.${ripAdmin.userId}`,
  ripAdmin.token
);
const adminMembershipRow = adminMembership.body[0];
assert(
  adminMembership.response.ok
    && adminMembershipRow?.status === "approved"
    && adminMembershipRow?.role === "admin",
  `Rip City admin has approved admin membership (${adminMembership.response.status}: ${JSON.stringify(adminMembership.body)})`
);

const coachMembership = await request(
  `facility_members?select=id,role,status,profile_id,facility_id&facility_id=eq.${ripCity.id}&profile_id=eq.${ripCoach.userId}`,
  ripCoach.token
);
const coachMembershipRow = coachMembership.body[0];
assert(
  coachMembership.response.ok
    && coachMembershipRow?.status === "approved"
    && coachMembershipRow?.role === "coach",
  `Rip City coach has approved coach membership (${coachMembership.response.status}: ${JSON.stringify(coachMembership.body)})`
);

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
let adminWorkoutId = null;
let coachWorkoutId = null;
let coachAssignmentId = null;
let adminAssignmentId = null;

try {
  adminWorkoutId = crypto.randomUUID();
  const adminWorkout = await request("workouts", ripAdmin.token, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      id: adminWorkoutId,
      facility_id: ripCity.id,
      title: `Admin ownership fixture ${suffix}`,
      created_by: ripAdmin.userId
    })
  });
  assert(
    adminWorkout.response.ok,
    `facility admin can create an owned workout (${adminWorkout.response.status}: ${JSON.stringify(adminWorkout.body)})`
  );

  const readableAdminWorkout = await request(
    `workouts?select=id,created_by&id=eq.${adminWorkoutId}`,
    ripAdmin.token
  );
  assert(
    readableAdminWorkout.response.ok
      && readableAdminWorkout.body[0]?.created_by === ripAdmin.userId,
    "facility admin can read the newly created workout"
  );

  coachWorkoutId = crypto.randomUUID();
  const coachWorkout = await request("workouts", ripCoach.token, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      id: coachWorkoutId,
      facility_id: ripCity.id,
      title: `Coach ownership fixture ${suffix}`,
      created_by: ripCoach.userId
    })
  });
  assert(
    coachWorkout.response.ok,
    `ordinary coach can create an owned workout (${coachWorkout.response.status}: ${JSON.stringify(coachWorkout.body)})`
  );

  const readableCoachWorkout = await request(
    `workouts?select=id,created_by&id=eq.${coachWorkoutId}`,
    ripCoach.token
  );
  assert(
    readableCoachWorkout.response.ok
      && readableCoachWorkout.body[0]?.created_by === ripCoach.userId,
    "ordinary coach can read the newly created workout"
  );

  const visibleAdminWorkout = await request(
    `workouts?select=id&id=eq.${adminWorkoutId}`,
    ripCoach.token
  );
  assert(visibleAdminWorkout.body[0]?.id === adminWorkoutId, "coach can still view another staff member's workout");

  const deniedAssignment = await request("workout_assignments?select=id", ripCoach.token, {
    method: "POST",
    body: JSON.stringify({
      workout_id: adminWorkoutId,
      assigned_by: ripCoach.userId,
      target_type: "facility",
      target_facility_id: ripCity.id,
      assigned_date: "2099-01-01"
    })
  });
  assert(!deniedAssignment.response.ok, "ordinary coach cannot assign a workout they did not create");

  const deniedDelete = await request(
    `workouts?id=eq.${adminWorkoutId}&select=id`,
    ripCoach.token,
    { method: "DELETE" }
  );
  assert(
    deniedDelete.response.ok && deniedDelete.body.length === 0,
    "ordinary coach cannot delete a workout they did not create"
  );

  coachAssignmentId = crypto.randomUUID();
  const coachAssignment = await request("workout_assignments", ripCoach.token, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      id: coachAssignmentId,
      workout_id: coachWorkoutId,
      assigned_by: ripCoach.userId,
      target_type: "facility",
      target_facility_id: ripCity.id,
      assigned_date: "2099-01-02"
    })
  });
  assert(
    coachAssignment.response.ok,
    `coach can assign their own workout (${coachAssignment.response.status}: ${JSON.stringify(coachAssignment.body)})`
  );

  const readableCoachAssignment = await request(
    `workout_assignments?select=id&id=eq.${coachAssignmentId}`,
    ripCoach.token
  );
  assert(
    readableCoachAssignment.body[0]?.id === coachAssignmentId,
    "coach can read their own newly created assignment"
  );

  const coachUnassign = await request(
    `workout_assignments?id=eq.${coachAssignmentId}`,
    ripCoach.token,
    { method: "DELETE", headers: { Prefer: "return=minimal" } }
  );
  const removedCoachAssignment = await request(
    `workout_assignments?select=id&id=eq.${coachAssignmentId}`,
    ripCoach.token
  );
  assert(
    coachUnassign.response.ok && removedCoachAssignment.body.length === 0,
    "coach can unassign their own workout"
  );
  coachAssignmentId = null;

  adminAssignmentId = crypto.randomUUID();
  const adminAssignment = await request("workout_assignments", ripAdmin.token, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      id: adminAssignmentId,
      workout_id: coachWorkoutId,
      assigned_by: ripAdmin.userId,
      target_type: "facility",
      target_facility_id: ripCity.id,
      assigned_date: "2099-01-03"
    })
  });
  assert(
    adminAssignment.response.ok,
    `facility admin can assign a coach-created workout (${adminAssignment.response.status}: ${JSON.stringify(adminAssignment.body)})`
  );

  const readableAdminAssignment = await request(
    `workout_assignments?select=id&id=eq.${adminAssignmentId}`,
    ripAdmin.token
  );
  assert(
    readableAdminAssignment.body[0]?.id === adminAssignmentId,
    "facility admin can read the newly created coach-workout assignment"
  );

  const adminUnassign = await request(
    `workout_assignments?id=eq.${adminAssignmentId}`,
    ripAdmin.token,
    { method: "DELETE", headers: { Prefer: "return=minimal" } }
  );
  const removedAdminAssignment = await request(
    `workout_assignments?select=id&id=eq.${adminAssignmentId}`,
    ripAdmin.token
  );
  assert(
    adminUnassign.response.ok && removedAdminAssignment.body.length === 0,
    "facility admin can unassign a coach-created workout"
  );
  adminAssignmentId = null;

  const coachOwnedDelete = await request(
    `workouts?id=eq.${coachWorkoutId}&select=id`,
    ripCoach.token,
    { method: "DELETE" }
  );
  assert(coachOwnedDelete.body[0]?.id === coachWorkoutId, "coach can delete their own workout");
  coachWorkoutId = null;

  const adminOwnedDelete = await request(
    `workouts?id=eq.${adminWorkoutId}&select=id`,
    ripAdmin.token,
    { method: "DELETE" }
  );
  assert(adminOwnedDelete.body[0]?.id === adminWorkoutId, "facility admin can delete any facility workout");
  adminWorkoutId = null;
} finally {
  if (coachAssignmentId) {
    await request(`workout_assignments?id=eq.${coachAssignmentId}`, ripAdmin.token, { method: "DELETE" });
  }
  if (adminAssignmentId) {
    await request(`workout_assignments?id=eq.${adminAssignmentId}`, ripAdmin.token, { method: "DELETE" });
  }
  if (coachWorkoutId) {
    await request(`workouts?id=eq.${coachWorkoutId}`, ripAdmin.token, { method: "DELETE" });
  }
  if (adminWorkoutId) {
    await request(`workouts?id=eq.${adminWorkoutId}`, ripAdmin.token, { method: "DELETE" });
  }
}

console.log("Workout ownership staging checks passed and fixtures were cleaned up.");
