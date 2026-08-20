"use client";

import React, { useEffect } from "react";

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
  const diagramId = `mermaid-${Date.now()}`;

  useEffect(() => {
    const loadMermaid = async () => {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({ startOnLoad: true, theme: "default" });
      mermaid.contentLoaded();
    };

    loadMermaid().catch(console.error);
  }, []);

  // Generate Mermaid diagram based on N, E, P values
  const generateMermaidDiagram = () => {
    const decisionPoints = Math.min(Math.floor(nodesCount / 3), 4);

    let mermaidCode = `graph TD\n`;
    mermaidCode += `    Start([🟢 START<br/>Input Processing])\n`;

    for (let i = 1; i <= decisionPoints; i++) {
      mermaidCode += `    Decision${i}{🔵 Decision ${i}}\n`;
    }

    for (let i = 1; i <= Math.min(paths, 5); i++) {
      mermaidCode += `    Path${i}["🛤️ Path ${i}<br/>Success/Failure"]\n`;
    }

    mermaidCode += `    End([🔴 END<br/>Result Output])\n\n`;

    mermaidCode += `    Start --> Decision1\n`;

    for (let i = 1; i < decisionPoints; i++) {
      mermaidCode += `    Decision${i} --> Decision${i + 1}\n`;
    }

    for (let i = 1; i <= Math.min(paths, 5); i++) {
      const decision = Math.min(i, decisionPoints);
      mermaidCode += `    Decision${decision} --> Path${i}\n`;
    }

    for (let i = 1; i <= Math.min(paths, 5); i++) {
      mermaidCode += `    Path${i} --> End\n`;
    }

    mermaidCode += `\n    style Start fill:#90EE90,stroke:#228B22,stroke-width:3px,color:#000\n`;
    mermaidCode += `    style End fill:#FFB6C6,stroke:#DC143C,stroke-width:3px,color:#000\n`;
    for (let i = 1; i <= decisionPoints; i++) {
      mermaidCode += `    style Decision${i} fill:#87CEEB,stroke:#1E90FF,stroke-width:2px,color:#000\n`;
    }

    return mermaidCode;
  };

  return (
    <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-200 space-y-3">
      <p className="text-xs text-slate-600 font-semibold">📊 Control Flow Visualization</p>

      {/* Mermaid Diagram */}
      <div className="bg-white rounded-lg p-4 border border-slate-200 overflow-x-auto">
        <div className="mermaid" id={diagramId}>
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
