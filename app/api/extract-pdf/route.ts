import { NextRequest, NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { requireUser } from "@/lib/require-user";
import { cleanExtractedText, readUploadBuffer } from "@/lib/file-text-extract";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  const upload = await readUploadBuffer(request);
  if ("error" in upload) return upload.error;

  try {
    const pdf = await getDocumentProxy(upload.buffer);
    const { text } = await extractText(pdf, { mergePages: true });
    const cleaned = cleanExtractedText(Array.isArray(text) ? text.join("\n\n") : text);

    if (!cleaned) {
      return NextResponse.json(
        {
          error:
            "No readable text found in this PDF. It may be a scanned image. Please paste the text instead.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ text: cleaned });
  } catch (error) {
    console.error("PDF extraction failed:", error);
    return NextResponse.json(
      { error: "Could not read this PDF. It may be password-protected or damaged." },
      { status: 422 }
    );
  }
}
