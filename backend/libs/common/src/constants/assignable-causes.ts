/**
 * Assignable causes for the Tom Brown filling and packaging operation, per
 * the Review Signal design guide: five primary categories, each with the
 * specific causes that can be selected (several may apply). A general process
 * weakness is not a cause — only a specific event affecting the batch.
 * Keep in sync with src/lib/assignableCauses.ts in the frontend.
 */
export const ASSIGNABLE_CAUSES = {
  'Filling method': [
    'Scoop size or scoop count varied within the batch',
    'Product was added based on visual judgement',
    'Product was removed to allow the package to be sealed',
    'Standard filling procedure was not followed',
    'Filling occurred without routine weight verification',
  ],
  'Personnel and workload': [
    'An additional or temporary operator joined',
    'An operator was unfamiliar with the procedure',
    'An urgent order caused rushing',
    'Packaging continued overnight',
    'Fatigue affected filling',
  ],
  'Weighing and measurement': [
    'Packages were not weighed',
    'The scale was not tared',
    'Final weight was not verified',
    'The pounds and ounces display made the gram target difficult to interpret',
    'Weights were not recorded',
  ],
  'Packaging and sealing': [
    'The sachet had insufficient sealing space',
    'Product was removed before sealing',
    'A different or smaller sachet was used',
    'The agreed sealing method was not followed',
  ],
  'Other confirmed cause': ['Another confirmed batch-specific event (described in the findings)'],
} as const satisfies Record<string, readonly string[]>;

export type AssignableCauseCategory = keyof typeof ASSIGNABLE_CAUSES;

/** What the investigation reviewed before reaching its outcome. */
export const EVIDENCE_TYPES = [
  'Discussion with processor',
  'Direct observation',
  'Production record',
  'Scale examination',
  'Package examination',
  'Other evidence',
] as const;

export const REVIEW_OUTCOMES = ['confirmed', 'possible', 'none'] as const;
export type ReviewOutcome = (typeof REVIEW_OUTCOMES)[number];

export function isKnownCause(category: string, cause: string): boolean {
  const causes = (ASSIGNABLE_CAUSES as Record<string, readonly string[]>)[category];
  return Boolean(causes?.includes(cause));
}
