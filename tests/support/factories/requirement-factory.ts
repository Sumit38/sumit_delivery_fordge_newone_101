import { faker } from '@faker-js/faker';

/**
 * Requirements to analyse. Defaults are realistic and unique per call, so
 * parallel tests never collide.
 */

export type RequirementInput = {
  title: string;
  requirementText: string;
};

/** Minimum length the app accepts (FR-4). */
export const MIN_REQUIREMENT_CHARS = 50;
/** Size above which the analyser truncates (FR-5). */
export const TRUNCATION_THRESHOLD_BYTES = 80 * 1024;

export function createRequirement(overrides: Partial<RequirementInput> = {}): RequirementInput {
  const feature = faker.commerce.productName();
  return {
    title: `test-${faker.string.alphanumeric(8)} ${feature}`,
    requirementText: [
      `As a store manager I want to schedule ${feature} promotions so that stock moves before expiry.`,
      `The user opens the scheduler, searches for a product, adds it to a bin and sets start and end dates.`,
      `A manager must approve schedules over ${faker.number.int({ min: 5, max: 50 })} items. Rejected schedules return to draft.`,
      `Users can copy, paste, resize and undo schedule blocks. Conflicting schedules show a warning.`,
    ].join(' '),
    ...overrides,
  };
}

/** A requirement of exactly `chars` characters, for the length and truncation boundaries. */
export function createRequirementOfLength(chars: number, overrides: Partial<RequirementInput> = {}): RequirementInput {
  const base = createRequirement(overrides).requirementText;
  const text = base.repeat(Math.ceil(chars / base.length)).slice(0, chars);
  return createRequirement({ ...overrides, requirementText: text });
}
