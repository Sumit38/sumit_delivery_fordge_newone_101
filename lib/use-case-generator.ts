import { authFetch } from "@/lib/auth-fetch";

interface UseCaseData {
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

interface UseCaseQA {
  useCaseTitle: string;
  description: string;
  actors: Array<{ name: string; role: string }>;
  preconditions: string[];
  mainFlow: Array<{ step: number; actor: string; action: string }>;
  alternativeFlows: Array<{
    name: string;
    trigger: string;
    steps: Array<{ step: number; actor: string; action: string }>;
  }>;
  exceptionFlows: Array<{ name: string; trigger: string; resolution: string }>;
  postconditions: string[];
  businessValue: string;
  kpis: Array<{ metric: string; target: string; currentState: string }>;
  nonFunctionalRequirements?: Array<{
    category: string;
    requirement: string;
    measure: string;
    priority?: string;
    source?: string;
  }>;
  fieldValidations?: Array<{
    screen?: string;
    field: string;
    type: string;
    mandatory: boolean | string;
    rules: string;
    errorMessage: string;
    source?: string;
  }>;
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildNfrHtml(useCaseQA: UseCaseQA): string {
  const items = Array.isArray(useCaseQA.nonFunctionalRequirements) ? useCaseQA.nonFunctionalRequirements : [];
  if (!items.length) return "";

  // Group by category so related requirements sit together
  const groups = new Map<string, typeof items>();
  items.forEach((nfr) => {
    const key = nfr.category || "General";
    groups.set(key, [...(groups.get(key) || []), nfr]);
  });

  let row = 0;
  const rows = [...groups.entries()]
    .map(([category, list]) =>
      list
        .map((nfr, i) => {
          row += 1;
          return `<tr>
        <td>NFR-${String(row).padStart(2, "0")}</td>
        ${i === 0 ? `<td rowspan="${list.length}"><strong>${esc(category)}</strong></td>` : ""}
        <td>${esc(nfr.requirement)}</td>
        <td>${esc(nfr.measure)}</td>
        <td>${esc(nfr.priority || "Should")}</td>
        <td><span class="tag ${nfr.source === "Stated" ? "stated" : "assumed"}">${esc(nfr.source || "Assumed")}</span></td>
      </tr>`;
        })
        .join("")
    )
    .join("");

  return `<p class="note">Quality attributes the solution must meet. Each has a measurable target so it can be tested. Items marked <em>Assumed</em> are industry defaults; please confirm them with the business.</p>
    <table>
      <tr><th>ID</th><th>Category</th><th>Requirement</th><th>Measure / Target</th><th>Priority</th><th>Source</th></tr>
      ${rows}
    </table>`;
}

function buildFieldValidationHtml(useCaseQA: UseCaseQA): string {
  const items = Array.isArray(useCaseQA.fieldValidations) ? useCaseQA.fieldValidations : [];
  if (!items.length) return "";

  const isMandatory = (v: boolean | string) => v === true || String(v).toLowerCase() === "true" || String(v).toLowerCase() === "yes";
  const rows = items
    .map(
      (f, i) => `<tr>
        <td>FV-${String(i + 1).padStart(2, "0")}</td>
        <td>${esc(f.screen || "-")}</td>
        <td><strong>${esc(f.field)}</strong></td>
        <td>${esc(f.type)}</td>
        <td>${isMandatory(f.mandatory) ? "Yes" : "No"}</td>
        <td>${esc(f.rules)}</td>
        <td>${esc(f.errorMessage)}</td>
        <td><span class="tag ${f.source === "Stated" ? "stated" : "assumed"}">${esc(f.source || "Assumed")}</span></td>
      </tr>`
    )
    .join("");

  return `<p class="note">Input rules for each field the user enters. These drive front-end and back-end validation and the negative test cases.</p>
    <table class="compact">
      <tr><th>ID</th><th>Screen</th><th>Field</th><th>Type</th><th>Mandatory</th><th>Validation Rules</th><th>Error Message</th><th>Source</th></tr>
      ${rows}
    </table>`;
}

export function buildUseCaseHTML(useCaseTitle: string, useCaseQA: UseCaseQA | null): string {
  const actorsHtml = useCaseQA
    ? useCaseQA.actors
        .map((actor) => `<li><strong>${actor.name}:</strong> ${actor.role}</li>`)
        .join("")
    : "";

  const preconditionsHtml = useCaseQA
    ? useCaseQA.preconditions.map((pc) => `<li>${pc}</li>`).join("")
    : "";

  const mainFlowHtml = useCaseQA
    ? useCaseQA.mainFlow
        .map((step) => `<li><strong>${step.actor}:</strong> ${step.action}</li>`)
        .join("")
    : "";

  const alternativeFlowsHtml = useCaseQA
    ? useCaseQA.alternativeFlows
        .map(
          (flow) =>
            `<h3>${flow.name}</h3>
      <p><strong>Trigger:</strong> ${flow.trigger}</p>
      <ol>
        ${flow.steps.map((step) => `<li><strong>${step.actor}:</strong> ${step.action}</li>`).join("")}
      </ol>`
        )
        .join("")
    : "";

  const exceptionFlowsHtml = useCaseQA
    ? useCaseQA.exceptionFlows
        .map(
          (exception) =>
            `<div class="step">
        <strong>${exception.name}</strong><br>
        <strong>Trigger:</strong> ${exception.trigger}<br>
        <strong>Resolution:</strong> ${exception.resolution}
      </div>`
        )
        .join("")
    : "";

  const postconditionsHtml = useCaseQA
    ? useCaseQA.postconditions.map((pc) => `<li>${pc}</li>`).join("")
    : "";

  const kpisHtml = useCaseQA
    ? useCaseQA.kpis
        .map(
          (kpi) =>
            `<tr>
        <td>${kpi.metric}</td>
        <td>${kpi.target}</td>
        <td>${kpi.currentState}</td>
      </tr>`
        )
        .join("")
    : "";

  const nfrHtml = useCaseQA ? buildNfrHtml(useCaseQA) : "";
  const fieldValidationHtml = useCaseQA ? buildFieldValidationHtml(useCaseQA) : "";

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Use Case: ${useCaseTitle}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            background: white;
          }

          .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
          }

          .header {
            border-bottom: 3px solid #0066cc;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }

          h1 {
            color: #0066cc;
            font-size: 28px;
            margin-bottom: 10px;
          }

          h2 {
            color: #0066cc;
            font-size: 18px;
            margin-top: 30px;
            margin-bottom: 15px;
            border-left: 4px solid #0066cc;
            padding-left: 10px;
          }

          h3 {
            color: #333;
            font-size: 14px;
            margin-top: 15px;
            margin-bottom: 10px;
          }

          .section {
            margin-bottom: 25px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
          }

          td, th {
            padding: 10px;
            text-align: left;
            border: 1px solid #ddd;
          }

          th {
            background-color: #f0f0f0;
            font-weight: bold;
          }

          ul, ol {
            margin-left: 20px;
            margin-top: 10px;
          }

          li {
            margin-bottom: 8px;
            line-height: 1.5;
          }

          .step {
            background-color: #f9f9f9;
            padding: 15px;
            margin: 10px 0;
            border-left: 4px solid #0066cc;
            border-radius: 3px;
          }

          .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #999;
            font-size: 11px;
            text-align: center;
          }

          .note {
            color: #555;
            font-size: 12px;
            margin-bottom: 8px;
          }

          table.compact td, table.compact th {
            padding: 6px;
            font-size: 11px;
          }

          .tag {
            display: inline-block;
            padding: 1px 6px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: bold;
          }

          .tag.stated { background: #e3f2fd; color: #0d47a1; }
          .tag.assumed { background: #fff3e0; color: #e65100; }

          tr { page-break-inside: avoid; }

          .use-case-id {
            color: #666;
            font-size: 12px;
            margin-bottom: 5px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="use-case-id">Professional Use Case Document</div>
            <h1>${useCaseTitle}</h1>
          </div>

          ${
            useCaseQA
              ? `
          <div class="section">
            <h2>1. Description</h2>
            <p>${useCaseQA.description}</p>
          </div>

          <div class="section">
            <h2>2. Actors & Roles</h2>
            <ul>
              ${actorsHtml}
            </ul>
          </div>

          <div class="section">
            <h2>3. Preconditions</h2>
            <ul>
              ${preconditionsHtml}
            </ul>
          </div>

          <div class="section">
            <h2>4. Main Flow (Success Scenario)</h2>
            <ol>
              ${mainFlowHtml}
            </ol>
          </div>

          ${alternativeFlowsHtml ? `<div class="section"><h2>5. Alternative Flows</h2>${alternativeFlowsHtml}</div>` : ""}

          ${exceptionFlowsHtml ? `<div class="section"><h2>6. Exception Flows</h2>${exceptionFlowsHtml}</div>` : ""}

          <div class="section">
            <h2>7. Postconditions</h2>
            <ul>
              ${postconditionsHtml}
            </ul>
          </div>

          <div class="section">
            <h2>8. Business Value</h2>
            <p>${useCaseQA.businessValue}</p>
          </div>

          <div class="section">
            <h2>9. Key Performance Indicators (KPIs)</h2>
            <table>
              <tr>
                <th>Metric</th>
                <th>Target Value</th>
                <th>Current State</th>
              </tr>
              ${kpisHtml}
            </table>
          </div>

          ${nfrHtml ? `<div class="section"><h2>10. Non-Functional Requirements</h2>${nfrHtml}</div>` : ""}

          ${fieldValidationHtml ? `<div class="section"><h2>${nfrHtml ? "11" : "10"}. Field Validations</h2>${fieldValidationHtml}</div>` : ""}
          `
              : `
          <div class="section">
            <h2>1. Requirement Summary</h2>
            <p>This use case document was generated from the following requirement:</p>
            <p>${useCaseQA || "Requirements data available"}</p>
          </div>
          `
          }

          <div class="footer">
            <p>Generated by DeliveryForge on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
            <p>This is an AI-generated use case based on complexity analysis.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function generateUseCasePDF(data: UseCaseData): Promise<void> {
  let useCaseQA: UseCaseQA | null = null;

  // Clear any old use case data from sessionStorage to prevent caching issues
  const cacheKey = `usecase_${data.analysisId || data.requirementTitle}`;
  sessionStorage.removeItem(cacheKey);

  try {
    const response = await authFetch("/api/generate-use-case-qa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requirementText: data.requirementText,
        requirementTitle: data.requirementTitle,
        analysisId: data.analysisId || data.requirementTitle,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      useCaseQA = result.data;
    }
  } catch (error) {
    console.error("Error generating use case QA:", error);
  }

  const useCaseTitle = useCaseQA?.useCaseTitle || data.requirementTitle;
  const htmlContent = buildUseCaseHTML(useCaseTitle, useCaseQA);

  const blob = new Blob([htmlContent], { type: "text/html" });
  const url = URL.createObjectURL(blob);

  const printWindow = window.open(url, "_blank");

  if (printWindow) {
    printWindow.onload = () => {
      printWindow.document.title = useCaseTitle + " - UseCase";
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
  }
}
