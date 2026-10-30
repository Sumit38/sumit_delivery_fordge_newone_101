import { authFetch } from "@/lib/auth-fetch";

interface ExportArgs {
  scenarios: unknown[];
  requirementTitle: string;
  requirementText?: string;
  complexity: { n: number; e: number; p: number; complexityScore: number };
}

// Downloads the extracted test scenarios and test cases as an .xlsx workbook.
export async function downloadTestScenariosExcel(args: ExportArgs): Promise<void> {
  const response = await authFetch("/api/export-excel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Download failed");
  }

  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : "test-scenarios.xlsx";

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
