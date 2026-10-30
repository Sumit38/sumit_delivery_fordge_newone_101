import path from 'node:path';
import { authStorageInit, configureAuthSession, setAuthProvider } from '@seontechnologies/playwright-utils/auth-session';
import supabaseAuthProvider from './auth/supabase-auth-provider';

async function globalSetup() {
  // Order matters: storage, then configuration, then provider.
  authStorageInit();

  configureAuthSession({
    storageDir: path.resolve(__dirname, '../../.auth-sessions'),
    debug: false,
  });

  setAuthProvider(supabaseAuthProvider);

  // Tokens are fetched lazily per worker the first time a test asks for
  // `authToken`, so runs without a Supabase TEST project never call it.
}

export default globalSetup;
