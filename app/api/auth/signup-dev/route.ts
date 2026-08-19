import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { supabaseServer } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const { email, password, mobile, organization, role } = await request.json();

    // Create auth user via server admin (not client-side)
    const { data: authData, error: authError } = await supabaseServer.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm for development
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error("Failed to create user");

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
      message: "Signup successful",
    });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Signup failed",
      },
      { status: 400 }
    );
  }
}
