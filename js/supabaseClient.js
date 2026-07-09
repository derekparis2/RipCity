const SUPABASE_URL = "https://fdzmfohcuratbuitkwoy.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_PXUw23GznUjqF1S7uX3EBQ_E0sLa1u6";

window.db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);