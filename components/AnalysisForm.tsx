"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface RefinedQuestion {
  id: string;
  question: string;
  suggestedAnswer: string;
  userAnswer: string;
}

interface AnalysisFormProps {
  onComplete: () => void;
  onRefineRequired?: (requirementText: string) => void;
}

export default function AnalysisForm({ onComplete, onRefineRequired }: AnalysisFormProps) {
  const [title, setTitle] = useState("");
  const [requirementText, setRequirementText] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [inputMethod, setInputMethod] = useState<"text" | "file" | "website">("text");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileLoading(true);
    setError("");

    try {
      const text = await extractTextFromFile(file);
      if (text.length < 50) {
        setError("Uploaded file must contain at least 50 characters");
      } else {
        setRequirementText(text);
        setUploadedFileName(file.name);
        if (!title) {
          setTitle(file.name.replace(/\.[^/.]+$/, ""));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file");
    } finally {
      setFileLoading(false);
    }
  };

  const extractTextFromFile = async (file: File): Promise<string> => {
    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    // Plain text files
    if (fileType === "text/plain" || fileName.endsWith(".txt")) {
      return await file.text();
    }

    // PDF files
    if (fileType === "application/pdf" || fileName.endsWith(".pdf")) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const response = await fetch("/api/extract-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: arrayBuffer,
        });
        if (!response.ok) throw new Error("Failed to extract PDF");
        const data = await response.json();
        return data.text;
      } catch (err) {
        throw new Error(
          "Failed to extract PDF text. Please ensure PDF contains readable text."
        );
      }
    }

    // Word documents
    if (
      fileType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileName.endsWith(".docx")
    ) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const response = await fetch("/api/extract-docx", {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: arrayBuffer,
        });
        if (!response.ok) throw new Error("Failed to extract DOCX");
        const data = await response.json();
        return data.text;
      } catch (err) {
        throw new Error(
          "Failed to extract Word document. Please ensure file is a valid DOCX."
        );
      }
    }

    // CSV/Excel files
    if (
      fileType === "text/csv" ||
      fileName.endsWith(".csv") ||
      fileName.endsWith(".xlsx") ||
      fileName.endsWith(".xls")
    ) {
      throw new Error(
        "Excel/CSV files are not supported. Please save as .txt file first."
      );
    }

    throw new Error(
      "Unsupported file type. Supported formats: .txt, .pdf, .docx"
    );
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

  const handleWebsiteUrlSubmit = async () => {
    if (!websiteUrl.trim()) {
      setError("Please enter a valid URL");
      return;
    }

    setFileLoading(true);
    setError("");

    try {
      const text = await extractTextFromWebsite(websiteUrl);
      if (text.length < 50) {
        setError("Extracted content must be at least 50 characters");
      } else {
        setRequirementText(text);
        setWebsiteUrl("");
        setInputMethod("text");
        if (!title) {
          setTitle(new URL(websiteUrl).hostname);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to extract website content");
    } finally {
      setFileLoading(false);
    }
  };

  const handleRefineRequirement = () => {
    if (!requirementText.trim() || requirementText.trim().length < 50) {
      setError("❌ Please enter at least 50 characters");
      return;
    }

    setError("");
    // Pass requirement to parent which will switch to Refine tab
    onRefineRequired?.(requirementText);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    // Validate title
    if (!title.trim()) {
      setError("❌ Please enter a requirement title (for audit trail)");
      return;
    }

    if (title.trim().length < 3) {
      setError("❌ Title must be at least 3 characters");
      return;
    }

    // Validate requirement content (either upload or paste)
    if (!requirementText.trim()) {
      setError(
        "❌ Please either upload a file (.txt) or paste your requirement text"
      );
      return;
    }

    if (requirementText.trim().length < 50) {
      setError(
        "❌ Requirement must be at least 50 characters (upload file or paste more text)"
      );
      return;
    }

    setLoading(true);

    try {
      // Get session for auth
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Not authenticated. Please sign in.");
      }

      // Check for refined requirement from sessionStorage
      const refinedFromSession = typeof window !== "undefined" ? sessionStorage.getItem("refinedRequirementText") : null;
      const textToAnalyze = refinedFromSession || requirementText;

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          requirementText: textToAnalyze,
          title: title || "Untitled Requirement",
        }),
      });

      // Log the response status
      console.log("Response status:", response.status);
      console.log("Response headers:", response.headers);

      // Get response text first
      const responseText = await response.text();
      console.log("Response text:", responseText);

      if (!response.ok) {
        console.error("Error response:", responseText);
        try {
          const data = JSON.parse(responseText);
          throw new Error(data.error || "Analysis failed");
        } catch {
          throw new Error(
            `Server error (${response.status}): ${responseText.substring(0, 100)}`
          );
        }
      }

      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        console.error("Attempted to parse:", responseText);
        throw new Error(
          "Invalid response from server - not valid JSON. Check console for details."
        );
      }

      console.log("Parsed data:", data);

      if (data.success) {
        setSuccess(true);
        setTitle("");
        setRequirementText("");

        // Delay to show success message
        setTimeout(() => {
          onComplete();
        }, 1500);
      } else {
        throw new Error(data.error || "Analysis failed");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      console.error("Catch error:", errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-900 mb-6">
        Analyze a Requirement
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title Input */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Requirement Title *
            <span className="text-xs text-slate-500 font-normal ml-1">
              (Required for tracking & audit trail)
            </span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., User Registration Flow"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
            required
          />
          <p className="text-xs text-slate-500 mt-1">
            Minimum 3 characters - helps track requirements over time
          </p>
        </div>

        {/* Consolidated Input Methods */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Requirement Document *
          </label>
          <p className="text-xs text-slate-500 mb-4">
            Choose your preferred input method
          </p>

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
              📄 Upload File
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

          {/* Paste Text Tab */}
          {inputMethod === "text" && (
            <textarea
              value={requirementText}
              onChange={(e) => setRequirementText(e.target.value)}
              placeholder="Paste your entire requirement document here... (minimum 50 characters)"
              rows={12}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              disabled={loading || fileLoading}
            />
          )}

          {/* Upload File Tab */}
          {inputMethod === "file" && (
            <div>
              <label className="flex items-center justify-center w-full px-4 py-8 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-500 transition-colors bg-slate-50">
                <div className="text-center">
                  <svg
                    className="mx-auto h-8 w-8 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  <p className="text-sm text-slate-600 mt-1">
                    {uploadedFileName ? (
                      <>
                        <span className="font-semibold text-green-600">
                          ✓ {uploadedFileName}
                        </span>
                        <span className="block text-xs text-slate-500 mt-1">
                          Click to replace
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="font-semibold">Click to upload</span>
                        <span className="block text-xs text-slate-500">
                          or drag and drop
                        </span>
                      </>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 mt-2">
                    Supported: .txt files only
                  </p>
                </div>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  disabled={loading || fileLoading}
                  className="hidden"
                  accept=".txt,.text/plain"
                />
              </label>
              {fileLoading && (
                <p className="text-sm text-blue-600 mt-2">Processing file...</p>
              )}
            </div>
          )}

          {/* Website Link Tab */}
          {inputMethod === "website" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://example.com/requirements"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading || fileLoading}
                />
                <button
                  type="button"
                  onClick={handleWebsiteUrlSubmit}
                  disabled={loading || fileLoading || !websiteUrl.trim()}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-400 font-semibold text-sm transition-colors"
                >
                  {fileLoading ? "Loading..." : "Extract"}
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Enter a URL to a public webpage with your requirements. We'll extract the text content automatically.
              </p>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            ❌ {error}
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            ✅ Analysis complete! Redirecting to results...
          </div>
        )}

        {/* Buttons */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleRefineRequirement}
            disabled={fileLoading || !requirementText.trim()}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed font-semibold transition-colors"
          >
            🔍 Refine First
          </button>
          <button
            type="submit"
            disabled={loading || success}
            className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-400 disabled:cursor-not-allowed font-semibold transition-colors"
          >
            {loading ? "Analyzing..." : "🚀 Analyze Complexity"}
          </button>
        </div>
      </form>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">✓ Both methods are tracked equally:</h3>
        <ol className="text-sm text-blue-800 space-y-1 ml-4 list-decimal">
          <li>
            <strong>Upload file</strong> (.txt) OR <strong>Paste text</strong> - both tracked in audit trail
          </li>
          <li>Our AI analyzes to identify decision points and paths</li>
          <li>Nodes (states) and edges (transitions) are extracted</li>
          <li>Cyclomatic complexity is calculated: M = E - N + 2P</li>
          <li>Get the justified number of test scenarios needed</li>
        </ol>
      </div>

      {/* Supported Formats */}
      <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
        <h3 className="font-semibold text-green-900 mb-2">✅ Supported Input Methods:</h3>
        <ul className="text-sm text-green-800 space-y-1">
          <li>✅ <strong>Paste Text</strong> - Copy-paste from any source (recommended)</li>
          <li>✅ <strong>.txt files</strong> - Plain text documents</li>
          <li>✅ <strong>Website URLs</strong> - Public webpages (text extraction)</li>
        </ul>
      </div>

      {/* For Other Formats */}
      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">📋 For Word, PDF, Excel & Other Files:</h3>
        <p className="text-sm text-blue-800 mb-2">Simply copy the text and paste it:</p>
        <ol className="text-sm text-blue-800 space-y-1 ml-4 list-decimal">
          <li>Open your document (PDF, Word, Excel, etc.)</li>
          <li>Select all text (Ctrl+A or Cmd+A)</li>
          <li>Copy (Ctrl+C or Cmd+C)</li>
          <li>Return here and select "📝 Paste Text" tab</li>
          <li>Paste (Ctrl+V or Cmd+V)</li>
        </ol>
      </div>
    </div>
  );
}
