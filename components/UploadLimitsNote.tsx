import { MAX_ANALYSIS_CHARS, MAX_UPLOAD_MB } from "@/lib/read-requirement-file";

// Size limits shown on the Requirement Analysis tab, so users know up front
// how large a document can be and how much of it is analysed.
export function UploadLimitsNote() {
  return (
    <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg text-xs text-sky-900 space-y-1">
      <p className="font-semibold">📏 Document size limits</p>
      <ul className="list-disc ml-4 space-y-0.5">
        <li>
          Upload: <b>.txt, .pdf or .docx, up to {MAX_UPLOAD_MB} MB per file</b>. Scanned (image-only) PDFs can&apos;t be read;
          paste their text instead.
        </li>
        <li>
          The analysis reads up to <b>{MAX_ANALYSIS_CHARS.toLocaleString()} characters</b> (about 12,000 words, 25–30
          pages). Text beyond that is not analysed.
        </li>
        <li>
          Best results: up to about 15 pages per document. For a larger specification, split it by module and use
          <b> Combine 2–3 documents</b>.
        </li>
      </ul>
    </div>
  );
}

// Warning shown when the loaded text is longer than the analysis reads
export function OverLimitWarning({ length }: { length: number }) {
  if (length <= MAX_ANALYSIS_CHARS) return null;
  return (
    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 mt-2">
      ⚠️ This text has {length.toLocaleString()} characters. Only the first {MAX_ANALYSIS_CHARS.toLocaleString()} will be
      analysed. Split it into modules and use Combine 2–3 documents to cover all of it.
    </p>
  );
}
