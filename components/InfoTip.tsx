"use client";

import { useEffect, useRef, useState } from "react";
import type { CalcNote } from "@/lib/calculation-notes";

interface Props {
  note: CalcNote;
  align?: "left" | "right";
}

// ⓘ icon that opens a short explanation of how a number was calculated.
// Opens on hover or click; click again, press Escape or click elsewhere to close.
export default function InfoTip({ note, align = "left" }: Props) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!pinned) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) {
        setPinned(false);
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [pinned]);

  return (
    <span
      ref={ref}
      className="relative inline-flex align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => !pinned && setOpen(false)}
    >
      <button
        type="button"
        aria-label={`How is "${note.title}" calculated?`}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setPinned(!pinned);
          setOpen(!pinned);
        }}
        className="ml-1 w-4 h-4 rounded-full border border-slate-400 text-slate-500 text-[10px] font-bold leading-none flex items-center justify-center hover:bg-slate-100 hover:text-slate-800"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          className={`absolute z-40 top-6 ${align === "right" ? "right-0" : "left-0"} w-80 max-w-[85vw] rounded-lg border border-slate-200 bg-white p-3 text-left shadow-lg`}
        >
          <span className="block text-xs font-bold text-slate-900 mb-1">{note.title}</span>
          {note.lines.map((line, i) => (
            <span key={i} className="block text-xs text-slate-700 leading-relaxed font-normal">
              {line}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
