// Story Planning: the sprint/project questions asked before user stories are
// generated, and the code that places stories into sprints by velocity.

export interface PlanningQuestion {
  id: string;
  question: string;
  type: "single" | "multi" | "number" | "text";
  options?: string[];
  default?: string | string[] | number;
  helpText?: string;
  min?: number;
  max?: number;
  unit?: string;
}

export type PlanningAnswers = Record<string, string | string[] | number>;

// Fixed questions about how the team works. Requirement-specific questions
// come from the AI (see /api/generate-story-questions).
export const sprintPlanningQuestions: PlanningQuestion[] = [
  {
    id: "sprintLength",
    question: "How long is each sprint?",
    type: "single",
    options: ["1 week", "2 weeks", "3 weeks", "4 weeks"],
    default: "2 weeks",
  },
  {
    id: "velocity",
    question: "Team velocity: how many story points does the team finish per sprint?",
    type: "number",
    min: 5,
    max: 200,
    default: 30,
    unit: "points / sprint",
    helpText: "Use your last 2-3 sprints' average. A new team of 4-5 developers usually manages 20-30.",
  },
  {
    id: "sprintCount",
    question: "How many sprints are planned for this release?",
    type: "number",
    min: 1,
    max: 26,
    default: 4,
    unit: "sprints",
    helpText: "Stories that do not fit go to the backlog.",
  },
  {
    id: "releaseGoal",
    question: "What is the goal of this release?",
    type: "single",
    options: [
      "MVP: only the core flow end to end",
      "Full feature set described in the requirement",
      "Pilot with one or two customers",
      "Enhancement of an existing system",
    ],
    default: "MVP: only the core flow end to end",
  },
  {
    id: "storyTypes",
    question: "Which kinds of stories should be included?",
    type: "multi",
    options: [
      "Functional (user-facing features)",
      "Non-functional (performance, security, availability)",
      "Technical / enabler (setup, infrastructure, CI/CD)",
      "Spikes (research where details are unclear)",
      "Integration with external systems",
      "Reporting / dashboard",
    ],
    default: ["Functional (user-facing features)", "Non-functional (performance, security, availability)", "Integration with external systems"],
  },
  {
    id: "storySize",
    question: "How big should a single story be?",
    type: "single",
    options: [
      "Small: 1-3 points, finishes in a few days",
      "Medium: up to 5 points",
      "Large: up to 8 points (split anything bigger)",
    ],
    default: "Medium: up to 5 points",
  },
  {
    id: "acceptanceStyle",
    question: "How should acceptance criteria be written?",
    type: "single",
    options: ["Given / When / Then (Gherkin)", "Simple checklist"],
    default: "Given / When / Then (Gherkin)",
  },
  {
    id: "notes",
    question: "Anything else the agent should know? (team constraints, must-have features, things to leave out)",
    type: "text",
    default: "",
  },
];

export interface PlannedStory {
  id: string;
  priority: string;
  storyPoints: number;
  dependsOn?: string[];
  sprint?: number | null;
  [key: string]: unknown;
}

export interface SprintPlan {
  sprintLengthWeeks: number;
  velocity: number;
  sprintCount: number;
  sprints: Array<{ sprint: number; storyIds: string[]; points: number }>;
  backlog: string[];
  backlogPoints: number;
  totalPoints: number;
}

const PRIORITY_ORDER: Record<string, number> = { "Must-Have": 0, "Should-Have": 1, "Nice-to-Have": 2 };

export function sprintLengthWeeks(answer: unknown): number {
  const match = String(answer ?? "").match(/(\d+)/);
  return match ? Math.min(Math.max(parseInt(match[1], 10), 1), 4) : 2;
}

// Places stories into sprints: higher priority first, a story never goes before
// the stories it depends on, and a sprint never exceeds the team's velocity.
// Stories that do not fit in the planned sprints go to the backlog.
export function allocateSprints<T extends PlannedStory>(
  stories: T[],
  velocityInput: number,
  sprintCountInput: number,
  sprintLengthAnswer?: unknown
): { stories: Array<T & { sprint: number | null }>; plan: SprintPlan } {
  const velocity = Math.max(1, Math.round(velocityInput || 30));
  const sprintCount = Math.max(1, Math.round(sprintCountInput || 4));
  const ids = new Set(stories.map((s) => s.id));

  const ordered = stories
    .map((s, index) => ({ s, index }))
    .sort(
      (a, b) =>
        (PRIORITY_ORDER[a.s.priority] ?? 1) - (PRIORITY_ORDER[b.s.priority] ?? 1) || a.index - b.index
    )
    .map(({ s }) => s);

  const load = new Array<number>(sprintCount + 1).fill(0);
  const sprintOf = new Map<string, number | null>();

  // Resolve dependencies first so a dependent story is placed after its prerequisites
  const placing = new Set<string>();
  const place = (story: T): number | null => {
    if (sprintOf.has(story.id)) return sprintOf.get(story.id)!;
    if (placing.has(story.id)) return null; // dependency cycle: ignore the link
    placing.add(story.id);

    let earliest = 1;
    for (const dep of story.dependsOn || []) {
      if (!ids.has(dep) || dep === story.id) continue;
      const depStory = stories.find((s) => s.id === dep)!;
      const depSprint = place(depStory);
      if (depSprint === null) {
        earliest = Infinity; // prerequisite is in the backlog, so this one is too
      } else {
        earliest = Math.max(earliest, depSprint);
      }
    }

    let assigned: number | null = null;
    const points = Math.max(0, Number(story.storyPoints) || 0);
    for (let sprint = earliest; sprint <= sprintCount; sprint++) {
      // An oversized story still gets an empty sprint of its own
      if (load[sprint] + points <= velocity || (load[sprint] === 0 && points > velocity)) {
        load[sprint] += points;
        assigned = sprint;
        break;
      }
    }
    placing.delete(story.id);
    sprintOf.set(story.id, assigned);
    return assigned;
  };

  ordered.forEach(place);

  const result = stories.map((s) => ({ ...s, sprint: sprintOf.get(s.id) ?? null }));
  const sprints = Array.from({ length: sprintCount }, (_, i) => {
    const sprint = i + 1;
    const inSprint = result.filter((s) => s.sprint === sprint);
    return {
      sprint,
      storyIds: inSprint.map((s) => s.id),
      points: inSprint.reduce((sum, s) => sum + (Number(s.storyPoints) || 0), 0),
    };
  });
  const backlogStories = result.filter((s) => s.sprint === null);

  return {
    stories: result,
    plan: {
      sprintLengthWeeks: sprintLengthWeeks(sprintLengthAnswer),
      velocity,
      sprintCount,
      sprints,
      backlog: backlogStories.map((s) => s.id),
      backlogPoints: backlogStories.reduce((sum, s) => sum + (Number(s.storyPoints) || 0), 0),
      totalPoints: result.reduce((sum, s) => sum + (Number(s.storyPoints) || 0), 0),
    },
  };
}

// Turns the answers into readable lines for the AI prompt.
export function describePlanningAnswers(
  answers: PlanningAnswers,
  questions: Array<{ id: string; question: string }>
): string {
  return questions
    .map((q) => {
      const value = answers[q.id];
      if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) return null;
      return `- ${q.question}\n  Answer: ${Array.isArray(value) ? value.join("; ") : value}`;
    })
    .filter(Boolean)
    .join("\n");
}
