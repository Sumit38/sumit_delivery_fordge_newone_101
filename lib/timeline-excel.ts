// Builds the Project Timeline Excel workbook (server side, uses exceljs).
// Sheets: Summary, Gantt Chart (bars drawn as coloured week cells), and when
// the timeline comes from a detailed estimation: Team Workload, Testing
// Activities, Gaps & Risks.

import ExcelJS from "exceljs";
import type { ComprehensiveDetails, StaffLoad } from "./estimation-team";

export interface TimelineRowInput {
  label: string;
  group: string;
  start: number; // weeks
  end: number; // weeks
  color: string; // #rrggbb
  note?: string;
}

export interface TimelineExportInput {
  requirementTitle: string;
  complexityScore: number;
  totalWeeks: number;
  totalDays: number;
  devManDays: number;
  qaManDays: number;
  source: "estimation" | "quick";
  rows: TimelineRowInput[];
  milestones?: Array<{ label: string; week: number }>;
  details?: ComprehensiveDetails;
}

const MAX_WEEKS = 104;
const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3A5F" } };
const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFD9D9D9" } },
  bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
  left: { style: "thin", color: { argb: "FFD9D9D9" } },
  right: { style: "thin", color: { argb: "FFD9D9D9" } },
};

const num = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const r1 = (n: number) => Math.round(n * 10) / 10;
const text = (v: unknown, max = 500) => String(v ?? "").slice(0, max);

function argb(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  return `FF${(m ? m[1] : "3b82f6").toUpperCase()}`;
}

function header(sheet: ExcelJS.Worksheet, row = 1) {
  const r = sheet.getRow(row);
  r.font = { bold: true, color: { argb: "FFFFFFFF" } };
  r.fill = HEADER_FILL;
  r.alignment = { vertical: "middle", wrapText: true };
  r.height = 22;
}

function body(sheet: ExcelJS.Worksheet, fromRow = 2) {
  sheet.eachRow((row, n) => {
    if (n < fromRow) return;
    row.alignment = { vertical: "top", wrapText: true };
    row.eachCell((c) => (c.border = BORDER));
  });
}

function loadsTable(sheet: ExcelJS.Worksheet, title: string, loads: StaffLoad[]) {
  if (!loads.length) return;
  sheet.addRow([]);
  const t = sheet.addRow([title]);
  t.font = { bold: true, size: 12 };
  const h = sheet.addRow(["Role", "People", "Seniority", "Hours", "Weeks", "Work"]);
  h.font = { bold: true, color: { argb: "FFFFFFFF" } };
  h.fill = HEADER_FILL;
  for (const l of loads) {
    const row = sheet.addRow([l.label, l.count, l.seniority, l.hours, l.weeks, l.tasks.join(", ")]);
    row.eachCell((c) => (c.border = BORDER));
    row.alignment = { vertical: "top", wrapText: true };
    if (l.role === "unstaffed") row.font = { color: { argb: "FFC62828" }, bold: true };
  }
}

export async function buildTimelineWorkbook(input: TimelineExportInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "DeliveryForge";
  wb.created = new Date();

  const totalWeeks = Math.min(MAX_WEEKS, Math.max(1, Math.ceil(num(input.totalWeeks, 1))));
  const rows = (Array.isArray(input.rows) ? input.rows : []).slice(0, 200).map((r) => ({
    label: text(r.label, 200),
    group: text(r.group, 50),
    start: Math.max(0, num(r.start)),
    end: Math.max(0, num(r.end)),
    color: text(r.color, 7),
    note: text(r.note),
  }));
  const d = input.source === "estimation" ? input.details : undefined;

  // ---------- Summary ----------
  const summary = wb.addWorksheet("Summary");
  summary.columns = [
    { header: "Item", key: "item", width: 32 },
    { header: "Value", key: "value", width: 70 },
  ];
  const add = (item: string, value: string | number) => summary.addRow({ item, value });
  add("Requirement", text(input.requirementTitle, 200) || "Untitled");
  add("Generated", new Date().toLocaleString("en-US"));
  add("Based on", input.source === "estimation" ? "Saved estimation (team, seniority and testing answers)" : "Quick estimate from the complexity score");
  add("Complexity score (M = E - N + 2P)", num(input.complexityScore));
  add("Timeline (weeks)", totalWeeks);
  add("Total working days (5 per week)", num(input.totalDays));
  add("Dev man-days", r1(num(input.devManDays)));
  add("QA man-days", r1(num(input.qaManDays)));
  if (d) {
    add("People in total", d.totalPeople);
    add("Development hours", d.devHours);
    add("Defect-fixing hours", d.defectFixHours);
    add("Testing hours", d.testingHours);
    add("Support-role hours", d.overheadHours);
    add("Testing approach", d.testApproach);
    add("Test scenarios / test cases", `${d.scenarios} / ${d.testCases} (${d.automatedTestCases} automated)`);
  } else {
    add("How it was calculated", "Dev = M × 0.8 and QA = M × 0.5 man-days, spread over design, development, testing, deployment, support and a 5% buffer.");
  }
  for (const m of input.milestones || []) add(`Milestone: ${text(m.label, 100)}`, `Week ${num(m.week)}`);
  if (d) {
    summary.addRow({});
    summary.addRow({ item: "How the numbers were calculated" }).font = { bold: true };
    d.formulas.forEach((f, i) => summary.addRow({ item: `${i + 1}`, value: f }));
  }
  header(summary);
  body(summary);
  summary.getColumn(1).font = { bold: true };

  // ---------- Gantt chart ----------
  const gantt = wb.addWorksheet("Gantt Chart", { views: [{ state: "frozen", xSplit: 5, ySplit: 1 }] });
  const fixedCols = ["Activity / role", "Group", "Start week", "End week", "Weeks"];
  gantt.columns = [
    { width: 36 },
    { width: 14 },
    { width: 10 },
    { width: 10 },
    { width: 8 },
    ...Array.from({ length: totalWeeks }, () => ({ width: 4.5 })),
    { width: 50 },
  ];
  gantt.addRow([...fixedCols, ...Array.from({ length: totalWeeks }, (_, i) => `W${i + 1}`), "Notes"]);
  header(gantt);
  gantt.getRow(1).alignment = { horizontal: "center", vertical: "middle", wrapText: true };

  for (const r of rows) {
    const row = gantt.addRow([r.label, r.group, r1(r.start), r1(r.end), r1(r.end - r.start)]);
    row.getCell(6 + totalWeeks).value = r.note;
    for (let w = 1; w <= totalWeeks; w++) {
      const cell = row.getCell(5 + w);
      cell.border = BORDER;
      // Week w covers [w-1, w); colour it when the bar overlaps that week
      if (r.start < w && r.end > w - 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(r.color) } };
      }
    }
    for (let c = 1; c <= 5; c++) row.getCell(c).border = BORDER;
    row.getCell(6 + totalWeeks).border = BORDER;
    row.getCell(6 + totalWeeks).alignment = { wrapText: true, vertical: "top" };
  }

  if (input.milestones?.length) {
    for (const m of input.milestones) {
      const row = gantt.addRow([`◆ ${text(m.label, 100)}`, "Milestone", r1(num(m.week)), r1(num(m.week)), 0]);
      row.font = { bold: true };
      const w = Math.min(totalWeeks, Math.max(1, Math.ceil(num(m.week))));
      const cell = row.getCell(5 + w);
      cell.value = "◆";
      cell.alignment = { horizontal: "center" };
      cell.font = { bold: true, color: { argb: "FFD97706" } };
    }
  }

  // ---------- Detailed sheets ----------
  if (d) {
    const team = wb.addWorksheet("Team Workload");
    team.columns = [{ width: 34 }, { width: 10 }, { width: 12 }, { width: 10 }, { width: 10 }, { width: 60 }];
    const wsHeader = team.addRow(["Work area", "Base hours", "Done by"]);
    wsHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
    wsHeader.fill = HEADER_FILL;
    for (const w of d.workstreams) {
      const row = team.addRow([w.label, w.hours, w.staffedBy + (w.fallback ? " (covering, +25%)" : "")]);
      row.eachCell((c) => (c.border = BORDER));
    }
    loadsTable(team, "Developers", d.devLoads);
    loadsTable(team, "Testers", d.testLoads);
    loadsTable(team, "Support roles", d.supportLoads);

    const tests = wb.addWorksheet("Testing Activities");
    tests.columns = [
      { header: "Activity", width: 34 },
      { header: "Hours", width: 10 },
      { header: "How it was counted", width: 50 },
      { header: "Owner", width: 30 },
      { header: "When", width: 16 },
    ];
    for (const a of d.testActivities) {
      tests.addRow([a.activity, a.hours, a.rule, a.owner, a.phase === "end" ? "End phase" : "During sprints"]);
    }
    tests.addRow(["Total", d.testingHours]).font = { bold: true };
    header(tests);
    body(tests);

    const gaps = wb.addWorksheet("Gaps & Risks");
    gaps.columns = [
      { header: "Severity", width: 12 },
      { header: "Gap", width: 100 },
    ];
    if (d.gaps.length === 0) gaps.addRow(["-", "No staffing gaps found."]);
    for (const g of d.gaps) {
      const row = gaps.addRow([g.severity.toUpperCase(), g.message]);
      if (g.severity === "high") row.getCell(1).font = { bold: true, color: { argb: "FFC62828" } };
    }
    header(gaps);
    body(gaps);
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
