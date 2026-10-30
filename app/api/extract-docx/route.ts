import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import { requireUser } from "@/lib/require-user";
import { cleanExtractedText, readUploadBuffer } from "@/lib/file-text-extract";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  const upload = await readUploadBuffer(request);
  if ("error" in upload) return upload.error;

  try {
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(upload.buffer) });
    const cleaned = cleanExtractedText(value);

    if (!cleaned) {
      return NextResponse.json(
        { error: "No readable text found in this Word document." },
        { status: 422 }
      );
    }

    return NextResponse.json({ text: cleaned });
  } catch (error) {
    console.error("DOCX extraction failed:", error);
    return NextResponse.json(
      { error: "Could not read this Word file. Please make sure it is a .docx (not the older .doc) file." },
      { status: 422 }
    );
  }
}
