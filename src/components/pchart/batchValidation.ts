import { ColourBatchInput } from '@/types/pChart';

export interface BatchDraft {
  batchLabel: string;
  productionDate: string;
  samplesInspected: string;
  nonconforming: string;
}

export const inputClass =
  'rounded-md border border-border bg-white px-3 py-1.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';

function parseWholeNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

/** Mirrors the workbook's "CHECK INPUT" rules: n ≥ 1, 0 ≤ d ≤ n, whole numbers only. */
export function validateBatchDraft(
  draft: BatchDraft,
): { input: ColourBatchInput; error: null } | { input: null; error: string } {
  const batchLabel = draft.batchLabel.trim();
  if (!batchLabel) return { input: null, error: 'Enter a batch number.' };

  const n = parseWholeNumber(draft.samplesInspected);
  if (n === null || n < 1) {
    return { input: null, error: 'Samples inspected (n) must be a whole number of at least 1.' };
  }

  const d = parseWholeNumber(draft.nonconforming);
  if (d === null) {
    return { input: null, error: 'Samples outside the target colour (d) must be a whole number (0 or more).' };
  }
  if (d > n) {
    return {
      input: null,
      error: 'Samples outside the target colour (d) cannot be more than samples inspected (n).',
    };
  }

  return {
    input: {
      batchLabel,
      productionDate: draft.productionDate || null,
      samplesInspected: n,
      nonconforming: d,
    },
    error: null,
  };
}
