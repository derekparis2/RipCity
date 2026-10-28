import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const SUPABASE_URL = "https://xjgmjliqqkhfnqphigbk.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_tVBZfT0Mevjl2LqrbtsYag_jV0HQMPD";
const FIXTURE_EMAILS = [
  "alphaadmin@example.com",
  "alphaathlete@example.com",
  "alphacoach@example.com",
  "rcadmin@example.com",
  "rcathlete@example.com",
  "rccoach@example.com",
  "rch2k@example.com",
  "rcinactive@example.com",
  "rcpending@example.com"
];

async function signIn(email, password) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${email} login failed: ${body.msg || body.error_description}`);
  return { email, token: body.access_token, userId: body.user.id };
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

async function currentAcceptance(account) {
  return request("rpc/get_current_legal_acceptance", account.token, {
    method: "POST",
    body: "{}"
  });
}

async function acceptCurrent(account, ageBracket) {
  return request("rpc/record_current_legal_acceptance", account.token, {
    method: "POST",
    body: JSON.stringify({
      p_age_bracket: ageBracket,
      p_guardian_permission_confirmed: ageBracket === "13_to_17",
      p_legal_terms_confirmed: true
    })
  });
}

const prompt = readline.createInterface({ input: stdin, output: stdout });
const password = await prompt.question("Shared staging test password (input is not stored): ");
prompt.close();
if (!password) throw new Error("A staging test password is required.");

const accounts = await Promise.all(FIXTURE_EMAILS.map(email => signIn(email, password)));
const athlete = accounts.find(account => account.email === "rcathlete@example.com");
const alphaAthlete = accounts.find(account => account.email === "alphaathlete@example.com");

const initial = await currentAcceptance(athlete);
assert(initial.response.ok && initial.body.length === 1, "authenticated users can read the current legal-document pair");
assert(initial.body[0].terms_version === "2026-10-25", "the expected Terms version is current");
assert(initial.body[0].privacy_version === "2026-10-25", "the expected Privacy version is current");

const invalidMinor = await request("rpc/record_current_legal_acceptance", athlete.token, {
  method: "POST",
  body: JSON.stringify({
    p_age_bracket: "13_to_17",
    p_guardian_permission_confirmed: false,
    p_legal_terms_confirmed: true
  })
});
assert(!invalidMinor.response.ok, "a minor cannot accept without confirming parent or guardian permission");

const directInsert = await request("legal_acceptances", athlete.token, {
  method: "POST",
  body: JSON.stringify({
    user_id: athlete.userId,
    terms_document_id: initial.body[0].terms_document_id,
    privacy_document_id: initial.body[0].privacy_document_id,
    age_bracket: "18_or_older"
  })
});
assert(!directInsert.response.ok, "clients cannot bypass the guarded acceptance RPC with a direct insert");

for (const account of accounts) {
  const ageBracket = account.email === "rcathlete@example.com" ? "13_to_17" : "18_or_older";
  const saved = await acceptCurrent(account, ageBracket);
  assert(saved.response.ok && saved.body.length === 1, `${account.email} can accept the current document pair`);
}

const accepted = await currentAcceptance(athlete);
assert(accepted.response.ok && accepted.body[0].accepted === true, "the member is recognized as having accepted the exact current pair");
assert(accepted.body[0].age_bracket === "13_to_17", "the member's selected age bracket is preserved");

const ownRows = await request(
  `legal_acceptances?select=id,user_id,accepted_at,age_bracket&user_id=eq.${athlete.userId}`,
  athlete.token
);
assert(ownRows.response.ok && ownRows.body.length === 1, "the member can read exactly one own acceptance for the current pair");

const repeated = await acceptCurrent(athlete, "13_to_17");
const ownRowsAfterRepeat = await request(
  `legal_acceptances?select=id,user_id,accepted_at,age_bracket&user_id=eq.${athlete.userId}`,
  athlete.token
);
assert(repeated.response.ok && ownRowsAfterRepeat.body.length === 1, "repeating acceptance is idempotent and does not duplicate evidence");
assert(ownRowsAfterRepeat.body[0].id === ownRows.body[0].id, "repeating acceptance preserves the original acceptance row");

const crossUserRead = await request(
  `legal_acceptances?select=id&user_id=eq.${athlete.userId}`,
  alphaAthlete.token
);
assert(crossUserRead.response.ok && crossUserRead.body.length === 0, "another user cannot read someone else's acceptance evidence");

console.log("Versioned legal-acceptance staging checks passed; all standard fake accounts now accept the current beta documents.");
