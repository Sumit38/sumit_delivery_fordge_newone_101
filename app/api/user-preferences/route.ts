import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { requireUser } from "@/lib/require-user";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (auth.error) return auth.error;
    const userId = auth.userId;

    const { data, error } = await supabaseServer
      .from("users")
      .select("preferences")
      .eq("id", userId)
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch preferences" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      preferences: data?.preferences || {
        timeline_enabled: false,
        pitch_deck_enabled: false,
      },
    });
  } catch (error) {
    console.error("Error fetching preferences:", error);
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

    const { data: existingData } = await supabaseServer
      .from("users")
      .select("preferences")
      .eq("id", userId)
      .single();

    const existingPreferences = existingData?.preferences || {
      timeline_enabled: false,
      pitch_deck_enabled: false,
    };

    let updatedPreferences: any;

    if (body.preferences) {
      updatedPreferences = { ...existingPreferences, ...body.preferences };
    } else {
      updatedPreferences = { ...existingPreferences, ...body };
    }

    const { data, error } = await supabaseServer
      .from("users")
      .update({ preferences: updatedPreferences })
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      console.error("Error updating preferences:", error);
      return NextResponse.json(
        { error: "Failed to update preferences" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      preferences: data?.preferences || updatedPreferences,
    });
  } catch (error) {
    console.error("Error updating preferences:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
