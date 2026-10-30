import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/require-user";
import { buildTimelineWorkbook, type TimelineExportInput } from "@/lib/timeline-excel";

// Downloads the Project Timeline (summary, Gantt chart, team and testing
// details) as an .xlsx workbook.
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  let input: TimelineExportInput;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!input || !Array.isArray(input.rows) || input.rows.length === 0) {
    return NextResponse.json({ error: "No timeline to export" }, { status: 400 });
  }

  try {
    const buffer = await buildTimelineWorkbook(input);
    const safeTitle =
      String(input.requirementTitle || "project")
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50) || "project";
    const filename = `${safeTitle}-project-timeline-${new Date().toISOString().split("T")[0]}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("❌ Timeline Excel export failed:", error);
    return NextResponse.json({ error: "Failed to create the Excel file" }, { status: 500 });
  }
}
