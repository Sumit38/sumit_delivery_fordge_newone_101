// Technical Design Document (.docx) for one architecture design version (browser side).

import {
  AlignmentType,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { LAYER_LABELS, effortSizing, traceability, type ArchAnswer, type ArchDesign, type ArchEffort } from "./architecture-graph";

export interface DocxInput {
  design: ArchDesign;
  answers: ArchAnswer[];
  version: number;
  status: string;
  approvedAt?: string | null;
  requirementTitle: string;
  diagramPng?: { data: ArrayBuffer; width: number; height: number } | null;
  effort?: ArchEffort | null;
}

const p = (text: string, opts: { bold?: boolean; italics?: boolean; size?: number; color?: string } = {}) =>
  new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text, ...opts })] });

const h = (text: string, level: 1 | 2 = 1) =>
  new Paragraph({ text, heading: level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 } });

const bullets = (items: string[]) => items.map((t) => new Paragraph({ text: t, bullet: { level: 0 }, spacing: { after: 60 } }));

function table(headers: string[], rows: string[][], widths?: number[]) {
  const cell = (text: string, header = false, i = 0) =>
    new TableCell({
      width: widths ? { size: widths[i], type: WidthType.PERCENTAGE } : undefined,
      shading: header ? { type: ShadingType.CLEAR, color: "auto", fill: "1E3A8A" } : undefined,
      children: [new Paragraph({ children: [new TextRun({ text, bold: header, color: header ? "FFFFFF" : undefined, size: 18 })] })],
    });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((x, i) => cell(x, true, i)) }),
      ...rows.map((r) => new TableRow({ children: r.map((x, i) => cell(x, false, i)) })),
    ],
  });
}

export async function buildArchitectureDocx(input: DocxInput): Promise<Blob> {
  const { design } = input;
  const byId = new Map(design.components.map((c) => [c.id, c]));
  const stepLabel = new Map(design.steps.map((s) => [s.no, s.label]));
  const stepsText = (list: number[]) => (list.length ? list.map((n) => `${n}. ${stepLabel.get(n) || ""}`).join("; ") : "—");
  const trace = traceability(design);
  const sizing = input.effort?.tasks?.length ? effortSizing(design, input.effort) : null;
  const totalPoints = design.steps.reduce((a, x) => a + x.points, 0);
  const children: Array<Paragraph | Table> = [];

  children.push(
    new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: "Technical Design Document", size: 22, color: "64748B" })] }),
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: design.title || input.requirementTitle })] }),
    p(
      `Version ${input.version} · ${input.status === "approved" ? `Approved${input.approvedAt ? ` on ${new Date(input.approvedAt).toLocaleDateString()}` : ""}` : input.status === "superseded" ? "Superseded" : "Draft for review"} · Requirement: ${input.requirementTitle}`,
      { color: "475569", size: 20 }
    ),
    p(
      `Built from the requirement's complexity analysis: ${design.steps.length} process steps (${totalPoints} points). ${trace.unassigned.length ? `${trace.unassigned.length} step(s) are not yet delivered by any component (see Traceability).` : "Every step is delivered by at least one component."}`,
      { italics: true, size: 20 }
    )
  );

  let n = 0;
  const section = (title: string) => children.push(h(`${++n}. ${title}`));

  section("Overview");
  children.push(p(design.summary || "—"));

  section("Architecture Diagram");
  if (input.diagramPng) {
    const maxW = 600;
    const scale = Math.min(1, maxW / input.diagramPng.width);
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            type: "png",
            data: input.diagramPng.data,
            transformation: { width: Math.round(input.diagramPng.width * scale), height: Math.round(input.diagramPng.height * scale) },
          }),
        ],
      })
    );
  } else {
    children.push(p("The diagram could not be drawn in this browser; see the components below.", { italics: true }));
  }

  section("Architecture Decisions");
  children.push(
    table(
      ["Decision", "Choice", "Reason", "Based on"],
      design.decisions.map((d) => [d.decision, d.choice, d.reason, d.basedOn.join(", ") || "—"]),
      [22, 22, 44, 12]
    )
  );

  section("Components");
  children.push(
    table(
      ["Component", "Layer", "Technology", "Responsibilities", "Graph steps"],
      design.components.map((c) => [
        `${c.name}${c.external ? " (external)" : ""}`,
        LAYER_LABELS[c.layer],
        c.technology || "—",
        c.responsibilities || "—",
        c.steps.join(", ") || "—",
      ]),
      [20, 15, 18, 35, 12]
    )
  );
  if (design.connections.length) {
    children.push(h("Connections", 2));
    children.push(...bullets(design.connections.map((k) => `${byId.get(k.from)?.name} → ${byId.get(k.to)?.name}${k.label ? ` (${k.label})` : ""}`)));
  }

  const sections: Array<[string, string]> = [
    ["Integration Approach", design.sections.integration],
    ["Data Architecture", design.sections.data],
    ["Security & Access", design.sections.security],
    ["Non-Functional Requirements", design.sections.nfr],
    ["Deployment & Environments", design.sections.deployment],
  ];
  for (const [title, text] of sections) {
    if (!text) continue;
    section(title);
    children.push(p(text));
  }

  section("Risk Register");
  children.push(
    table(
      ["Risk", "Impact", "Likelihood", "Mitigation (act now)", "Affected steps"],
      design.risks.map((r) => [r.risk, r.impact, r.likelihood, r.mitigation, r.steps.join(", ") || "—"]),
      [30, 10, 10, 38, 12]
    )
  );

  section("Traceability: Process Steps to Components");
  children.push(
    table(
      ["#", "Process step", "Points", "Delivered by"],
      trace.rows.map((r) => [String(r.no), r.label, String(r.points), r.components.map((id) => byId.get(id)?.name || id).join(", ") || "NOT ASSIGNED"]),
      [6, 50, 9, 35]
    )
  );

  section("Estimated Build Hours");
  if (sizing && input.effort) {
    children.push(
      p(
        `Tasks needed to build each component, with low / likely / high hours for one mid-level developer who knows the technology${sizing.edited ? " (some figures edited by the reviewer)" : ""}. Testing, analysis and project management are not included; the estimation adds them and applies team seniority and technology familiarity. Total: ${sizing.low} / ${sizing.likely} / ${sizing.high} hours over ${sizing.taskCount} tasks.`
      ),
      table(
        ["Component", "Task", "Steps", "Low", "Likely", "High"],
        [
          ...sizing.components.flatMap((c) => [
            [`${c.name}`, `Subtotal (${c.tasks} tasks)`, c.steps.join(", ") || "—", String(c.low), String(c.likely), String(c.high)],
            ...input.effort!.tasks
              .filter((t) => t.component === c.id)
              .map((t) => ["", t.task + (t.edited ? " (edited)" : ""), t.steps.join(", ") || "—", String(t.low), String(t.likely), String(t.high)]),
          ]),
          ["Total", "", "", String(sizing.low), String(sizing.likely), String(sizing.high)],
        ],
        [20, 44, 9, 9, 9, 9]
      )
    );
    if (sizing.withoutTasks.length) children.push(p(`Components without estimated tasks: ${sizing.withoutTasks.join(", ")}.`, { italics: true }));
  } else {
    children.push(p("The build hours of this version have not been estimated yet (Architecture tab → Estimate hours).", { italics: true }));
  }

  section("Assumptions");
  children.push(...bullets(design.assumptions.length ? design.assumptions : ["None recorded."]));
  section("Open Questions");
  children.push(...bullets(design.openQuestions.length ? design.openQuestions : ["None recorded."]));

  section("Architecture Questions & Answers");
  children.push(
    table(
      ["#", "Question", "Answer"],
      input.answers.map((a) => [a.id, `${a.question}${a.topic ? ` (${a.topic})` : ""}`, a.answer.length ? a.answer.join("; ") + (a.note ? ` — ${a.note}` : "") : "Skipped (treated as an assumption)"]),
      [8, 52, 40]
    )
  );

  const doc = new Document({
    creator: "DeliveryForge",
    title: `Technical Design - ${design.title || input.requirementTitle}`,
    styles: { default: { document: { run: { font: "Calibri", size: 21 } } } },
    sections: [{ children }],
  });
  return Packer.toBlob(doc);
}

// Renders the Mermaid diagram to SVG (plain text labels, so it can also be turned into a PNG)
export async function renderArchitectureSvg(code: string, id: string): Promise<string> {
  const mermaid = (await import("mermaid")).default;
  mermaid.initialize({
    startOnLoad: false,
    theme: "default",
    securityLevel: "strict",
    htmlLabels: false,
    flowchart: { htmlLabels: false, curve: "basis", nodeSpacing: 40, rankSpacing: 60, padding: 12 },
    themeVariables: { fontSize: "15px" },
    maxTextSize: 500_000,
  });
  const { svg } = await mermaid.render(id, code);
  return svg;
}

export async function svgToPng(svg: string, scale = 2): Promise<{ data: ArrayBuffer; width: number; height: number } | null> {
  try {
    const el = new DOMParser().parseFromString(svg, "image/svg+xml").documentElement;
    const vb = (el.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number);
    const width = Math.ceil(vb[2] || Number(el.getAttribute("width")) || 800);
    const height = Math.ceil(vb[3] || Number(el.getAttribute("height")) || 600);
    el.setAttribute("width", String(width));
    el.setAttribute("height", String(height));
    el.removeAttribute("style");
    const text = new XMLSerializer().serializeToString(el);
    const url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml;charset=utf-8" }));
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("image load failed"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return null;
    return { data: await blob.arrayBuffer(), width, height };
  } catch (err) {
    console.error("Diagram to PNG failed:", err);
    return null;
  }
}
