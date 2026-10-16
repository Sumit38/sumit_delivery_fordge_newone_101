import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const { email, password, mobile, organization, role } = await request.json();

    if (!email || !password || !mobile || !organization || !role) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }
    if (typeof password !== "string" || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      return NextResponse.json({ error: "Server auth not configured" }, { status: 500 });
    }

    const anon = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await anon.auth.signUp({ email, password });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!data.user) {
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }

    const { error: profileError } = await supabaseServer.from("users").insert({
      id: data.user.id,
      clerk_id: data.user.id,
      email,
      mobile,
      organization,
      role,
    });

    if (profileError) {
      console.error("Profile creation error:", profileError);
      return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: data.session ? "Signup successful" : "Check your email to confirm your account",
    });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json({ error: "Signup failed" }, { status: 500 });
  }
}
