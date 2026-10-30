import { NextRequest, NextResponse } from "next/server";

// Vercel rejects request bodies above ~4.5 MB, so keep uploads under 4 MB.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export async function readUploadBuffer(
  request: NextRequest
): Promise<{ buffer: Uint8Array } | { error: NextResponse }> {
  const arrayBuffer = await request.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    return { error: NextResponse.json({ error: "The uploaded file is empty." }, { status: 400 }) };
  }
  if (arrayBuffer.byteLength > MAX_UPLOAD_BYTES) {
    return {
      error: NextResponse.json(
        { error: "File is larger than 4 MB. Please upload a smaller file or paste the text." },
        { status: 413 }
      ),
    };
  }
  return { buffer: new Uint8Array(arrayBuffer) };
}

// Collapse the extra blank lines and spaces that PDF/Word extraction leaves behind.
export function cleanExtractedText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
