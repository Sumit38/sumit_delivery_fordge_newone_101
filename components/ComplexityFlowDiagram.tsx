"use client";

import React, { useEffect, useState } from "react";

interface ComplexityFlowDiagramProps {
  nodesCount: number;
  edgesCount: number;
  paths: number;
  complexityScore: number;
  title: string;
  actualNodes?: string[];
  actualEdges?: Array<{ from: string; to: string; condition?: string }>;
  actualPaths?: string[][];
}

export default function ComplexityFlowDiagram({
  nodesCount,
  edgesCount,
  paths,
  complexityScore,
  title,
  actualNodes = [],
  actualEdges = [],
  actualPaths = [],
}: ComplexityFlowDiagramProps) {
  const [showModal, setShowModal] = useState(false);
  const diagramId = `mermaid-${Date.now()}`;
  const modalDiagramId = `mermaid-modal-${Date.now()}`;

  useEffect(() => {
    const loadMermaid = async () => {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({ startOnLoad: true, theme: "default" });
      mermaid.contentLoaded();
    };

    loadMermaid().catch(console.error);
  }, [showModal]);

  const generateMermaidDiagram = () => {
    let mermaidCode = `graph TD\n`;

    // Use actual graph if available, otherwise use generic template
    if (actualNodes.length > 0 && actualEdges.length > 0) {
      // ACTUAL GRAPH MODE
      const nodeMap = new Map<string, string>();
      const sanitize = (name: string) =>
        name.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 20);

      // Add nodes
      actualNodes.forEach((node) => {
        const sanitized = sanitize(node);
        const nodeId = sanitized || "Node";
        nodeMap.set(node, nodeId);

        if (node.toLowerCase().includes("start")) {
          mermaidCode += `    ${nodeId}([🟢 ${node}])\n`;
        } else if (node.toLowerCase().includes("end")) {
          mermaidCode += `    ${nodeId}([🔴 ${node}])\n`;
        } else if (
          node.toLowerCase().includes("decision") ||
          node.toLowerCase().includes("check")
        ) {
          mermaidCode += `    ${nodeId}{🔵 ${node}}\n`;
        } else {
          mermaidCode += `    ${nodeId}["${node}"]\n`;
        }
      });

      mermaidCode += `\n`;

      // Add edges
      actualEdges.forEach((edge) => {
        const fromId = nodeMap.get(edge.from) || sanitize(edge.from);
        const toId = nodeMap.get(edge.to) || sanitize(edge.to);
        const label = edge.condition ? ` |${edge.condition}|` : "";
        mermaidCode += `    ${fromId} -->${label} ${toId}\n`;
      });

      // Add styling
      mermaidCode += `\n`;
      actualNodes.forEach((node) => {
        const nodeId = nodeMap.get(node) || sanitize(node);
        if (node.toLowerCase().includes("start")) {
          mermaidCode += `    style ${nodeId} fill:#90EE90,stroke:#228B22,stroke-width:3px,color:#000\n`;
        } else if (node.toLowerCase().includes("end")) {
          mermaidCode += `    style ${nodeId} fill:#FFB6C6,stroke:#DC143C,stroke-width:3px,color:#000\n`;
        } else if (
          node.toLowerCase().includes("decision") ||
          node.toLowerCase().includes("check")
        ) {
          mermaidCode += `    style ${nodeId} fill:#87CEEB,stroke:#1E90FF,stroke-width:2px,color:#000\n`;
        }
      });
    } else {
      // GENERIC TEMPLATE (fallback)
      const decisionPoints = Math.min(Math.floor(nodesCount / 3), 4);

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
    }

    return mermaidCode;
  };

  return (
    <>
      <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-200 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-600 font-semibold">📊 Control Flow Visualization</p>
          <button
            onClick={() => setShowModal(true)}
            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-semibold"
          >
            🔍 View Full Diagram
          </button>
        </div>

        {/* Thumbnail Diagram */}
        <div className="bg-white rounded-lg p-4 border border-slate-200 overflow-x-auto max-h-64">
          <div className="mermaid text-xs" id={diagramId}>
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
            <p className="text-slate-600">Nodes (N) representing control flow decisions</p>
          </div>

          <div className="bg-white rounded p-2 space-y-1">
            <p className="font-semibold text-slate-900">↔️ {edgesCount} Transitions</p>
            <p className="text-slate-600">Edges (E) connecting all possible transitions</p>
          </div>

          <div className="bg-white rounded p-2 space-y-1">
            <p className="font-semibold text-slate-900">🛤️ {paths} Distinct Paths</p>
            <p className="text-slate-600">Unique routes from START to END</p>
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

      {/* Full Screen Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-900">
                {title} - Control Flow Diagram
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-3xl font-light text-slate-500 hover:text-slate-700 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-auto p-6 bg-slate-50">
              <div className="bg-white rounded-lg p-6 border border-slate-200">
                <div className="mermaid" id={modalDiagramId}>
                  {generateMermaidDiagram()}
                </div>
              </div>
            </div>

            {/* Modal Footer with Info */}
            <div className="p-6 border-t border-slate-200 bg-white space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                  <p className="text-xs text-green-600 font-semibold">START</p>
                  <p className="text-sm font-bold text-green-700">Entry Point</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-600 font-semibold">Nodes (N)</p>
                  <p className="text-sm font-bold text-blue-700">{nodesCount}</p>
                </div>
                <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                  <p className="text-xs text-orange-600 font-semibold">Edges (E)</p>
                  <p className="text-sm font-bold text-orange-700">{edgesCount}</p>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                  <p className="text-xs text-purple-600 font-semibold">Paths (P)</p>
                  <p className="text-sm font-bold text-purple-700">{paths}</p>
                </div>
              </div>

              <div className="bg-indigo-100 rounded-lg p-4 border border-indigo-300">
                <p className="text-sm font-bold text-indigo-900 mb-2">McCabe's Cyclomatic Complexity Formula</p>
                <p className="text-lg font-mono text-indigo-700">
                  M = E - N + 2P = {edgesCount} - {nodesCount} + 2({paths}) = <span className="text-2xl font-bold text-indigo-900">{complexityScore}</span>
                </p>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="w-full px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
