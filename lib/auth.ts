import { supabase } from './supabase';

export async function signUp(email: string, password: string, userData: {
  mobile: string;
  organization: string;
  role: string;
}) {
  try {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Failed to create user');

    // Create user profile
    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        clerk_id: authData.user.id, // Use auth user ID as clerk_id
        email,
        mobile: userData.mobile,
        organization: userData.organization,
        role: userData.role,
      });

    if (profileError) throw profileError;

    return { success: true, user: authData.user };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    console.error('Signup error:', errorMessage);
    console.error('Full error:', error);
    throw new Error(`Signup failed: ${errorMessage}`);
  }
}

export async function signIn(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    return { success: true, user: data.user };
  } catch (error) {
    console.error('Signin error:', error);
    throw error;
  }
}

export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Signout error:', error);
    throw error;
  }
}

export async function getCurrentUser() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}

export async function getCurrentSession() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  } catch (error) {
    console.error('Get session error:', error);
    return null;
  }
}

export async function signInWithGoogle() {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
      },
    });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Google sign-in error:', error);
    throw error;
  }
}

export async function handleAuthCallback() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;

    if (session?.user) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', session.user.id)
        .single();

      if (!existingUser) {
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: session.user.id,
            clerk_id: session.user.id,
            email: session.user.email || '',
            mobile: '',
            organization: '',
            role: 'Tester',
          });

        if (profileError) throw profileError;
      }
    }

    return { success: true, session };
  } catch (error) {
    console.error('Auth callback error:', error);
    throw error;
  }
}
