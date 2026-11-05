import { describe, expect, it } from "vitest";
import { mergeAnalyses, stepKey } from "@/lib/merge-analyses";
import { compareDocuments } from "@/lib/merge-compare";
import { buildFlowMermaid, buildPathTreeMermaid, filterToDocument, shortLines } from "@/lib/flow-diagram";
import { findingNotes, isMetaRemark, splitFindings } from "@/lib/qa-status";

// Two regions of one process: same intake and quote, different approval
const apac = {
  title: "APAC",
  nodes: ["Start", "Receive case", "Generate quote", "Approval needed?", "Authority matrix approval", "Send quote", "End"],
  edges: [
    { from: "Start", to: "Receive case" },
    { from: "Receive case", to: "Generate quote" },
    { from: "Generate quote", to: "Approval needed?" },
    { from: "Approval needed?", to: "Authority matrix approval", condition: "yes" },
    { from: "Approval needed?", to: "Send quote", condition: "no" },
    { from: "Authority matrix approval", to: "Send quote" },
    { from: "Send quote", to: "End" },
  ],
  paths: [
    ["Start", "Receive case", "Generate quote", "Approval needed?", "Authority matrix approval", "Send quote", "End"],
    ["Start", "Receive case", "Generate quote", "Approval needed?", "Send quote", "End"],
  ],
};
const amer = {
  title: "AMER",
  nodes: ["Start", "Receive case", "Generate quote in Direct", "Approval needed?", "Business rule approval", "Send quote", "End"],
  edges: [
    { from: "Start", to: "Receive case" },
    { from: "Receive case", to: "Generate quote in Direct" },
    { from: "Generate quote in Direct", to: "Approval needed?" },
    { from: "Approval needed?", to: "Business rule approval", condition: "yes" },
    { from: "Approval needed?", to: "Send quote", condition: "no" },
    { from: "Business rule approval", to: "Send quote" },
    { from: "Send quote", to: "End" },
  ],
  paths: [
    ["Start", "Receive case", "Generate quote in Direct", "Approval needed?", "Business rule approval", "Send quote", "End"],
    ["Start", "Receive case", "Generate quote in Direct", "Approval needed?", "Send quote", "End"],
  ],
};

describe("combined analysis with regions", () => {
  it("without matching, differently worded steps stay separate and no path is common", () => {
    const m = mergeAnalyses([apac, amer]);
    expect(m.origins.nodes["Generate quote"]).toEqual([0]);
    expect(m.origins.nodes["Generate quote in Direct"]).toEqual([1]);
    expect(m.origins.nodes["Receive case"]).toEqual([0, 1]);
    expect(m.origins.paths.every((o) => o.length === 1)).toBe(true);
  });

  it("matched steps are counted once, which makes the no-approval path common", () => {
    const aliases = { [stepKey("Generate quote in Direct")]: stepKey("Generate quote") };
    const m = mergeAnalyses([apac, amer], aliases);
    expect(m.nodes).not.toContain("Generate quote in Direct");
    expect(m.origins.nodes["Generate quote"]).toEqual([0, 1]);
    // N: Start, End, Receive, Generate, Approval?, Authority, Business rule, Send = 8
    expect(m.n).toBe(8);
    expect(m.m).toBe(m.e - m.n + 2 * m.p);

    const c = compareDocuments(["APAC", "AMER"], m.edges, m.paths, m.origins);
    expect(c.commonPaths).toHaveLength(1);
    expect(c.onlySteps[0].steps).toEqual(["Authority matrix approval"]);
    expect(c.onlySteps[1].steps).toEqual(["Business rule approval"]);

    const apacPath = c.paths.find((r) => r.doc === 0)!;
    expect(apacPath.differences).toEqual([
      { after: "Approval needed?", thisSteps: ["Authority matrix approval"], otherSteps: ["Business rule approval"], rejoin: "Send quote" },
    ]);
    expect(apacPath.sharedSteps).toBe(4);

    expect(c.decisions.map((d) => d.step)).toEqual(["Approval needed?"]);
  });

  it("colours shared and region-only parts and filters to one region", () => {
    const aliases = { [stepKey("Generate quote in Direct")]: stepKey("Generate quote") };
    const m = mergeAnalyses([apac, amer], aliases);
    const code = buildFlowMermaid(m.nodes, m.edges, m.origins);
    expect(code).toContain("classDef shared");
    expect(code).toMatch(/class [N0-9,]+ region0/);
    expect(code).toMatch(/linkStyle [0-9,]+ stroke:#ea580c/);

    const onlyAmer = filterToDocument(m.nodes, m.edges, m.origins, 1);
    expect(onlyAmer.nodes).not.toContain("Authority matrix approval");
    expect(onlyAmer.edges.every((e) => e.to !== "Authority matrix approval")).toBe(true);
    expect(onlyAmer.origins.edges).toHaveLength(onlyAmer.edges.length);
  });

  it("colours the path tree by region: shared trunk, region-only branches", () => {
    const aliases = { [stepKey("Generate quote in Direct")]: stepKey("Generate quote") };
    const m = mergeAnalyses([apac, amer], aliases);
    const code = buildPathTreeMermaid(m.paths, { regions: m.origins.paths })!;
    const classOf = (label: string) => {
      const id = code.match(new RegExp(`(T\\d+)[\\[{]"${label}`))![1];
      const line = code.split("\n").find((l) => l.startsWith("  class ") && l.split(" ")[3].split(",").includes(id))!;
      return line.trim().split(" ").pop();
    };
    expect(classOf("Receive case")).toBe("shared");
    expect(classOf("Authority matrix approval")).toBe("region0");
    expect(classOf("Business rule approval")).toBe("region1");
    expect(code).toMatch(/linkStyle [0-9,]+ stroke:#7c3aed/);
    // Without regions the tree is drawn as before
    expect(buildPathTreeMermaid(m.paths)).not.toContain("classDef");
  });

  it("plain graphs keep their usual colours", () => {
    const code = buildFlowMermaid(apac.nodes, apac.edges);
    expect(code).toContain("classDef branch");
    expect(code).not.toContain("classDef shared");
  });
});

describe("decision box labels", () => {
  it("keeps short names as they are", () => {
    expect(shortLines("Approval needed?")).toEqual(["Approval needed?"]);
  });

  it("wraps onto at most two short lines and cuts the rest", () => {
    const lines = shortLines("Is the client master record available in the system for this region and deal type?");
    expect(lines).toHaveLength(2);
    expect(lines.every((l) => l.length <= 22)).toBe(true);
    expect(lines[1].endsWith("…")).toBe(true);
  });

  it("cuts a single very long word", () => {
    expect(shortLines("Supercalifragilisticexpialidocious?")[0]).toHaveLength(22);
  });

  it("draws long decision names short in the flow graph and the path tree", () => {
    const long = "Is the client master record available in the system for this region?";
    const edges = [
      { from: "Start", to: long },
      { from: long, to: "Use record", condition: "yes" },
      { from: long, to: "Request record", condition: "no" },
      { from: "Use record", to: "End" },
      { from: "Request record", to: "End" },
    ];
    const flow = buildFlowMermaid(["Start", long, "Use record", "Request record", "End"], edges);
    expect(flow).not.toContain(long);
    expect(flow).toMatch(/\{"Is the client master<br\/>.*…"\}/);
    const tree = buildPathTreeMermaid([
      ["Start", long, "Use record", "End"],
      ["Start", long, "Request record", "End"],
    ])!;
    expect(tree).not.toContain(long);
  });
});

describe("answer conflicts vs requirement gaps", () => {
  const found = [
    "No CLARIFICATIONS & ANSWERS section was provided, so the items below are gaps.",
    "The BOM error loop has no retry limit.",
    "The requested formula M = E - N + 2P uses P as the path count.",
    "Document 2 (AMER) was not provided.",
  ];

  it("drops remarks about the prompt itself", () => {
    expect(found.filter((f) => !isMetaRemark(f))).toEqual(["The BOM error loop has no retry limit."]);
  });

  it("without answered Q&A, findings are gaps and never conflicts", () => {
    expect(splitFindings(found, false)).toEqual({ conflicts: [], gaps: ["The BOM error loop has no retry limit."] });
  });

  it("with answered Q&A, findings are conflicts", () => {
    expect(splitFindings(["Rollback in 30 days vs full version history"], true).conflicts).toHaveLength(1);
  });

  it("older direct analyses show their stored list as gaps", () => {
    const notes = findingNotes({ analysisMode: "direct", ambiguities: found });
    expect(notes).toEqual(["Requirement gap: The BOM error loop has no retry limit."]);
    expect(findingNotes({ analysisMode: "guided", ambiguities: ["A vs B"] })).toEqual(["Answer conflict: A vs B"]);
  });
});
