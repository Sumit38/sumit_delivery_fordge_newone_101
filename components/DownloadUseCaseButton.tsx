"use client";

import { useState } from "react";
import { generateUseCasePDF } from "@/lib/use-case-generator";

interface DownloadUseCaseButtonProps {
  requirementTitle: string;
  requirementText: string;
  complexityScore: number;
  complexityLevel: string;
  devManDays: number;
  qaManDays: number;
  testScenarios: number;
  nodesCount: number;
  edgesCount: number;
  paths: number;
  analysisId?: string;
}

export default function DownloadUseCaseButton({
  requirementTitle,
  requirementText,
  complexityScore,
  complexityLevel,
  devManDays,
  qaManDays,
  testScenarios,
  nodesCount,
  edgesCount,
  paths,
  analysisId,
}: DownloadUseCaseButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      await generateUseCasePDF({
        requirementTitle,
        requirementText,
        complexityScore,
        complexityLevel,
        devManDays,
        qaManDays,
        testScenarios,
        nodesCount,
        edgesCount,
        paths,
        analysisId: analysisId || requirementTitle,
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate Use Case document");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={isGenerating}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
        isGenerating
          ? "bg-slate-400 text-white cursor-not-allowed"
          : "bg-green-600 text-white hover:bg-green-700"
      }`}
      title={isGenerating ? "Generating professional use case..." : "Download Use Case as PDF"}
    >
      {isGenerating ? (
        <>
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          <span>Generating Q&A...</span>
        </>
      ) : (
        <>
          <span>📄</span>
          Download Use Case
        </>
      )}
    </button>
  );
}
