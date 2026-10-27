/**
 * Assignable causes from the cause-and-effect (fishbone) diagram for
 * underweight Tom Brown packages, grouped by 6M category. A review must name
 * one of these causes, or "Other" with the details in what was found.
 * Keep in sync with backend/libs/common/src/constants/assignable-causes.ts.
 */
export const ASSIGNABLE_CAUSES = {
  Man: [
    'Operator has not been trained in weighing',
    'Filling quantity is estimated by judgement',
    'Weight is not checked before stapling',
  ],
  Machine: [
    'Scale divisions cannot accurately show the 495–505 g range',
    'Scale displays pounds and ounces',
    'No controlled filling equipment',
  ],
  Method: [
    'Scoop quantity varies between packages',
    'Folding and stapling reduce usable package quantity',
    'No standard filling and weighing procedure',
  ],
  Material: [
    'Inadequate sachet size for the target weight',
    'Sachet capacity does not allow enough closing space',
  ],
  Measurement: [
    'No acceptable weight range is used',
    'Individual packages are not weighed',
    'Package weights are not recorded or reviewed',
  ],
  Environment: [
    'Powder loss from uncontrolled airflow',
    'Air in powder reduces weight per scoop',
    'Trapped air reduces usable sachet capacity',
  ],
} as const satisfies Record<string, readonly string[]>;

export type AssignableCauseCategory = keyof typeof ASSIGNABLE_CAUSES | 'Other';

/** Cause recorded when the finding is not on the diagram (category "Other"). */
export const OTHER_CAUSE = 'Other (described in findings)';

export function isKnownCause(category: string, cause: string): boolean {
  if (category === 'Other') return cause === OTHER_CAUSE;
  const causes = (ASSIGNABLE_CAUSES as Record<string, readonly string[]>)[category];
  return Boolean(causes?.includes(cause));
}
