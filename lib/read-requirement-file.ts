import { authFetch } from "@/lib/auth-fetch";

export const REQUIREMENT_FILE_ACCEPT =
  ".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const REQUIREMENT_FILE_LABEL = ".txt, .pdf, .docx (max 4 MB)";

const MAX_BYTES = 4 * 1024 * 1024;

async function extractOnServer(endpoint: string, file: File): Promise<string> {
  const response = await authFetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: await file.arrayBuffer(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || typeof data.text !== "string") {
    throw new Error(data.error || "Could not read the file. Please paste the text instead.");
  }
  return data.text;
}

// Reads a requirement file (.txt, .pdf, .docx) and returns its plain text.
export async function readRequirementFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (file.size > MAX_BYTES) {
    throw new Error("File is larger than 4 MB. Please upload a smaller file or paste the text.");
  }

  if (name.endsWith(".txt") || file.type === "text/plain") {
    return (await file.text()).trim();
  }
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    return extractOnServer("/api/extract-pdf", file);
  }
  if (name.endsWith(".docx")) {
    return extractOnServer("/api/extract-docx", file);
  }
  if (name.endsWith(".doc")) {
    throw new Error("Old Word (.doc) files are not supported. Please save it as .docx and upload again.");
  }

  throw new Error(`Unsupported file type. Supported formats: ${REQUIREMENT_FILE_LABEL}`);
}
