import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { testEnv, testUserEmail } from './test-env';

/**
 * Admin access to the Supabase TEST project, for creating test users and
 * cleaning up their data. Uses the service-role key, so it must only ever
 * point at the test project (see .env.example).
 */

let adminClient: SupabaseClient | null = null;

function admin(): SupabaseClient {
  if (!adminClient) {
    if (!testEnv.allowUserCreation) {
      throw new Error('Refusing to use the Supabase admin API: set ALLOW_TEST_USER_CREATION=true in .env.test (test project only).');
    }
    adminClient = createClient(testEnv.supabaseUrl, testEnv.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

/** Creates the test user for an identifier if it doesn't exist yet. Returns the user id. */
export async function ensureTestUser(userIdentifier: string): Promise<string> {
  const email = testUserEmail(userIdentifier);
  const client = admin();

  const created = await client.auth.admin.createUser({
    email,
    password: testEnv.userPassword,
    email_confirm: true,
  });
  if (created.data.user) return created.data.user.id;

  // Already registered: look the user up instead.
  const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`Could not list test users: ${error.message}`);
  const existing = data.users.find((user) => user.email === email);
  if (!existing) throw new Error(`Could not create or find test user ${email}: ${created.error?.message}`);
  return existing.id;
}

/**
 * Deletes everything a test user owns. Child rows (results, stories, timelines,
 * estimations) go first, then the requirements themselves.
 */
export async function deleteUserData(userId: string): Promise<void> {
  const client = admin();
  const { data: requirements } = await client.from('requirements').select('id').eq('user_id', userId);
  const ids = (requirements ?? []).map((row: { id: string }) => row.id);

  if (ids.length > 0) {
    for (const table of ['user_stories', 'project_timelines', 'complexity_results', 'estimations']) {
      await client.from(table).delete().in('requirement_id', ids);
    }
    await client.from('requirements').delete().in('id', ids);
  }
}
