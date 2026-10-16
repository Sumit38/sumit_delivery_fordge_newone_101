import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { requireUser } from "@/lib/require-user";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.error) return auth.error;
    const userId = auth.userId;

    const { data: user, error } = await supabaseServer
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.error) return auth.error;
    const userId = auth.userId;

    const body = await request.json();
    const { mobile, organization, role, email } = body;

    if (!mobile || !organization || !role || !email) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const { data: existingUser } = await supabaseServer
      .from("users")
      .select("id")
      .eq("id", userId)
      .single();

    if (existingUser) {
      const { data, error } = await supabaseServer
        .from("users")
        .update({
          mobile,
          organization,
          role,
          email,
        })
        .eq("id", userId)
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { error: "Failed to update profile" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        user: data,
      });
    } else {
      const { data, error } = await supabaseServer
        .from("users")
        .insert({
          id: userId,
          mobile,
          organization,
          role,
          email,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { error: "Failed to create profile" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        user: data,
      });
    }
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
