import { describe, expect, it } from 'vitest';
import { allocateSprints, describePlanningAnswers, sprintPlanningQuestions } from '@/lib/story-planning';
import { calculateEstimation } from '@/lib/estimation-calculator';
import type { TeamAnswers, TestingAnswers } from '@/lib/estimation-team';
import { buildEstimationGantt, ganttHtml } from '@/lib/estimation-gantt';

const story = (id: string, priority: string, storyPoints: number, dependsOn: string[] = []) => ({
  id,
  priority,
  storyPoints,
  dependsOn,
  title: id,
});

describe('allocateSprints', () => {
  it('fills sprints by priority without going over velocity, and puts the rest in the backlog', () => {
    const { stories, plan } = allocateSprints(
      [story('A', 'Nice-to-Have', 5), story('B', 'Must-Have', 5), story('C', 'Must-Have', 5), story('D', 'Should-Have', 5)],
      10,
      1,
      '2 weeks'
    );
    expect(stories.find((s) => s.id === 'B')!.sprint).toBe(1);
    expect(stories.find((s) => s.id === 'C')!.sprint).toBe(1);
    expect(plan.backlog).toEqual(['A', 'D']);
    expect(plan.sprints[0].points).toBe(10);
    expect(plan.sprintLengthWeeks).toBe(2);
  });

  it('never places a story before the story it depends on', () => {
    const { stories } = allocateSprints(
      [story('A', 'Should-Have', 8), story('B', 'Must-Have', 3, ['A'])],
      10,
      3
    );
    const a = stories.find((s) => s.id === 'A')!.sprint!;
    const b = stories.find((s) => s.id === 'B')!.sprint!;
    expect(b).toBeGreaterThanOrEqual(a);
  });

  it('survives dependency cycles and unknown ids', () => {
    const { plan } = allocateSprints(
      [story('A', 'Must-Have', 3, ['B']), story('B', 'Must-Have', 3, ['A', 'ZZZ'])],
      10,
      2
    );
    expect(plan.totalPoints).toBe(6);
  });

  it('describes answered questions for the prompt and skips empty ones', () => {
    const text = describePlanningAnswers({ velocity: 25, notes: '' }, sprintPlanningQuestions);
    expect(text).toContain('Answer: 25');
    expect(text).not.toContain('Anything else');
  });
});

const baseAnswers = {
  1: 'Mid-level (2-5 years)',
  2: 4,
  3: 40,
  4: 'Moderately Familiar',
  5: 'Standard Testing',
  6: 'Moderate (Realistic)',
  7: 'ASAP (Within estimation)',
};

const testing = (overrides: Partial<TestingAnswers> = {}): TestingAnswers => ({
  testers: { manual: { count: 1, seniority: 'Mid' } },
  testTypes: ['Functional'],
  automationCoverage: 0,
  testCycles: 1,
  approach: 'in-sprint',
  environment: 'ready',
  testData: 'available',
  defectBuffer: 0,
  ...overrides,
});

describe('calculateEstimation', () => {
  it('keeps the original formula when no team or testing answers are sent', () => {
    const r = calculateEstimation(10, baseAnswers);
    expect(r.baseEffort).toBe(80);
    expect(r.totalEffort).toBe(96); // 80 × 1.0 × 1.0 × 1.2 × 1.0
    expect(r.timeline).toBe(1);
    expect(r.breakdown.details).toBeUndefined();
  });

  it('splits development across the team and lets the slowest role set the pace', () => {
    const team: TeamAnswers = {
      workstreams: ['ui', 'backend'],
      roles: { ui: { count: 1, seniority: 'Mid' }, backend: { count: 1, seniority: 'Junior' } },
      support: {},
    };
    const r = calculateEstimation(20, { ...baseAnswers, team, testing: testing() }, { testScenarios: 10 });
    const d = r.breakdown.details!;
    // dev base = 20 × 8 = 160 h; UI gets 1.0/2.2, backend 1.2/2.2
    expect(d.devHours).toBe(Math.round((160 / 2.2) * 1.0 + (160 / 2.2) * 1.2 * 1.5));
    expect(d.devLoads[0].role).toBe('backend'); // junior backend is the bottleneck
    expect(r.teamSize).toBe(2);
    // 10 scenarios × 3 test cases: design 15 h + execution 7.5 h
    expect(d.testCases).toBe(30);
    expect(d.testingHours).toBe(23);
    expect(r.totalEffort).toBe(d.devHours + d.defectFixHours + d.testingHours + d.overheadHours);
  });

  it('uses a slower non-specialist and flags it when a specialist is missing', () => {
    const team: TeamAnswers = {
      workstreams: ['database'],
      roles: { backend: { count: 1, seniority: 'Mid' } },
      support: {},
    };
    const r = calculateEstimation(10, { ...baseAnswers, team, testing: testing() });
    const d = r.breakdown.details!;
    expect(d.devHours).toBe(100); // 80 h × 1.25
    expect(d.workstreams[0].fallback).toBe(true);
    expect(d.gaps.some((g) => g.severity === 'medium' && g.message.includes('Database developer'))).toBe(true);
  });

  it('flags testing that nobody on the team can do', () => {
    const team: TeamAnswers = { workstreams: ['backend'], roles: { backend: { count: 2, seniority: 'Senior' } }, support: {} };
    const r = calculateEstimation(10, {
      ...baseAnswers,
      team,
      testing: testing({ testTypes: ['Functional', 'Security', 'Performance / load'] }),
    });
    const d = r.breakdown.details!;
    expect(d.gaps.filter((g) => g.severity === 'high').length).toBeGreaterThanOrEqual(2);
    expect(d.testActivities.find((a) => a.activity === 'Security testing')!.owner).toBe('Not staffed');
    expect(r.confidence).toBeLessThan(75);
  });

  it('adds testing after development when testing is a separate phase', () => {
    const team: TeamAnswers = { workstreams: ['backend'], roles: { backend: { count: 1, seniority: 'Mid' } }, support: {} };
    const inSprint = calculateEstimation(20, { ...baseAnswers, team, testing: testing() }, { testScenarios: 40 });
    const after = calculateEstimation(20, { ...baseAnswers, team, testing: testing({ approach: 'after-dev' }) }, { testScenarios: 40 });
    expect(after.timeline).toBeGreaterThan(inSprint.timeline);
  });

  it('counts support roles by time and adds the budget', () => {
    const team: TeamAnswers = {
      workstreams: ['backend'],
      roles: { backend: { count: 1, seniority: 'Mid' } },
      support: { pm: { count: 1, seniority: 'Mid', involvement: 0.5 } },
    };
    const r = calculateEstimation(10, { ...baseAnswers, 8: 50, team, testing: testing() });
    const d = r.breakdown.details!;
    expect(d.overheadHours).toBe(1 * 40 * 0.5 * r.timeline);
    expect(r.totalBudget).toBe(r.totalEffort * 50);
  });
});

describe('buildEstimationGantt', () => {
  const team: TeamAnswers = {
    workstreams: ['ui', 'backend'],
    roles: { ui: { count: 1, seniority: 'Mid' }, backend: { count: 1, seniority: 'Mid' } },
    support: { pm: { count: 1, seniority: 'Mid', involvement: 0.5 } },
  };

  it('draws one bar per role, ends on the timeline, and puts end-phase testing after development', () => {
    const r = calculateEstimation(20, {
      ...baseAnswers,
      team,
      testing: testing({ testTypes: ['Functional', 'Security'], testers: { manual: { count: 1, seniority: 'Mid' }, security: { count: 1, seniority: 'Mid' } } }),
    }, { testScenarios: 20 });
    const g = buildEstimationGantt(r);
    expect(g.approximate).toBe(false);
    expect(g.rows.some((row) => row.id === 'dev-ui')).toBe(true);
    expect(g.rows.some((row) => row.id === 'dev-backend')).toBe(true);
    const endPhase = g.rows.find((row) => row.id === 'test-end-security')!;
    const devComplete = g.milestones.find((m) => m.label === 'Development complete')!.week;
    expect(endPhase.start).toBeGreaterThanOrEqual(devComplete);
    expect(Math.max(...g.rows.map((row) => row.end))).toBeCloseTo(r.timeline, 0);
    expect(g.rows.find((row) => row.group === 'Support')!.end).toBe(r.timeline);
    expect(ganttHtml(g)).toContain('Development complete');
  });

  it('starts testing after development when testing is a separate phase', () => {
    const r = calculateEstimation(20, { ...baseAnswers, team, testing: testing({ approach: 'after-dev' }) }, { testScenarios: 20 });
    const g = buildEstimationGantt(r);
    const devEnd = Math.max(...g.rows.filter((row) => row.group === 'Development').map((row) => row.end));
    expect(g.rows.find((row) => row.id === 'test-manual')!.start).toBe(devEnd);
  });

  it('gives older estimations an approximate phase split', () => {
    const g = buildEstimationGantt(calculateEstimation(10, baseAnswers));
    expect(g.approximate).toBe(true);
    expect(g.rows.map((row) => row.label)).toContain('Development');
  });
});

import { getProposedManDays } from '@/lib/estimation-calculator';
import { calculationNotes } from '@/lib/calculation-notes';

describe('getProposedManDays', () => {
  it('uses the quick formula until a detailed estimation exists', () => {
    expect(getProposedManDays(20)).toMatchObject({ devManDays: 16, qaManDays: 10, fromEstimation: false });
    expect(getProposedManDays(20, calculateEstimation(20, baseAnswers))).toMatchObject({ fromEstimation: false });
  });

  it('takes Dev and QA from the detailed estimation, and the notes show the same numbers', () => {
    const team: TeamAnswers = { workstreams: ['backend'], roles: { backend: { count: 1, seniority: 'Mid' } }, support: {} };
    const r = calculateEstimation(20, { ...baseAnswers, team, testing: testing({ defectBuffer: 0.2 }) }, { testScenarios: 10 });
    const d = r.breakdown.details!;
    const p = getProposedManDays(20, r);
    expect(p.fromEstimation).toBe(true);
    expect(p.devManDays).toBeCloseTo((d.devHours + d.defectFixHours) / 8);
    expect(p.qaManDays).toBeCloseTo(d.testingHours / 8);
    expect(calculationNotes.qa(20, r).lines.join(' ')).toContain(`${d.testingHours} h`);
    expect(calculationNotes.dev(20).lines[0]).toContain('20 × 0.8 = 16');
  });
});

import ExcelJS from 'exceljs';
import { buildTimelineWorkbook } from '@/lib/timeline-excel';
import { ganttColor } from '@/lib/estimation-gantt';

describe('buildTimelineWorkbook', () => {
  it('writes summary, a Gantt sheet with coloured week cells, and the detail sheets', async () => {
    const team: TeamAnswers = { workstreams: ['ui', 'backend'], roles: { ui: { count: 1, seniority: 'Mid' }, backend: { count: 1, seniority: 'Mid' } }, support: {} };
    const r = calculateEstimation(20, { ...baseAnswers, team, testing: testing() }, { testScenarios: 10 });
    const g = buildEstimationGantt(r);
    const buffer = await buildTimelineWorkbook({
      requirementTitle: 'File Transfer',
      complexityScore: 20,
      totalWeeks: r.timeline,
      totalDays: r.timeline * 5,
      devManDays: 10,
      qaManDays: 3,
      source: 'estimation',
      rows: g.rows.map((row) => ({ label: row.label, group: row.group, start: row.start, end: row.end, color: ganttColor(row.kind), note: row.note })),
      milestones: g.milestones,
      details: r.breakdown.details,
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    expect(wb.worksheets.map((s) => s.name)).toEqual(['Summary', 'Gantt Chart', 'Team Workload', 'Testing Activities', 'Gaps & Risks']);
    const sheet = wb.getWorksheet('Gantt Chart')!;
    expect(sheet.getRow(1).getCell(6).value).toBe('W1');
    const first = sheet.getRow(2);
    expect(first.getCell(1).value).toBe(g.rows[0].label);
    const fill = first.getCell(6).fill as ExcelJS.FillPattern;
    expect(fill.fgColor?.argb).toBe('FF' + ganttColor(g.rows[0].kind).slice(1).toUpperCase());
  });
});
