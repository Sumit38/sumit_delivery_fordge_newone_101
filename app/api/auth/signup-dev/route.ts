import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseServer } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const { email, password, mobile, organization, role } = await request.json();

    // Create auth user via client
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error("Failed to create user");

    // Auto-confirm email for development
    const { error: confirmError } = await supabaseServer.auth.admin.updateUserById(
      authData.user.id,
      { email_confirm: true }
    );

    if (confirmError) {
      console.warn("Could not auto-confirm email:", confirmError);
      // Don't fail, just warn
    }

    // Create user profile
    const { error: profileError } = await supabaseServer
      .from("users")
      .insert({
        id: authData.user.id,
        clerk_id: authData.user.id,
        email,
        mobile,
        organization,
        role,
      });

    if (profileError) throw profileError;

    return NextResponse.json({
      success: true,
      user: authData.user,
      message: "Signup successful with auto-confirmed email",
    });
  } catch (error) {
    console.error("Dev signup error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Signup failed",
      },
      { status: 400 }
    );
  }
}
