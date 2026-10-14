import * as XLSX from 'xlsx';
import type { ColourBatchInput } from '@/types/pChart';

/**
 * Reads Tom Brown colour batches from a spreadsheet. Accepts the
 * Tom_Brown_Colour_P_Chart_Calculator template (title rows above the header
 * row, a TOTAL row below the batches) and the app's own Excel/CSV export.
 * Only the raw inputs — batch no., date, n and d — are read; the calculated
 * columns (p, σ, limits, status) are ignored because the app recalculates them.
 */

export interface ParsedBatch {
  rowNumber: number;
  input: ColourBatchInput;
}

export interface SkippedRow {
  rowNumber: number;
  batchLabel: string;
  reason: string;
}

export interface ColourParseResult {
  sheetName: string | null;
  batches: ParsedBatch[];
  skipped: SkippedRow[];
  /** Problems with the file as a whole (no header row found etc.). */
  error: string | null;
}

interface Columns {
  batch: number;
  date: number | null;
  n: number;
  d: number;
}

function norm(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function findColumns(row: unknown[]): Columns | null {
  const headers = row.map(norm);
  const find = (...tests: ((h: string) => boolean)[]) => {
    for (const test of tests) {
      const i = headers.findIndex(test);
      if (i >= 0) return i;
    }
    return -1;
  };

  const batch = find((h) => h.includes('batch') && !h.includes('status'));
  const n = find((h) => h.includes('inspected'), (h) => h.includes('(n)'));
  const d = find(
    (h) => h.includes('outside'),
    (h) => h.includes('(d)'),
    (h) => h === 'nonconforming' || h === 'defectives',
  );
  const date = find((h) => h.includes('date'));

  if (batch < 0 || n < 0 || d < 0) return null;
  return { batch, date: date >= 0 ? date : null, n, d };
}

function isEmpty(value: unknown): boolean {
  return value === '' || value === null || value === undefined;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Converts an Excel serial number or a date string to "YYYY-MM-DD" without timezone shifts. */
function toIsoDate(value: unknown): string | null {
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? `${parsed.y}-${pad(parsed.m)}-${pad(parsed.d)}` : null;
  }
  const text = String(value ?? '').trim();
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${pad(Number(iso[2]))}-${pad(Number(iso[3]))}`;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
}

function toWholeNumber(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  return Number.isInteger(num) ? num : null;
}

function batchLabelOf(value: unknown): string {
  // Excel stores "1" as the number 1; keep labels as plain text.
  return typeof value === 'number' ? String(value) : String(value ?? '').trim();
}

export function parseColourWorkbook(
  buffer: ArrayBuffer,
  existingLabels: Iterable<string> = [],
): ColourParseResult {
  const workbook = XLSX.read(buffer, { type: 'array' });

  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1,
      raw: true,
      defval: '',
    });

    const headerIndex = rows.findIndex((row) => findColumns(row) !== null);
    if (headerIndex < 0) continue;
    const cols = findColumns(rows[headerIndex])!;

    const seen = new Set([...existingLabels].map((l) => l.trim()));
    const batches: ParsedBatch[] = [];
    const skipped: SkippedRow[] = [];

    for (let i = headerIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 1;
      const label = batchLabelOf(row[cols.batch]);
      const rawN = row[cols.n];
      const rawD = row[cols.d];

      // Totals row ends the batch table; guidance text below it is not data.
      if (/^total/i.test(label)) break;
      // Template rows waiting for data (batch no. pre-filled, counts blank).
      if (isEmpty(rawN) && isEmpty(rawD)) continue;

      const skip = (reason: string) => skipped.push({ rowNumber, batchLabel: label || '—', reason });

      if (!label) {
        skip('Missing batch number.');
        continue;
      }
      const n = toWholeNumber(rawN);
      const d = toWholeNumber(rawD);
      if (n === null || n < 1) {
        skip(`Samples inspected (n) must be a whole number of at least 1 — found "${String(rawN)}".`);
        continue;
      }
      if (d === null || d < 0) {
        skip(`Outside light-brown range (d) must be a whole number (0 or more) — found "${String(rawD)}".`);
        continue;
      }
      if (d > n) {
        skip(`d (${d}) cannot be more than n (${n}).`);
        continue;
      }

      let productionDate: string | null = null;
      const rawDate = cols.date === null ? '' : row[cols.date];
      if (!isEmpty(rawDate)) {
        productionDate = toIsoDate(rawDate);
        if (!productionDate) {
          skip(`Unrecognised production date "${String(rawDate)}".`);
          continue;
        }
      }

      if (seen.has(label)) {
        skip(`Batch ${label} is already recorded.`);
        continue;
      }
      seen.add(label);

      batches.push({
        rowNumber,
        input: { batchLabel: label, productionDate, samplesInspected: n, nonconforming: d },
      });
    }

    return { sheetName, batches, skipped, error: null };
  }

  return {
    sheetName: null,
    batches: [],
    skipped: [],
    error:
      'Could not find the batch table. Expected a header row with "Batch No.", "Production Date", "Samples Inspected (n)" and "Outside Light-Brown Range (d)".',
  };
}
