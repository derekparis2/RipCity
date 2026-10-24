// Only the exact live hostname may use production. Local development, the
// shared staging site, and every deploy preview default to fake-data staging.
// This keeps release previews from reading or writing live Rip City data.
const SUPABASE_ENVIRONMENTS = Object.freeze({
  production: Object.freeze({
    url: "https://fdzmfohcuratbuitkwoy.supabase.co",
    publishableKey: "sb_publishable_PXUw23GznUjqF1S7uX3EBQ_E0sLa1u6",
  }),
  staging: Object.freeze({
    url: "https://xjgmjliqqkhfnqphigbk.supabase.co",
    publishableKey: "sb_publishable_tVBZfT0Mevjl2LqrbtsYag_jV0HQMPD",
  }),
});

const LIVE_SITE_HOSTNAME = "rip-city-training.netlify.app";
const currentHostname = window.location.hostname.toLowerCase();
const SUPABASE_ENVIRONMENT = currentHostname === LIVE_SITE_HOSTNAME
  ? "production"
  : "staging";
const { url: SUPABASE_URL, publishableKey: SUPABASE_PUBLISHABLE_KEY } =
  SUPABASE_ENVIRONMENTS[SUPABASE_ENVIRONMENT];

window.RIP_CITY_ENVIRONMENT = SUPABASE_ENVIRONMENT;

window.db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
