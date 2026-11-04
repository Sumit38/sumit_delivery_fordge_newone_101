import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireUser } from "@/lib/require-user";

interface TestCaseInput {
  id?: string;
  name?: string;
  steps?: string[];
  expectedResult?: string;
}

interface ScenarioInput {
  id?: number | string;
  name?: string;
  description?: string;
  complexity?: string;
  actors?: string[];
  preconditions?: string[];
  steps?: string[];
  expectedResult?: string;
  testCases?: TestCaseInput[];
  isTemplate?: boolean;
  // Path-based scenarios
  pathId?: string;
  kind?: string;
  route?: string[];
  decisionOutcomes?: string[];
  wording?: string;
}

const COMPLEXITY_MULTIPLIER: Record<string, number> = { Low: 1, Medium: 2, High: 3, "Very High": 4 };

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3A5F" } };
const COMPLEXITY_FILL: Record<string, string> = {
  Low: "FFE8F5E9",
  Medium: "FFFFF8E1",
  High: "FFFFF3E0",
  "Very High": "FFFFEBEE",
};

const list = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v) => typeof v === "string" && v.trim() !== "") : [];

const numbered = (items: string[]) => items.map((s, i) => `${i + 1}. ${s}`).join("\n");

function styleHeader(sheet: ExcelJS.Worksheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = HEADER_FILL;
  header.alignment = { vertical: "middle", wrapText: true };
  header.height = 22;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
}

function styleBody(sheet: ExcelJS.Worksheet, complexityColumn?: string) {
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.alignment = { vertical: "top", wrapText: true };
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFD9D9D9" } },
        bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
        left: { style: "thin", color: { argb: "FFD9D9D9" } },
        right: { style: "thin", color: { argb: "FFD9D9D9" } },
      };
    });
    if (complexityColumn) {
      const cell = row.getCell(complexityColumn);
      const fill = COMPLEXITY_FILL[String(cell.value)];
      if (fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    }
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  try {
    const { scenarios, requirementTitle, requirementText, complexity } = await request.json();

    if (!Array.isArray(scenarios) || scenarios.length === 0) {
      return NextResponse.json({ error: "Scenarios data is required" }, { status: 400 });
    }

    const valid: ScenarioInput[] = scenarios.filter(
      (s: ScenarioInput) => typeof s?.name === "string" && s.name.trim() !== ""
    );

    const n = Number(complexity?.n) || 0;
    const e = Number(complexity?.e) || 0;
    const p = Number(complexity?.p) || 1;
    // Same formula the app uses everywhere: M = E - N + 2P
    const m = e - n + 2 * p;
    const level = m <= 10 ? "Low" : m <= 30 ? "Medium" : m <= 100 ? "High" : "Very High";
    const totalTestCases = valid.reduce((sum, s) => sum + (s.testCases?.length || 0), 0);
    const pathBased = valid.some((s) => typeof s.pathId === "string");
    const pathIds = new Set(valid.map((s) => s.pathId).filter(Boolean));
    const scenarioId = (s: ScenarioInput, i: number) =>
      pathBased && s.id ? `TS-${String(s.id).replace("+", "POS").replace("-", "NEG")}` : `TS-${String(i + 1).padStart(3, "0")}`;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "DeliveryForge";
    workbook.created = new Date();

    // ---- Sheet 1: Summary ----
    const summary = workbook.addWorksheet("Summary");
    summary.columns = [
      { header: "Item", key: "item", width: 32 },
      { header: "Value", key: "value", width: 90 },
    ];
    summary.addRows([
      { item: "Requirement Title", value: requirementTitle || "Unnamed Requirement" },
      { item: "Requirement (first 1,000 chars)", value: (requirementText || "").substring(0, 1000) },
      { item: "Generated On", value: new Date().toLocaleString() },
      { item: "Nodes (N)", value: n },
      { item: "Edges (E)", value: e },
      { item: "Paths (P)", value: p },
      { item: "Complexity Score (M)", value: m },
      { item: "Formula", value: `M = E - N + 2P = ${e} - ${n} + 2(${p}) = ${m}` },
      { item: "Complexity Level", value: level },
      { item: "Estimated Test Scenarios (2P)", value: 2 * p },
      { item: "Scenarios in this file", value: valid.length },
      ...(pathBased
        ? [
            { item: "How scenarios were built", value: "One positive and one negative scenario per Start-to-End path (2P), from the analysis' stored paths" },
            {
              item: "Coverage check",
              value:
                valid.length === 2 * pathIds.size
                  ? `OK: ${valid.length} scenarios = 2 × ${pathIds.size} paths`
                  : `Check: ${valid.length} scenarios for ${pathIds.size} paths (expected ${2 * pathIds.size})`,
            },
          ]
        : []),
      { item: "Test Cases in this file", value: totalTestCases },
      {
        item: "Test Case Complexity Rule",
        value: "Number of steps × scenario multiplier (Low 1, Medium 2, High 3, Very High 4)",
      },
    ]);
    styleHeader(summary);
    styleBody(summary);
    summary.getColumn("item").font = { bold: true };
    summary.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

    // ---- Sheet 2: Test Scenarios ----
    const scenarioSheet = workbook.addWorksheet("Test Scenarios");
    scenarioSheet.columns = [
      { header: "Scenario ID", key: "id", width: 12 },
      ...(pathBased
        ? [
            { header: "Path ID", key: "pathId", width: 9 },
            { header: "Type", key: "kind", width: 10 },
            { header: "Decision Outcomes", key: "outcomes", width: 45 },
            { header: "Route (Start to End)", key: "route", width: 60 },
          ]
        : []),
      { header: "Scenario Name", key: "name", width: 36 },
      { header: "Complexity", key: "complexity", width: 12 },
      { header: "Source", key: "source", width: 12 },
      { header: "Description", key: "description", width: 50 },
      { header: "Actors", key: "actors", width: 24 },
      { header: "Preconditions", key: "preconditions", width: 40 },
      { header: "Scenario Steps", key: "steps", width: 50 },
      { header: "Expected Result", key: "expected", width: 40 },
      { header: "No. of Test Cases", key: "tcCount", width: 14 },
    ];
    valid.forEach((s, i) => {
      scenarioSheet.addRow({
        id: scenarioId(s, i),
        pathId: s.pathId || "",
        kind: s.kind || "",
        outcomes: numbered(list(s.decisionOutcomes)),
        route: list(s.route).join(" → "),
        name: s.name,
        complexity: s.complexity || "Medium",
        source: pathBased ? (s.wording === "AI" ? "Path + AI wording" : "Path") : s.isTemplate ? "Template" : "Detailed",
        description: s.description || "",
        actors: list(s.actors).join(", "),
        preconditions: numbered(list(s.preconditions)),
        steps: numbered(list(s.steps)),
        expected: s.expectedResult || "",
        tcCount: s.testCases?.length || 0,
      });
    });
    styleHeader(scenarioSheet);
    styleBody(scenarioSheet, "complexity");

    // ---- Sheet 3: Test Cases (one row per test case, ready for execution) ----
    const caseSheet = workbook.addWorksheet("Test Cases");
    caseSheet.columns = [
      { header: "Test Case ID", key: "tcId", width: 14 },
      { header: "Scenario ID", key: "scId", width: 12 },
      { header: "Scenario Name", key: "scName", width: 30 },
      { header: "Test Case Name", key: "name", width: 36 },
      { header: "Complexity", key: "complexity", width: 12 },
      { header: "Preconditions", key: "preconditions", width: 36 },
      { header: "Test Steps", key: "steps", width: 55 },
      { header: "Expected Result", key: "expected", width: 40 },
      { header: "Test Case Complexity", key: "score", width: 14 },
      { header: "Actual Result", key: "actual", width: 30 },
      { header: "Status (Pass/Fail/Blocked)", key: "status", width: 16 },
      { header: "Remarks", key: "remarks", width: 30 },
    ];
    valid.forEach((s, i) => {
      const scId = scenarioId(s, i);
      const scComplexity = s.complexity || "Medium";
      const multiplier = COMPLEXITY_MULTIPLIER[scComplexity] || 2;
      (s.testCases || []).forEach((tc, j) => {
        const steps = list(tc.steps);
        caseSheet.addRow({
          tcId: `${scId}-TC${String(j + 1).padStart(2, "0")}`,
          scId,
          scName: s.name,
          name: (tc.name || "").replace(/\s*-\s*Path\s*\d+\s*$/, ""),
          complexity: scComplexity,
          preconditions: numbered(list(s.preconditions)),
          steps: numbered(steps),
          expected: tc.expectedResult || "",
          score: Math.max(steps.length, 1) * multiplier,
          actual: "",
          status: "",
          remarks: "",
        });
      });
    });
    styleHeader(caseSheet);
    styleBody(caseSheet, "complexity");
    // Status column gets a dropdown so testers can record results in the file
    for (let r = 2; r <= caseSheet.rowCount; r++) {
      caseSheet.getCell(`K${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"Not Run,Pass,Fail,Blocked"'],
      };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const safeTitle = String(requirementTitle || "test-scenarios")
      .replace(/[^a-zA-Z0-9-_ ]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .substring(0, 60) || "test-scenarios";

    return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${safeTitle}-test-scenarios-${new Date().toISOString().split("T")[0]}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("❌ Error generating Excel:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate Excel" },
      { status: 500 }
    );
  }
}
