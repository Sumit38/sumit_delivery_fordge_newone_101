"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { PitchDeckQuestionsForm } from "./PitchDeckQuestionsForm";

interface PitchDeckTabProps {
  requirementId: string;
  requirementTitle: string;
}

interface PitchDeckPreview {
  title: string;
  slides: Array<{
    slideNumber: number;
    title: string;
    content: string[];
    notes?: string;
  }>;
  generatedAt: string;
}

export function PitchDeckTab({
  requirementId,
  requirementTitle,
}: PitchDeckTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [pitchDeck, setPitchDeck] = useState<PitchDeckPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [downloadLoading, setDownloadLoading] = useState(false);

  const handleGeneratePitchDeck = async (
    answers: Record<number, string | string[]>
  ) => {
    setLoading(true);
    setError("");

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session || !session.access_token) {
        throw new Error("Please sign in to generate pitch deck");
      }

      const response = await fetch("/api/generate-pitch-deck", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          requirementId,
          requirementTitle,
          answers,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate pitch deck");
      }

      setPitchDeck(data.pitchDeck);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Pitch deck error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPPT = async () => {
    if (!pitchDeck) return;

    setDownloadLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session || !session.access_token) {
        throw new Error("Please sign in to download");
      }

      const response = await fetch("/api/download-pitch-deck", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          pitchDeck,
          filename: `${requirementTitle.replace(/\s+/g, "-")}-pitch-deck.pptx`,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate PPT");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${requirementTitle.replace(/\s+/g, "-")}-pitch-deck.pptx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download");
    } finally {
      setDownloadLoading(false);
    }
  };

  const handleReset = () => {
    setPitchDeck(null);
    setShowForm(false);
    setError("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Generating pitch deck...</p>
        </div>
      </div>
    );
  }

  if (error && !pitchDeck) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700">❌ {error}</p>
        </div>
        <button
          onClick={() => {
            setError("");
            setShowForm(false);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Start Over
        </button>
      </div>
    );
  }

  if (showForm) {
    return (
      <PitchDeckQuestionsForm
        onSubmit={handleGeneratePitchDeck}
        onCancel={() => setShowForm(false)}
      />
    );
  }

  if (pitchDeck) {
    return (
      <div className="w-full">
        {/* Pitch Deck Preview */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-4">📊 {pitchDeck.title}</h2>

          {/* Slides Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {pitchDeck.slides.map((slide) => (
              <div
                key={slide.slideNumber}
                className="p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border border-slate-200 shadow-sm"
              >
                <div className="mb-3">
                  <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full mb-2">
                    Slide {slide.slideNumber}
                  </span>
                  <h3 className="text-lg font-bold text-slate-900">
                    {slide.title}
                  </h3>
                </div>

                <div className="space-y-2">
                  {slide.content.map((point, idx) => (
                    <p key={idx} className="text-sm text-slate-700">
                      • {point}
                    </p>
                  ))}
                </div>

                {slide.notes && (
                  <div className="mt-3 p-2 bg-yellow-50 rounded text-xs text-slate-600 border-l-2 border-yellow-300">
                    <strong>Notes:</strong> {slide.notes}
                  </div>
                )}
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-500 mt-4">
            Generated: {new Date(pitchDeck.generatedAt).toLocaleString()}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={handleDownloadPPT}
            disabled={downloadLoading}
            className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-slate-400 transition flex items-center justify-center gap-2"
          >
            {downloadLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Preparing...
              </>
            ) : (
              <>📥 Download as PPT</>
            )}
          </button>

          <button
            onClick={() => {
              setShowForm(true);
              setPitchDeck(null);
            }}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            ✏️ Revalidate & Regenerate
          </button>

          <button
            onClick={handleReset}
            className="flex-1 px-4 py-3 border border-slate-300 rounded-lg text-slate-700 font-semibold hover:bg-slate-50 transition"
          >
            🔄 Start Over
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">⚠️ {error}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">🎯 Proposed Pitch Deck</h2>
        <p className="text-slate-600">
          Create a professional pitch deck for your project in PPT format
        </p>
      </div>

      <button
        onClick={() => setShowForm(true)}
        className="px-8 py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 text-lg transition"
      >
        🚀 Start Pitch Deck Generation
      </button>
    </div>
  );
}
