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
}

function buildUseCaseHTML(useCaseTitle: string, useCaseQA: UseCaseQA | null): string {
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
    const response = await fetch("/api/generate-use-case-qa", {
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
