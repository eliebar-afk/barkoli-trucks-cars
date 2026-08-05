// Stock Tracker — Supabase connection settings.
//
// 1. Create a free project at https://supabase.com
// 2. In the SQL Editor, run the script from /supabase/schema.sql
// 3. In Project Settings → API, copy the "Project URL" and the "anon public" key below.
// 4. In Authentication → Users, add yourself as a user (email + password) —
//    this is the login used on the stock page. Sign-up is intentionally not
//    exposed on the page, so only accounts you create manually can log in.
//
// The anon key is safe to publish in client-side code: it only grants what the
// Row Level Security policies in schema.sql allow (a signed-in user can only
// ever see their own rows).

window.STOCK_CONFIG = {
  supabaseUrl: "YOUR_SUPABASE_PROJECT_URL",
  supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY"
};
