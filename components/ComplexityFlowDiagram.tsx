"use client";

import React from "react";

interface ComplexityFlowDiagramProps {
  nodesCount: number;
  edgesCount: number;
  paths: number;
  complexityScore: number;
  title: string;
}

export default function ComplexityFlowDiagram({
  nodesCount,
  edgesCount,
  paths,
  complexityScore,
  title,
}: ComplexityFlowDiagramProps) {
  // Generate Mermaid diagram based on N, E, P values
  const generateMermaidDiagram = () => {
    // Simplified flowchart showing the control flow
    // N = nodes, E = edges, P = paths

    const decisionPoints = Math.min(Math.floor(nodesCount / 3), 4); // 3-4 decision points
    const pathsPerDecision = Math.ceil(paths / Math.max(1, decisionPoints));

    let mermaidCode = `graph TD\n`;
    mermaidCode += `    Start([START: Input Processing])\n`;

    // Add decision points
    for (let i = 1; i <= decisionPoints; i++) {
      mermaidCode += `    Decision${i}{Decision Point ${i}}\n`;
    }

    // Add path branches
    for (let i = 1; i <= Math.min(paths, 5); i++) {
      mermaidCode += `    Path${i}[Path ${i}<br/>Success/Failure]\n`;
    }

    mermaidCode += `    End([END: Result Output])\n\n`;

    // Add edges/connections
    mermaidCode += `    Start --> Decision1\n`;

    // Connect decisions
    for (let i = 1; i < decisionPoints; i++) {
      mermaidCode += `    Decision${i} --> Decision${i + 1}\n`;
    }

    // Connect to paths
    for (let i = 1; i <= Math.min(paths, 5); i++) {
      const decision = Math.min(i, decisionPoints);
      mermaidCode += `    Decision${decision} --> Path${i}\n`;
    }

    // Connect paths to end
    for (let i = 1; i <= Math.min(paths, 5); i++) {
      mermaidCode += `    Path${i} --> End\n`;
    }

    // Add styling
    mermaidCode += `\n    style Start fill:#90EE90,stroke:#228B22,stroke-width:3px,color:#000\n`;
    mermaidCode += `    style End fill:#FFB6C6,stroke:#DC143C,stroke-width:3px,color:#000\n`;
    mermaidCode += `    style Decision1 fill:#87CEEB,stroke:#1E90FF,stroke-width:2px,color:#000\n`;
    mermaidCode += `    style Decision2 fill:#87CEEB,stroke:#1E90FF,stroke-width:2px,color:#000\n`;
    mermaidCode += `    style Decision3 fill:#87CEEB,stroke:#1E90FF,stroke-width:2px,color:#000\n`;
    mermaidCode += `    style Decision4 fill:#87CEEB,stroke:#1E90FF,stroke-width:2px,color:#000\n`;

    return mermaidCode;
  };

  return (
    <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-200 space-y-3">
      <p className="text-xs text-slate-600 font-semibold">📊 Control Flow Visualization</p>

      {/* Mermaid Diagram */}
      <div className="bg-white rounded-lg p-4 border border-slate-200 overflow-x-auto">
        <script async src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
        <div className="mermaid">
          {generateMermaidDiagram()}
        </div>
      </div>

      {/* Explanation */}
      <div className="space-y-2 text-xs">
        <div className="bg-white rounded p-2 space-y-1">
          <p className="font-semibold text-slate-900">🟢 START (Entry Point)</p>
          <p className="text-slate-600">Initial requirement input processing</p>
        </div>

        <div className="bg-white rounded p-2 space-y-1">
          <p className="font-semibold text-slate-900">🔵 {nodesCount} Decision Points</p>
          <p className="text-slate-600">Nodes (N) representing different control flow decisions</p>
        </div>

        <div className="bg-white rounded p-2 space-y-1">
          <p className="font-semibold text-slate-900">↔️ {edgesCount} Transitions</p>
          <p className="text-slate-600">Edges (E) connecting all possible transitions</p>
        </div>

        <div className="bg-white rounded p-2 space-y-1">
          <p className="font-semibold text-slate-900">🛤️ {paths} Distinct Paths</p>
          <p className="text-slate-600">Unique routes from START to END (P = {paths})</p>
        </div>

        <div className="bg-white rounded p-2 space-y-1">
          <p className="font-semibold text-slate-900">🔴 END (Exit Point)</p>
          <p className="text-slate-600">Result output/completion</p>
        </div>

        <div className="bg-indigo-100 rounded p-2 border border-indigo-300 space-y-1">
          <p className="font-semibold text-indigo-900">📈 McCabe Formula</p>
          <p className="text-indigo-700 font-mono text-xs">M = E - N + 2P = {edgesCount} - {nodesCount} + 2({paths}) = {complexityScore}</p>
        </div>
      </div>
    </div>
  );
}
