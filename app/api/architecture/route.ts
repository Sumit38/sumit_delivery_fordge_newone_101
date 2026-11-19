import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/require-user";
import { listDesigns } from "@/lib/architecture-store";

// The architecture design versions of one analysed requirement
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;
  const requirementId = request.nextUrl.searchParams.get("requirementId") || "";
  if (!requirementId) return NextResponse.json({ error: "requirementId is required" }, { status: 400 });
  try {
    const rows = await listDesigns(requirementId, auth.userId);
    return NextResponse.json({
      latest: rows[0] || null,
      approved: rows.find((r) => r.status === "approved") || null,
      versions: rows,
    });
  } catch (err) {
    console.error("Architecture list failed:", err);
    return NextResponse.json({ error: "Could not load the architecture designs" }, { status: 500 });
  }
}
