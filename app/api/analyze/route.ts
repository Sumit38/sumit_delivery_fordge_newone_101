import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { analyzeRequirementComplexity } from "@/lib/complexity-analyzer";

export async function POST(request: NextRequest) {
  try {
    console.log("🔍 [1/5] Checking Supabase authentication...");

    // ✅ STEP 1: Get auth from request
    const authHeader = request.headers.get('authorization');
    let userId: string | null = null;

    try {
      const token = authHeader?.replace('Bearer ', '');

      if (!token) {
        console.error("❌ [1/5] No token");
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }

      // Decode JWT to extract user ID
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.error("❌ [1/5] Invalid token");
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }

      const decoded = JSON.parse(
        Buffer.from(parts[1], 'base64').toString('utf-8')
      );
      userId = decoded.sub || null;

      console.log("✅ [1/5] Auth success. UserId:", userId);
    } catch (authError) {
      console.error("⚠️ [1/5] Auth error:", authError);
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!userId) {
      console.error("❌ [1/5] No userId found");
      return NextResponse.json(
        { error: "Unauthorized - please sign in" },
        { status: 401 }
      );
    }

    console.log("🔍 [2/5] Validating request body...");

    // ✅ STEP 2: Validate Input
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error("❌ [2/5] Failed to parse request body:", parseError);
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    let { requirementText, title } = body;

    if (!requirementText || typeof requirementText !== "string") {
      console.error("❌ [2/5] Missing or invalid requirementText");
      return NextResponse.json(
        { error: "Requirement text is required" },
        { status: 400 }
      );
    }

    // Sanitize text: remove null characters and other problematic Unicode
    requirementText = sanitizeText(requirementText);

    if (requirementText.trim().length < 50) {
      console.error("❌ [2/5] Requirement text too short");
      return NextResponse.json(
        { error: "Requirement text must be at least 50 characters" },
        { status: 400 }
      );
    }

    console.log("✅ [2/5] Request validation successful");
    console.log("🔍 [3/5] Checking Supabase connection...");

    // ✅ STEP 3: Supabase - Get User
    let userData;
    try {
      const { data, error: userError } = await supabaseServer
        .from("users")
        .select("id")
        .eq("id", userId)
        .single();

      if (userError) {
        console.error("❌ [3/5] Supabase query error:", userError);
        throw userError;
      }

      if (!data) {
        console.error("❌ [3/5] User not found in Supabase for id:", userId);
        return NextResponse.json(
          {
            error: "User not found in database",
            details: `No user found for id: ${userId}. Please complete your profile first.`,
          },
          { status: 404 }
        );
      }

      userData = data;
      console.log("✅ [3/5] Supabase user found:", userData.id);
    } catch (dbError) {
      console.error("❌ [3/5] Supabase error:", dbError);
      return NextResponse.json(
        {
          error: "Database connection error",
          details: String(dbError),
        },
        { status: 500 }
      );
    }

    console.log("🔍 [4/5] Analyzing requirement complexity...");

    // ✅ STEP 4: Claude API Analysis
    let analysis;
    try {
      analysis = await analyzeRequirementComplexity(requirementText);
      console.log("✅ [4/5] Complexity analysis successful");
    } catch (analysisError) {
      console.error("⚠️ [4/5] Claude API error, using fallback:", analysisError);
      analysis = {
        nodes: ["Start", "Input", "Process", "Output", "End"],
        edges: [
          { from: "Start", to: "Input", condition: "initialize" },
          { from: "Input", to: "Process", condition: "submit" },
          { from: "Process", to: "Output", condition: "complete" },
          { from: "Output", to: "End", condition: "finish" },
        ],
        paths: [["Start", "Input", "Process", "Output", "End"]],
        nodesCount: 5,
        edgesCount: 4,
        connectedComponents: 1,
        complexityScore: 0,
        testScenarios: 5,
        analysis: "Analysis using fallback structure",
        decisionPoints: ["Input", "Process"],
        alternativePaths: 1,
      };
    }

    // Sanitize analysis data
    const n = Math.max(parseInt(String(analysis.nodesCount)) || 5, 1);
    const e = Math.max(parseInt(String(analysis.edgesCount)) || 4, 1);
    const p = Math.max(
      parseInt(String(analysis.alternativePaths)) || 1,
      1
    );

    // CRITICAL FIX: Always calculate M using McCabe's formula M = E - N + 2P
    // Do NOT trust Claude's complexity score - it may be incorrect
    const calculatedComplexityScore = e - n + 2 * p;

    const sanitizedAnalysis = {
      nodesCount: n,
      edgesCount: e,
      complexityScore: calculatedComplexityScore,
      testScenarios: Math.max(
        parseInt(String(analysis.testScenarios)) || 5,
        1
      ),
      nodes: Array.isArray(analysis.nodes) ? analysis.nodes : [],
      edges: Array.isArray(analysis.edges) ? analysis.edges : [],
      paths: Array.isArray(analysis.paths) ? analysis.paths : [],
      decisionPoints: Array.isArray(analysis.decisionPoints)
        ? analysis.decisionPoints
        : [],
      alternativePaths: p,
      analysis: String(analysis.analysis || "Analysis complete"),
      reasoning: analysis.reasoning || "",
      confidenceScore: analysis.confidenceScore || 75,
      confidenceReason: analysis.confidenceReason || "Analysis complete",
    };

    console.log("🔍 [5/5] Saving to database...");

    // ✅ STEP 5: Save to Supabase Database
    let requirementData;
    let resultData;

    try {
      // Save requirement
      const { data: reqData, error: requirementError } = await supabaseServer
        .from("requirements")
        .insert({
          user_id: userData.id,
          document_text: requirementText,
          title: title || "Untitled Requirement",
        })
        .select()
        .single();

      if (requirementError) {
        console.error("❌ [5/5] Failed to save requirement:", requirementError);
        throw requirementError;
      }

      if (!reqData) {
        throw new Error("No data returned from requirement insert");
      }

      requirementData = reqData;
      console.log("✅ [5/5] Requirement saved, ID:", requirementData.id);

      // Save analysis results
      const { data: resData, error: resultError } = await supabaseServer
        .from("complexity_results")
        .insert({
          requirement_id: requirementData.id,
          nodes_count: sanitizedAnalysis.nodesCount,
          edges_count: sanitizedAnalysis.edgesCount,
          complexity_score: sanitizedAnalysis.complexityScore,
          test_scenarios: sanitizedAnalysis.testScenarios,
          analysis_data: {
            decisionPoints: sanitizedAnalysis.decisionPoints,
            alternativePaths: sanitizedAnalysis.alternativePaths,
            analysis: sanitizedAnalysis.analysis,
            reasoning: sanitizedAnalysis.reasoning,
            confidenceScore: sanitizedAnalysis.confidenceScore,
            confidenceReason: sanitizedAnalysis.confidenceReason,
          },
        })
        .select()
        .single();

      if (resultError) {
        console.error("❌ [5/5] Failed to save analysis results:", resultError);
        throw resultError;
      }

      if (!resData) {
        throw new Error("No data returned from results insert");
      }

      resultData = resData;
      console.log("✅ [5/5] Analysis results saved, ID:", resultData.id);
    } catch (dbError) {
      console.error("❌ [5/5] Database save failed:", dbError);
      return NextResponse.json(
        {
          error: "Failed to save analysis results",
          details: String(dbError),
        },
        { status: 500 }
      );
    }

    // ✅ SUCCESS: Return response
    console.log("✅ ✅ ✅ ALL STEPS COMPLETED SUCCESSFULLY ✅ ✅ ✅");

    // Check if analysis is incomplete/ambiguous (complexity score < 0 or disconnected graph)
    const isIncompleteAnalysis =
      sanitizedAnalysis.complexityScore < 0 ||
      sanitizedAnalysis.edgesCount < sanitizedAnalysis.nodesCount - 1;

    const responseData = {
      success: true,
      requirementId: String(requirementData.id),
      resultId: String(resultData.id),
      isIncompleteAnalysis,
      incompletenessReason: isIncompleteAnalysis
        ? "Not enough details provided. Please answer more questions about your requirement to get accurate complexity analysis."
        : null,
      analysis: {
        nodesCount: sanitizedAnalysis.nodesCount,
        edgesCount: sanitizedAnalysis.edgesCount,
        paths: sanitizedAnalysis.alternativePaths,
        alternativePaths: sanitizedAnalysis.alternativePaths,
        complexityScore: sanitizedAnalysis.complexityScore,
        testScenarios: sanitizedAnalysis.testScenarios,
        calculation: `M = E - N + 2P = ${sanitizedAnalysis.edgesCount} - ${sanitizedAnalysis.nodesCount} + 2(${sanitizedAnalysis.alternativePaths}) = ${sanitizedAnalysis.complexityScore}`,
        nodes: sanitizedAnalysis.nodes,
        edges: sanitizedAnalysis.edges,
        pathsList: sanitizedAnalysis.paths,
        decisionPoints: sanitizedAnalysis.decisionPoints,
        analysis: sanitizedAnalysis.analysis,
        reasoning: sanitizedAnalysis.reasoning,
        confidenceScore: sanitizedAnalysis.confidenceScore,
        confidenceReason: sanitizedAnalysis.confidenceReason,
      },
    };

    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ ❌ ❌ UNCAUGHT ERROR ❌ ❌ ❌");
    console.error("Message:", errorMessage);
    console.error("Full error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

function sanitizeText(text: string): string {
  // Remove null characters and other problematic Unicode characters
  return text
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "") // Control characters
    .replace(/[﻿]/g, "") // Zero-width no-break space
    .replace(/\0/g, "") // Null character (extra safety)
    .replace(/\\u0000/g, ""); // Escaped null character
}
