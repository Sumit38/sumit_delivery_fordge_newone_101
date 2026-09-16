import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = JSON.parse(
      Buffer.from(parts[1], 'base64').toString('utf-8')
    );
    const userId = decoded.sub;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user preferences
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
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = JSON.parse(
      Buffer.from(parts[1], 'base64').toString('utf-8')
    );
    const userId = decoded.sub;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Get existing preferences first
    const { data: existingData } = await supabaseServer
      .from("users")
      .select("preferences")
      .eq("id", userId)
      .single();

    const existingPreferences = existingData?.preferences || {
      timeline_enabled: false,
      pitch_deck_enabled: false,
    };

    // Check if body has 'preferences' object or individual fields
    let updatedPreferences: any;

    if (body.preferences) {
      // If preferences object is provided, use it
      updatedPreferences = { ...existingPreferences, ...body.preferences };
    } else {
      // Otherwise, merge individual fields
      updatedPreferences = { ...existingPreferences, ...body };
    }

    console.log("Updating preferences:", updatedPreferences);

    // Update user preferences
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
