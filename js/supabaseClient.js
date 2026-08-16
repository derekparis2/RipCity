// v2-development intentionally uses the fake-data staging project. The live
// production site remains on main and must keep its production Supabase values.
const SUPABASE_URL = "https://xjgmjliqqkhfnqphigbk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_tVBZfT0Mevjl2LqrbtsYag_jV0HQMPD";

window.db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
