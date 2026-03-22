/**
 * One-time script to create a test login account via Supabase Admin API.
 * Run: node --env-file=.env.local scripts/create-test-user.mjs
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...  (from Supabase Dashboard → Settings → API → service_role)
 */

import { createClient } from "@supabase/supabase-js";

// Edit these or pass via env: CREATE_TEST_EMAIL, CREATE_TEST_PASSWORD
const email = process.env.CREATE_TEST_EMAIL ?? "isaacpascua87@gmail.com";
const password = process.env.CREATE_TEST_PASSWORD ?? "test123";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error(
    "Missing env. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local"
  );
  console.error(
    "Get the service_role key from Supabase Dashboard → Project Settings → API → service_role (secret)"
  );
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (error) {
  if (error.message?.includes("already been registered")) {
    console.log("User already exists. You can log in at http://localhost:3000/login");
    console.log("  Email:", email);
    console.log("  Password:", password);
    process.exit(0);
  }
  console.error("Error creating user:", error.message);
  process.exit(1);
}

console.log("Test user created.");
console.log("  Email:", email);
console.log("  Password:", password);
console.log("  User ID:", data.user?.id);
console.log("  Log in at: http://localhost:3000/login");
