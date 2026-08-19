import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  // PDF extraction requires proper decompression + text extraction
  // (pdfjs-dist, pdf-parse, or similar libraries)
  // For now, direct users to extract text manually
  return NextResponse.json(
    {
      error: "PDF support requires text extraction tool",
      instructions: [
        "1. Open the PDF file in Adobe Reader, Chrome, or similar viewer",
        "2. Select all text (Ctrl+A)",
        "3. Copy it (Ctrl+C)",
        "4. Come back here and select 'Paste Text' tab",
        "5. Paste the content (Ctrl+V)",
        "",
        "OR use online tools:",
        "- https://smallpdf.com/pdf-to-text",
        "- https://pdfcandy.com/pdf-to-text.html",
        "Then upload the extracted .txt file"
      ].join("\n"),
    },
    { status: 400 }
  );
}
