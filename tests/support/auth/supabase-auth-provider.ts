import {
  type AuthProvider,
  AuthSessionManager,
  authStorageInit,
  getStorageDir,
  getTokenFilePath,
  loadStorageState,
  saveStorageState,
} from '@seontechnologies/playwright-utils/auth-session';
import { ensureTestUser } from '../helpers/supabase-admin';
import { supabaseProjectRef, testEnv, testUserEmail } from '../helpers/test-env';

/**
 * Auth provider for DeliveryForge's Supabase email/password login.
 *
 * - API tests send `Authorization: Bearer <access_token>` (what lib/require-user.ts expects).
 * - Browser tests get the session in localStorage under `sb-<ref>-auth-token`,
 *   which is where supabase-js looks for it, so pages load already signed in.
 * - Each Playwright worker signs in as its own user (worker-0, worker-1, …), so
 *   per-user data and the per-user rate limit never collide between workers.
 */

const ACCESS_TOKEN_KEY = 'df_access_token';
const EXPIRY_SKEW_MS = 60_000;

type StorageState = {
  cookies: unknown[];
  origins: Array<{ origin: string; localStorage: Array<{ name: string; value: string }> }>;
};

function decodeJwtExpiry(token: string): number {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')) as { exp?: number };
  return (payload.exp ?? 0) * 1000;
}

const supabaseAuthProvider: AuthProvider = {
  getEnvironment: (options) => options?.environment || testEnv.environment,

  getUserIdentifier: (options) => options?.userIdentifier || `worker-${process.env.TEST_PARALLEL_INDEX ?? '0'}`,

  getBaseUrl: (options) => options?.baseUrl || testEnv.baseUrl,

  extractToken(tokenData) {
    const state = tokenData as unknown as StorageState;
    const entry = state.origins?.[0]?.localStorage?.find((item) => item.name === ACCESS_TOKEN_KEY);
    return entry?.value ?? null;
  },

  // Supabase keeps the browser session in localStorage, not cookies.
  extractCookies: () => [],

  extractStorage(tokenData) {
    return (tokenData as unknown as StorageState).origins ?? [];
  },

  isTokenExpired(rawToken) {
    try {
      return Date.now() > decodeJwtExpiry(rawToken) - EXPIRY_SKEW_MS;
    } catch {
      return true;
    }
  },

  async manageAuthToken(request, options = {}) {
    const environment = this.getEnvironment(options);
    const userIdentifier = this.getUserIdentifier(options);
    const tokenPath = getTokenFilePath({ environment, userIdentifier, tokenFileName: 'storage-state.json' });

    const cached = loadStorageState(tokenPath);
    const cachedToken = cached ? this.extractToken(cached) : null;
    if (cached && cachedToken && !this.isTokenExpired?.(cachedToken)) return cached;

    authStorageInit({ environment, userIdentifier });
    await ensureTestUser(userIdentifier);

    // Raw request is allowed here: the auth provider runs before the fixtures exist.
    const response = await request.post(`${testEnv.supabaseUrl}/auth/v1/token?grant_type=password`, {
      headers: { apikey: testEnv.supabaseAnonKey, 'Content-Type': 'application/json' },
      data: { email: testUserEmail(userIdentifier), password: testEnv.userPassword },
    });
    if (!response.ok()) {
      throw new Error(`Supabase sign-in failed for ${userIdentifier}: ${response.status()} ${await response.text()}`);
    }
    const session = (await response.json()) as { access_token: string };

    const storageState: StorageState = {
      cookies: [],
      origins: [
        {
          origin: this.getBaseUrl?.(options) ?? testEnv.baseUrl,
          localStorage: [
            { name: `sb-${supabaseProjectRef()}-auth-token`, value: JSON.stringify(session) },
            { name: ACCESS_TOKEN_KEY, value: session.access_token },
          ],
        },
      ],
    };

    saveStorageState(tokenPath, storageState);
    return storageState;
  },

  clearToken(options = {}) {
    const storageDir = getStorageDir({
      environment: this.getEnvironment(options),
      userIdentifier: this.getUserIdentifier(options),
    });
    AuthSessionManager.getInstance({ storageDir }).clearToken();
  },
};

export default supabaseAuthProvider;
