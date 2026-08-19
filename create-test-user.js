const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://xfzjtnhblkcfdpjfvpsk.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY not set in environment");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTestUser() {
  try {
    console.log("🔍 Creating test user with auto-confirmed email...");

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: "demo@test.com",
      password: "Demo@12345",
      email_confirm: true,
      user_metadata: {
        test_user: true,
      },
    });

    if (authError) {
      console.error("❌ Auth error:", authError);
      throw authError;
    }

    console.log("✅ Auth user created:", authData.user.id);

    // Create user profile
    const { data: profileData, error: profileError } = await supabase
      .from("users")
      .insert({
        id: authData.user.id,
        clerk_id: authData.user.id,
        email: "demo@test.com",
        mobile: "+1-234-567-8900",
        organization: "Demo Company",
        role: "Tester",
      })
      .select()
      .single();

    if (profileError) {
      console.error("❌ Profile error:", profileError);
      throw profileError;
    }

    console.log("✅ User profile created");
    console.log("\n🎉 TEST USER CREATED SUCCESSFULLY!\n");
    console.log("📧 Email: demo@test.com");
    console.log("🔐 Password: Demo@12345");
    console.log("👤 Organization: Demo Company");
    console.log("💼 Role: Tester");
    console.log("🆔 User ID:", authData.user.id);

  } catch (error) {
    console.error("❌ Error creating test user:", error);
    process.exit(1);
  }
}

createTestUser();
