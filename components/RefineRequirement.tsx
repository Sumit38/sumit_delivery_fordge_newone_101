"use client";

import { useState, useEffect } from "react";

interface Question {
  id: string;
  question: string;
  suggestedAnswer: string;
  options: string[];
  selectedOptions: string[];
  userAnswer: string;
}

interface RefinedData {
  useCaseName: string;
  useCaseDescription: string;
  actors: string[];
  preconditions: string[];
  mainFlow: string[];
  questions: Question[];
}

interface RefineRequirementProps {
  onRefinementComplete?: (refinedRequirement: string) => void;
  onAnalyzeRequirement?: (refinedRequirement: string, title: string) => void;
}

export default function RefineRequirement({ onRefinementComplete, onAnalyzeRequirement }: RefineRequirementProps) {
  const [requirementTitle, setRequirementTitle] = useState("");
  const [rawRequirement, setRawRequirement] = useState("");
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [refinedData, setRefinedData] = useState<RefinedData | null>(null);
  const [step, setStep] = useState<"input" | "review" | "comprehensive">("input");
  const [comprehensiveRequirement, setComprehensiveRequirement] = useState("");

  // Input method states
  const [inputMethod, setInputMethod] = useState<"text" | "file" | "website">("text");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [fileLoading, setFileLoading] = useState(false);

  // Load requirement from sessionStorage and auto-generate questions
  useEffect(() => {
    const savedRequirement = typeof window !== "undefined"
      ? sessionStorage.getItem("rawRequirementForRefine")
      : null;

    if (savedRequirement) {
      setRawRequirement(savedRequirement);
      setStep("review");
      // Auto-generate questions
      handleGenerateQuestions(savedRequirement);
      // Clear from sessionStorage so it doesn't persist across page reloads
      sessionStorage.removeItem("rawRequirementForRefine");
    }
  }, []);

  const extractTextFromFile = async (file: File): Promise<string> => {
    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    // Text files
    if (fileType === "text/plain" || fileName.endsWith(".txt")) {
      const text = await file.text();
      return text;
    }

    throw new Error("Only .txt files are supported. Please upload a plain text file.");
  };

  const extractTextFromWebsite = async (url: string): Promise<string> => {
    try {
      const response = await fetch("/api/extract-website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!response.ok) throw new Error("Failed to fetch website");
      const data = await response.json();
      return data.text;
    } catch (err) {
      throw new Error(
        "Failed to extract text from website. Please ensure URL is valid and publicly accessible."
      );
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileLoading(true);
    setError("");

    try {
      const text = await extractTextFromFile(file);
      if (text.length < 30) {
        setError("Uploaded file must contain at least 30 characters");
      } else {
        setRawRequirement(text);
        setUploadedFileName(file.name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file");
    } finally {
      setFileLoading(false);
    }
  };

  const handleWebsiteUrlSubmit = async () => {
    if (!websiteUrl.trim()) {
      setError("Please enter a valid URL");
      return;
    }

    setFileLoading(true);
    setError("");

    try {
      const text = await extractTextFromWebsite(websiteUrl);
      if (text.length < 30) {
        setError("Extracted content must be at least 30 characters");
      } else {
        setRawRequirement(text);
        setWebsiteUrl("");
        setInputMethod("text");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to extract website content");
    } finally {
      setFileLoading(false);
    }
  };

  const handleGenerateQuestions = async (requirement?: string) => {
    const req = requirement || rawRequirement;

    if (!req.trim()) {
      setError("Please enter raw requirement details");
      return;
    }

    if (req.trim().length < 30) {
      setError("Please provide at least 30 characters of details");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/refine-requirement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawRequirement: req }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to refine requirement");
      }

      const data = await response.json();
      setRefinedData(data.refinedData);
      if (!requirement) {
        // Only set to review step if not auto-loading
        setStep("review");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refine requirement");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateUseCase = async () => {
    await handleGenerateQuestions();
  };

  const handleAnswerChange = (questionId: string, answer: string) => {
    if (!refinedData) return;

    const updatedQuestions = refinedData.questions.map((q) =>
      q.id === questionId ? { ...q, userAnswer: answer } : q
    );

    setRefinedData({
      ...refinedData,
      questions: updatedQuestions,
    });
  };

  const handleOptionToggle = (questionId: string, option: string) => {
    if (!refinedData) return;

    const updatedQuestions = refinedData.questions.map((q) => {
      if (q.id === questionId) {
        const isSelected = q.selectedOptions.includes(option);
        return {
          ...q,
          selectedOptions: isSelected
            ? q.selectedOptions.filter((o) => o !== option)
            : [...q.selectedOptions, option],
        };
      }
      return q;
    });

    setRefinedData({
      ...refinedData,
      questions: updatedQuestions,
    });
  };

  const handleGenerateComprehensive = () => {
    if (!refinedData) return;

    // Build comprehensive requirement from refined data
    const comprehensiveAnswers = refinedData.questions
      .map((q) => {
        let answer = "";

        // Include selected options
        if (q.selectedOptions.length > 0) {
          answer += `Selected: ${q.selectedOptions.join(", ")}`;
        }

        // Include custom answer if provided
        if (q.userAnswer) {
          answer += answer ? `\n${q.userAnswer}` : q.userAnswer;
        }

        // Use suggested answer if nothing provided
        if (!answer) {
          answer = q.suggestedAnswer;
        }

        return `Q: ${q.question}\nA: ${answer}`;
      })
      .join("\n\n");

    const comprehensive = `
REFINED USE CASE: ${refinedData.useCaseName}

DESCRIPTION:
${refinedData.useCaseDescription}

ACTORS:
${refinedData.actors.map((a) => `- ${a}`).join("\n")}

PRECONDITIONS:
${refinedData.preconditions.map((p) => `- ${p}`).join("\n")}

MAIN FLOW:
${refinedData.mainFlow.map((f, i) => `${i + 1}. ${f}`).join("\n")}

CLARIFICATIONS & ANSWERS:
${comprehensiveAnswers}

---
Generated from raw requirement: "${rawRequirement}"
`.trim();

    setComprehensiveRequirement(comprehensive);
    setStep("comprehensive");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">📊 Requirement Analysis</h2>
      </div>

      {/* Step 1: Input */}
      {step === "input" && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm font-semibold text-blue-900">Step 1 of 3: Enter Requirement</p>
            <p className="text-xs text-blue-700 mt-1">Paste raw requirement details (minimum 30 characters)</p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Requirement Title *
            </label>
            <input
              type="text"
              value={requirementTitle}
              onChange={(e) => setRequirementTitle(e.target.value)}
              placeholder="e.g., User Authentication System, Payment Processing, etc."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              disabled={loading || analyzing}
            />
            <p className="text-xs text-slate-500 mt-1">Provide a clear title for this requirement</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-3">
              Choose Input Method *
            </label>

            {/* Input Method Tabs */}
            <div className="flex gap-2 mb-4 border-b border-slate-200">
              <button
                type="button"
                onClick={() => setInputMethod("text")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  inputMethod === "text"
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                📝 Paste Text
              </button>
              <button
                type="button"
                onClick={() => setInputMethod("file")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  inputMethod === "file"
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                📄 Upload .txt
              </button>
              <button
                type="button"
                onClick={() => setInputMethod("website")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  inputMethod === "website"
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                🌐 Website Link
              </button>
            </div>

            {/* Paste Text Input */}
            {inputMethod === "text" && (
              <div>
                <textarea
                  value={rawRequirement}
                  onChange={(e) => setRawRequirement(e.target.value)}
                  placeholder="Paste requirement details here..."
                  rows={10}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  disabled={loading}
                />
                <p className="text-xs text-slate-500 mt-2">
                  Minimum 30 characters. Be as detailed or vague as you want.
                </p>
              </div>
            )}

            {/* File Upload Input */}
            {inputMethod === "file" && (
              <div>
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                  <input
                    type="file"
                    accept=".txt"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                    disabled={fileLoading}
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <p className="text-sm font-medium text-slate-900">📄 Click to upload .txt file</p>
                    <p className="text-xs text-slate-500 mt-1">or drag and drop</p>
                  </label>
                </div>
                {uploadedFileName && (
                  <p className="text-xs text-green-600 mt-2">✓ File loaded: {uploadedFileName}</p>
                )}
                <p className="text-xs text-slate-500 mt-2">Only plain text (.txt) files supported</p>
              </div>
            )}

            {/* Website URL Input */}
            {inputMethod === "website" && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    disabled={fileLoading}
                  />
                  <button
                    type="button"
                    onClick={handleWebsiteUrlSubmit}
                    disabled={fileLoading || !websiteUrl.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 font-medium text-sm"
                  >
                    {fileLoading ? "Extracting..." : "Extract"}
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Enter a public website URL to extract text content
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              ❌ {error}
            </div>
          )}

          <button
            onClick={handleGenerateUseCase}
            disabled={loading || fileLoading || !rawRequirement.trim() || !requirementTitle.trim()}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed font-semibold transition-colors"
          >
            {loading ? "Generating Use Case & Questions..." : "🚀 Generate Use Case & Questions"}
          </button>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
            <p className="font-semibold mb-2">What happens next:</p>
            <ol className="space-y-1 ml-4 list-decimal text-xs">
              <li>AI converts raw details into structured use case</li>
              <li>Generates 10-15 clarifying questions</li>
              <li>Suggests answers based on your input</li>
              <li>You review and refine the answers</li>
              <li>Generate comprehensive requirement for accurate complexity analysis</li>
            </ol>
          </div>
        </div>
      )}

      {/* Step 2: Review Questions */}
      {step === "review" && refinedData && (
        <div className="space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-green-900">Step 2 of 3: Refine Requirement</p>
            <p className="text-xs text-green-700 mt-1">Answer clarifying questions with checkboxes or custom text</p>
          </div>

          {/* Use Case Summary */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200 p-6">
            <h3 className="text-lg font-bold text-green-900 mb-4">📋 Generated Use Case</h3>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-green-600 font-semibold uppercase">Use Case Name</p>
                <p className="text-lg font-bold text-green-900">{refinedData.useCaseName}</p>
              </div>

              <div>
                <p className="text-xs text-green-600 font-semibold uppercase">Description</p>
                <p className="text-sm text-green-800">{refinedData.useCaseDescription}</p>
              </div>

              <div>
                <p className="text-xs text-green-600 font-semibold uppercase mb-2">Actors</p>
                <div className="flex flex-wrap gap-2">
                  {refinedData.actors.map((actor, idx) => (
                    <span key={idx} className="px-3 py-1 bg-white rounded-full text-sm text-green-700 border border-green-300">
                      {actor}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-green-600 font-semibold uppercase mb-2">Preconditions</p>
                <ul className="space-y-1 text-sm text-green-800">
                  {refinedData.preconditions.map((pre, idx) => (
                    <li key={idx}>✓ {pre}</li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-xs text-green-600 font-semibold uppercase mb-2">Main Flow</p>
                <ol className="space-y-1 text-sm text-green-800 ml-4 list-decimal">
                  {refinedData.mainFlow.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>
              </div>
            </div>
          </div>

          {/* Questions & Answers */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900">❓ Clarifying Questions</h3>
            <p className="text-sm text-slate-600">
              Review and refine the answers. Edit suggested answers or replace with your own details.
            </p>

            {refinedData.questions.map((q, idx) => (
              <div key={q.id} className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Q{idx + 1}. {q.question}
                  </p>
                </div>

                <div>
                  <label className="text-xs text-slate-600 font-semibold">Suggested Answer:</label>
                  <p className="text-sm text-slate-700 p-2 bg-slate-50 rounded mt-1">
                    {q.suggestedAnswer}
                  </p>
                </div>

                {/* Checkbox Options */}
                {q.options && q.options.length > 0 && (
                  <div>
                    <label className="text-xs text-slate-600 font-semibold">Select applicable options (or add custom answer below):</label>
                    <div className="space-y-2 mt-2">
                      {q.options.map((option, optIdx) => (
                        <label key={optIdx} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={q.selectedOptions.includes(option)}
                            onChange={() => handleOptionToggle(q.id, option)}
                            className="w-4 h-4 rounded border-slate-300 cursor-pointer"
                          />
                          <span className="text-sm text-slate-700">{option}</span>
                        </label>
                      ))}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={q.selectedOptions.includes("All of the above")}
                          onChange={() => handleOptionToggle(q.id, "All of the above")}
                          className="w-4 h-4 rounded border-slate-300 cursor-pointer"
                        />
                        <span className="text-sm text-slate-700 font-semibold">All of the above</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={q.selectedOptions.includes("NA")}
                          onChange={() => handleOptionToggle(q.id, "NA")}
                          className="w-4 h-4 rounded border-slate-300 cursor-pointer"
                        />
                        <span className="text-sm text-slate-700 font-semibold">NA</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Free Text Answer */}
                <div>
                  <label className="text-xs text-slate-600 font-semibold">Custom/Additional Answer (optional):</label>
                  <textarea
                    value={q.userAnswer}
                    onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                    placeholder="Add any custom details or additional context..."
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm mt-1"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={() => {
                setStep("input");
                setRefinedData(null);
              }}
              className="flex-1 px-4 py-3 bg-slate-200 text-slate-900 rounded-lg hover:bg-slate-300 font-semibold transition-colors"
            >
              ← Back to Input
            </button>
            <button
              onClick={handleGenerateComprehensive}
              className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition-colors"
            >
              ✓ Generate Comprehensive Requirement
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Comprehensive Requirement */}
      {step === "comprehensive" && (
        <div className="space-y-6">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-purple-900">Step 3 of 3: Analyze Complexity</p>
            <p className="text-xs text-purple-700 mt-1">Download the refined requirement or analyze complexity directly</p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-200 p-6">
            <h3 className="text-lg font-bold text-purple-900 mb-4">✅ Comprehensive Requirement</h3>

            <textarea
              value={comprehensiveRequirement}
              readOnly
              rows={20}
              className="w-full px-4 py-3 border border-purple-300 rounded-lg bg-white font-mono text-sm text-slate-800"
            />

            <p className="text-xs text-purple-700 mt-3">
              This comprehensive requirement is ready to use for accurate complexity analysis!
            </p>
          </div>

          {/* Next Steps */}
          <div className="space-y-2">
            {/* Download Button */}
            <button
              onClick={() => {
                const element = document.createElement("a");
                const file = new Blob([comprehensiveRequirement], { type: "text/plain" });
                element.href = URL.createObjectURL(file);
                element.download = `${refinedData?.useCaseName || "requirement"}-use-case.txt`;
                document.body.appendChild(element);
                element.click();
                document.body.removeChild(element);
              }}
              className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold transition-colors"
            >
              📥 Download Requirement
            </button>

            {/* Analyze Complexity Button */}
            <button
              onClick={async () => {
                setAnalyzing(true);
                // Directly analyze and go to history
                if (onAnalyzeRequirement) {
                  await onAnalyzeRequirement(comprehensiveRequirement, requirementTitle || refinedData?.useCaseName || "Refined Requirement");
                } else {
                  // Fallback: switch to analyze tab
                  if (onRefinementComplete) {
                    onRefinementComplete(comprehensiveRequirement);
                  }
                }
                setAnalyzing(false);
              }}
              disabled={analyzing}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-400 disabled:cursor-not-allowed font-semibold transition-colors"
            >
              {analyzing ? "⏳ Analyzing... Please wait" : "🚀 Analyze Complexity (from this page)"}
            </button>

            {/* Refine Another Button */}
            <button
              onClick={() => {
                setStep("input");
                setRawRequirement("");
                setRefinedData(null);
                setComprehensiveRequirement("");
              }}
              className="w-full px-4 py-3 bg-slate-200 text-slate-900 rounded-lg hover:bg-slate-300 font-semibold transition-colors"
            >
              🔄 Refine Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
