"use client";

import { useState } from "react";
import {
  estimationQuestions,
  budgetQuestion,
  EstimationQuestion,
} from "@/lib/estimation-questions";
import {
  DEVELOPER_ROLES,
  SUPPORT_ROLES,
  TESTER_ROLES,
  WORKSTREAMS,
  TEST_TYPES,
  TEST_CASES_PER_SCENARIO,
  countRoles,
  seniorityFromSkill,
  type RoleAllocation,
  type RoleDef,
  type Seniority,
  type TeamAnswers,
  type TestingAnswers,
} from "@/lib/estimation-team";

interface EstimationQuestionsFormProps {
  complexityScore: number;
  testScenarios?: number;
  onSubmit: (answers: Record<string, any>) => Promise<void>;
  onCancel: () => void;
}

// Step 1 keeps the original project questions. "How many developers" (Q2) and
// "testing level" (Q5) are now answered by the team and testing steps.
const PROJECT_QUESTION_IDS = [1, 3, 4, 6, 7];
const SENIORITIES: Seniority[] = ["Junior", "Mid", "Senior"];
const STEPS = ["Project", "Development team", "Testing"];

type Roles = Record<string, RoleAllocation>;

const emptyRoles = (defs: RoleDef[], seniority: Seniority, involvement?: number): Roles =>
  Object.fromEntries(defs.map((r) => [r.id, { count: 0, seniority, ...(involvement ? { involvement } : {}) }]));

export function EstimationQuestionsForm({
  complexityScore,
  testScenarios,
  onSubmit,
  onCancel,
}: EstimationQuestionsFormProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [includeBudget, setIncludeBudget] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [workstreams, setWorkstreams] = useState<string[]>(["ui", "backend", "database"]);
  const [devRoles, setDevRoles] = useState<Roles>(() => emptyRoles(DEVELOPER_ROLES, "Mid"));
  const [supportRoles, setSupportRoles] = useState<Roles>(() => emptyRoles(SUPPORT_ROLES, "Mid", 0.5));
  const [testers, setTesters] = useState<Roles>(() => ({
    ...emptyRoles(TESTER_ROLES, "Mid"),
    manual: { count: 1, seniority: "Mid" },
  }));
  const [testTypes, setTestTypes] = useState<string[]>(["Functional", "Regression", "UAT support"]);
  const [automationCoverage, setAutomationCoverage] = useState(0.25);
  const [testCycles, setTestCycles] = useState(2);
  const [approach, setApproach] = useState<TestingAnswers["approach"]>("in-sprint");
  const [environment, setEnvironment] = useState<TestingAnswers["environment"]>("ready");
  const [testData, setTestData] = useState<TestingAnswers["testData"]>("available");
  const [defectBuffer, setDefectBuffer] = useState(0.2);

  const projectQuestions = estimationQuestions.filter((q) => PROJECT_QUESTION_IDS.includes(q.id));
  const developerCount = countRoles(devRoles);
  const testerCount = countRoles(testers);
  const scenarios = testScenarios || complexityScore;

  const handleChange = (questionId: number, value: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    // The overall skill level becomes the starting seniority for every role
    if (questionId === 1) {
      const s = seniorityFromSkill(value);
      const reset = (roles: Roles) =>
        Object.fromEntries(Object.entries(roles).map(([id, r]) => [id, r.count > 0 ? r : { ...r, seniority: s }]));
      setDevRoles((prev) => reset(prev));
      setTesters((prev) => reset(prev));
    }
  };

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const stepError = (s: number): string => {
    if (s === 0) {
      const missing = projectQuestions.filter((q) => answers[q.id] === undefined || answers[q.id] === "" || Number.isNaN(answers[q.id]));
      if (missing.length) return "Please answer all project questions.";
      if (includeBudget && !answers[8]) return "Please enter the cost per hour, or switch off budget calculation.";
    }
    if (s === 1) {
      if (workstreams.length === 0) return "Select at least one kind of work the solution needs.";
      if (developerCount === 0) return "Add at least one developer.";
    }
    if (s === 2 && testTypes.length === 0) return "Select at least one kind of testing.";
    return "";
  };

  const next = () => {
    const msg = stepError(step);
    setError(msg);
    if (!msg) setStep((s) => s + 1);
  };

  // The form never submits by itself: Enter in an earlier step moves forward,
  // and only the "Generate Estimation" button on the Testing step generates.
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < STEPS.length - 1) next();
  };

  const handleGenerate = async () => {
    for (let s = 0; s < STEPS.length; s++) {
      const msg = stepError(s);
      if (msg) {
        setStep(s);
        setError(msg);
        return;
      }
    }
    setError("");

    const team: TeamAnswers = { workstreams, roles: devRoles, support: supportRoles };
    const testing: TestingAnswers = {
      testers,
      testTypes,
      automationCoverage: testTypes.includes("Test automation") ? automationCoverage : 0,
      testCycles,
      approach,
      environment,
      testData,
      defectBuffer,
    };
    const payload: Record<string, any> = {
      ...answers,
      2: developerCount, // kept for screens that read "number of developers"
      5: `Custom: ${testTypes.length} test types`,
      team,
      testing,
    };
    if (!includeBudget) delete payload[8];

    setLoading(true);
    try {
      await onSubmit(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate estimation");
    } finally {
      setLoading(false);
    }
  };

  const renderQuestion = (question: EstimationQuestion, number: number) => (
    <div key={question.id} className="border-b pb-6 last:border-b-0">
      <label className="block mb-3">
        <span className="text-lg font-semibold text-gray-800">
          {number}. {question.question}
        </span>
        {question.helpText && <span className="text-sm text-gray-500 mt-1 block">💡 {question.helpText}</span>}
      </label>
      {question.type === "radio" && question.options ? (
        <div className="space-y-2">
          {question.options.map((option) => (
            <label key={option} className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-blue-50 transition">
              <input
                type="radio"
                name={`question-${question.id}`}
                value={option}
                checked={answers[question.id] === option}
                onChange={(e) => handleChange(question.id, e.target.value)}
                className="w-4 h-4 text-blue-600"
              />
              <span className="ml-3 text-gray-700">{option}</span>
            </label>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <input
            type="number"
            value={answers[question.id] ?? ""}
            onChange={(e) => handleChange(question.id, parseInt(e.target.value))}
            placeholder={`Enter value${question.range ? ` (${question.range})` : ""}`}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {question.unit && <span className="text-sm text-gray-600">{question.unit}</span>}
        </div>
      )}
    </div>
  );

  const roleTable = (
    defs: RoleDef[],
    roles: Roles,
    setRoles: React.Dispatch<React.SetStateAction<Roles>>,
    withInvolvement = false
  ) => (
    <div className="border border-gray-200 rounded-lg divide-y">
      {defs.map((def) => {
        const r = roles[def.id];
        const update = (patch: Partial<RoleAllocation>) =>
          setRoles((prev) => ({ ...prev, [def.id]: { ...prev[def.id], ...patch } }));
        return (
          <div key={def.id} className={`p-3 flex flex-wrap items-center gap-3 ${r.count > 0 ? "bg-blue-50" : ""}`}>
            <div className="flex-1 min-w-[180px]">
              <div className="font-medium text-gray-900">{def.label}</div>
              <div className="text-xs text-gray-500">{def.hint}</div>
            </div>
            <label className="flex items-center gap-1 text-sm text-gray-600">
              People
              <input
                type="number"
                min={0}
                max={50}
                value={r.count}
                onChange={(e) => update({ count: Math.max(0, Math.min(50, parseInt(e.target.value) || 0)) })}
                className="w-16 px-2 py-1 border border-gray-300 rounded"
                aria-label={`${def.label} count`}
              />
            </label>
            <select
              value={r.seniority}
              onChange={(e) => update({ seniority: e.target.value as Seniority })}
              disabled={r.count === 0}
              className="px-2 py-1 border border-gray-300 rounded text-sm disabled:bg-gray-100"
              aria-label={`${def.label} seniority`}
            >
              {SENIORITIES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {withInvolvement && (
              <select
                value={r.involvement ?? 0.5}
                onChange={(e) => update({ involvement: parseFloat(e.target.value) })}
                disabled={r.count === 0}
                className="px-2 py-1 border border-gray-300 rounded text-sm disabled:bg-gray-100"
                aria-label={`${def.label} involvement`}
              >
                <option value={0.25}>25% of their time</option>
                <option value={0.5}>50% of their time</option>
                <option value={1}>Full time</option>
              </select>
            )}
          </div>
        );
      })}
    </div>
  );

  const chip = (label: string, active: boolean, onClick: () => void) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-lg border text-sm transition ${
        active ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-300 text-gray-700 hover:bg-blue-50"
      }`}
    >
      {active ? "✓ " : ""}
      {label}
    </button>
  );

  const choice = <T extends string | number>(
    label: string,
    value: T,
    setValue: (v: T) => void,
    options: Array<{ value: T; label: string }>,
    help?: string
  ) => (
    <div>
      <div className="font-semibold text-gray-800 mb-1">{label}</div>
      {help && <div className="text-sm text-gray-500 mb-2">💡 {help}</div>}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => chip(o.label, value === o.value, () => setValue(o.value)))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-blue-600 text-white p-6 border-b">
          <h2 className="text-2xl font-bold mb-2">📊 Generate Estimation</h2>
          <p className="text-blue-100">Tell us about the project, the team and the testing plan</p>
          <div className="mt-4 bg-blue-700 rounded p-3 text-sm">
            <strong>Complexity Score: {complexityScore}</strong> - This will be the baseline for effort calculation
          </div>
          <div className="mt-4 flex gap-2">
            {STEPS.map((label, i) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  if (i <= step) {
                    setError("");
                    setStep(i);
                  }
                }}
                className={`flex-1 rounded px-2 py-2 text-sm font-semibold ${
                  i === step ? "bg-white text-blue-700" : i < step ? "bg-blue-500 text-white" : "bg-blue-700 text-blue-200"
                }`}
              >
                {i < step ? "✓ " : `${i + 1}. `}
                {label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleFormSubmit} className="p-6 space-y-8">
          {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">❌ {error}</div>}

          {step === 0 && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeBudget}
                    onChange={(e) => setIncludeBudget(e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded cursor-pointer"
                  />
                  <div>
                    <div className="font-semibold text-gray-900">💰 Include Budget Calculation?</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Enable this to calculate project cost estimation based on hourly rates
                    </div>
                  </div>
                </label>
              </div>
              {projectQuestions.map((q, i) => renderQuestion(q, i + 1))}
              {includeBudget && (
                <div className="bg-blue-50 rounded-lg p-4">{renderQuestion(budgetQuestion, projectQuestions.length + 1)}</div>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <div className="text-lg font-semibold text-gray-800 mb-1">What kind of work does this solution need?</div>
                <div className="text-sm text-gray-500 mb-3">
                  💡 Development effort (M × 8 h) is shared across these areas, and each area needs someone who can do it.
                </div>
                <div className="flex flex-wrap gap-2">
                  {WORKSTREAMS.map((w) => chip(w.label, workstreams.includes(w.id), () => setWorkstreams((p) => toggle(p, w.id))))}
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <div className="text-lg font-semibold text-gray-800">Developers on the team</div>
                  <div className="text-sm font-semibold text-blue-700">{developerCount} developer{developerCount === 1 ? "" : "s"}</div>
                </div>
                <div className="text-sm text-gray-500 mb-3">
                  💡 Enter how many of each type you have and how senior they are (Junior 1.5×, Mid 1.0×, Senior 0.8× effort).
                </div>
                {roleTable(DEVELOPER_ROLES, devRoles, setDevRoles)}
              </div>

              <div>
                <div className="text-lg font-semibold text-gray-800 mb-1">Other roles (optional)</div>
                <div className="text-sm text-gray-500 mb-3">💡 Counted by time on the project, not by complexity.</div>
                {roleTable(SUPPORT_ROLES, supportRoles, setSupportRoles, true)}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700">
                Testing is sized from <strong>{scenarios} test scenarios</strong>
                {testScenarios ? " found in the analysis" : " (complexity score, as the analysis has no scenario count)"}
                {" "}× {TEST_CASES_PER_SCENARIO} test cases each (positive, negative, edge) ={" "}
                <strong>{scenarios * TEST_CASES_PER_SCENARIO} test cases</strong>.
              </div>

              <div>
                <div className="text-lg font-semibold text-gray-800 mb-1">Which kinds of testing are needed?</div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {TEST_TYPES.map((t) => chip(t, testTypes.includes(t), () => setTestTypes((p) => toggle(p, t))))}
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <div className="text-lg font-semibold text-gray-800">Testers on the team</div>
                  <div className="text-sm font-semibold text-blue-700">{testerCount} tester{testerCount === 1 ? "" : "s"}</div>
                </div>
                <div className="text-sm text-gray-500 mb-3">💡 If a kind of testing has no matching tester, the report flags it.</div>
                {roleTable(TESTER_ROLES, testers, setTesters)}
              </div>

              {testTypes.includes("Test automation") &&
                choice("How much of the testing will be automated?", automationCoverage, setAutomationCoverage, [
                  { value: 0.25, label: "25%" },
                  { value: 0.5, label: "50%" },
                  { value: 0.75, label: "75%" },
                ], "Scripting costs 1.5 h per automated test case; it saves manual runs in each cycle.")}

              {choice("How many test execution cycles?", testCycles, setTestCycles, [
                { value: 1, label: "1 cycle" },
                { value: 2, label: "2 cycles" },
                { value: 3, label: "3 cycles" },
              ], "Regression, if selected, adds one more cycle.")}

              {choice("When does testing happen?", approach, setApproach, [
                { value: "in-sprint", label: "Inside each sprint, alongside development" },
                { value: "after-dev", label: "After development, as a separate phase" },
              ])}

              {choice("Is a test environment available?", environment, setEnvironment, [
                { value: "ready", label: "Yes, dedicated and ready" },
                { value: "shared", label: "Shared with other teams" },
                { value: "setup", label: "No, it must be set up" },
              ])}

              {choice("Is test data available?", testData, setTestData, [
                { value: "available", label: "Yes, available" },
                { value: "create", label: "Must be created" },
                { value: "mask", label: "Must be copied from production and masked" },
              ])}

              {choice("How much time should be kept for fixing defects?", defectBuffer, setDefectBuffer, [
                { value: 0.1, label: "10%" },
                { value: 0.2, label: "20%" },
                { value: 0.3, label: "30%" },
              ], "Added to development effort for fixes, and to testing for re-tests.")}
            </>
          )}

          {/* Buttons */}
          <div className="flex gap-4 pt-6 border-t">
            <button
              type="button"
              onClick={step === 0 ? onCancel : () => { setError(""); setStep((s) => s - 1); }}
              disabled={loading}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-50"
            >
              {step === 0 ? "Cancel" : "← Back"}
            </button>
            {step < STEPS.length - 1 ? (
              <button
                key="next"
                type="button"
                onClick={next}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                Next: {STEPS[step + 1]} →
              </button>
            ) : (
              <button
                key="generate"
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Calculating...
                  </span>
                ) : (
                  "Generate Estimation"
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
