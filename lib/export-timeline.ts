import { authFetch } from "@/lib/auth-fetch";
import type { TimelineExportInput } from "@/lib/timeline-excel";

// Downloads the Project Timeline as an .xlsx workbook.
export async function downloadTimelineExcel(input: TimelineExportInput): Promise<void> {
  const response = await authFetch("/api/export-timeline-excel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Download failed");
  }

  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : "project-timeline.xlsx";

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
