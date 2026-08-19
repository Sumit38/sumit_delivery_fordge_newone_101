import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  // DOCX support requires proper ZIP + XML parsing libraries
  // For now, direct users to convert or paste instead
  return NextResponse.json(
    {
      error: "DOCX support requires document conversion",
      instructions: [
        "1. Open the DOCX file in Microsoft Word or Google Docs",
        "2. Copy all the text (Ctrl+A, then Ctrl+C)",
        "3. Come back here and select 'Paste Text' tab",
        "4. Paste the content there",
        "",
        "OR convert DOCX → PDF or TXT first, then upload"
      ].join("\n"),
    },
    { status: 400 }
  );
}
