const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xjfbbanwjvjruoyofkek.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqZmJiYW53anZqcnVveW9ma2VrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTkxNzY0NCwiZXhwIjoyMTAxNDkzNjQ0fQ.AAjnNoOIjTzSZugyFK0JgsxfLzLfzTEDLqjBl4QMHcg';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function createTestUser() {
  try {
    // Create auth user
    const { data: { user }, error: authError } = await supabase.auth.admin.createUser({
      email: 'test@deliveryforge.local',
      password: 'TestPass123!',
      email_confirm: true,
    });

    if (authError) {
      console.error('Auth error:', authError);
      return;
    }

    console.log('✓ User created:', user.id, user.email);

    // Create user profile
    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: user.id,
        clerk_id: user.id,
        email: user.email,
        mobile: '+12025551234',
        organization: 'Test Company',
        role: 'Tester',
      });

    if (profileError) {
      console.error('Profile error:', profileError);
      return;
    }

    console.log('✓ Profile created');
    console.log('\nTest credentials:');
    console.log('Email:', user.email);
    console.log('Password: TestPass123!');
  } catch (err) {
    console.error('Error:', err);
  }
}

createTestUser();
