import * as XLSX from 'xlsx';

const MIN_N = 2;
const MAX_N = 10;

export interface SubgroupGroup {
  productionDate: string;
  weights: number[];
  rowNumbers: number[];
}

export interface InvalidGroup {
  productionDate: string;
  count: number;
  rowNumbers: number[];
  reason: string;
}

export interface RowError {
  rowNumber: number;
  reason: string;
}

export interface ParseResult {
  validGroups: SubgroupGroup[];
  invalidGroups: InvalidGroup[];
  rowErrors: RowError[];
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

function findColumn(headers: string[], keyword: string): string | undefined {
  return headers.find((h) => normalizeHeader(h).includes(keyword));
}

// The SPC template's date column is "Production date", but it also carries a
// derived "Date label" column (for chart axes) that would otherwise match a
// naive "contains date" search first.
function findDateColumn(headers: string[]): string | undefined {
  const normalized = headers.map((h) => ({ header: h, norm: normalizeHeader(h) }));
  const production = normalized.find(
    ({ norm }) => norm.includes('production') && norm.includes('date'),
  );
  if (production) return production.header;

  const exact = normalized.find(({ norm }) => norm === 'date');
  if (exact) return exact.header;

  const fallback = normalized.find(({ norm }) => norm.includes('date') && !norm.includes('label'));
  return fallback?.header;
}

// Matches "Sample 1", "Sample 2 (g)", etc — the per-package weight columns in
// the wide/template layout (one row per subgroup) — sorted by sample number.
function findSampleColumns(headers: string[]): string[] {
  return headers
    .filter((h) => /^sample\s*\d+/i.test(h.trim()))
    .sort((a, b) => {
      const na = Number(a.match(/\d+/)?.[0] ?? 0);
      const nb = Number(b.match(/\d+/)?.[0] ?? 0);
      return na - nb;
    });
}

function toIsoDate(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)).toISOString().slice(0, 10);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
  }

  return null;
}

function toWeight(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function isEmptyCell(value: unknown): boolean {
  return value === '' || value === undefined || value === null;
}

function classifyGroup(
  productionDate: string,
  weights: number[],
  rowNumbers: number[],
): { validGroup?: SubgroupGroup; invalidGroup?: InvalidGroup } {
  if (weights.length < MIN_N) {
    return {
      invalidGroup: {
        productionDate,
        count: weights.length,
        rowNumbers,
        reason: `Only ${weights.length} weight(s) found — a subgroup needs at least ${MIN_N}.`,
      },
    };
  }

  if (weights.length > MAX_N) {
    return {
      invalidGroup: {
        productionDate,
        count: weights.length,
        rowNumbers,
        reason: `${weights.length} weights found — a subgroup allows at most ${MAX_N}.`,
      },
    };
  }

  return { validGroup: { productionDate, weights, rowNumbers } };
}

// Wide/template layout: one row is already one subgroup, with a fixed set of
// "Sample N" weight columns (unused sample slots left blank) plus derived
// columns (Mean, Range, X-bar/R control limits, Date label) that are ignored.
function parseWideRows(
  rows: Record<string, unknown>[],
  dateCol: string,
  sampleCols: string[],
): ParseResult {
  const rowErrors: RowError[] = [];
  const validGroups: SubgroupGroup[] = [];
  const invalidGroups: InvalidGroup[] = [];

  rows.forEach((row, idx) => {
    const rowNumber = idx + 2;
    const rawDate = row[dateCol];
    const rawWeights = sampleCols.map((c) => row[c]);

    if (isEmptyCell(rawDate) && rawWeights.every(isEmptyCell)) return;

    const iso = toIsoDate(rawDate);
    if (!iso) {
      rowErrors.push({ rowNumber, reason: `Unrecognized date value "${String(rawDate)}".` });
      return;
    }

    const weights: number[] = [];
    for (const raw of rawWeights) {
      if (isEmptyCell(raw)) continue; // unused sample slot for this subgroup
      const weight = toWeight(raw);
      if (weight === null) {
        rowErrors.push({ rowNumber, reason: `Unrecognized weight value "${String(raw)}".` });
        return;
      }
      weights.push(weight);
    }

    const { validGroup, invalidGroup } = classifyGroup(iso, weights, [rowNumber]);
    if (validGroup) validGroups.push(validGroup);
    if (invalidGroup) invalidGroups.push(invalidGroup);
  });

  validGroups.sort((a, b) => a.productionDate.localeCompare(b.productionDate));
  invalidGroups.sort((a, b) => a.productionDate.localeCompare(b.productionDate));

  return { validGroups, invalidGroups, rowErrors };
}

// Long/flat layout: one row per package weight, with rows sharing a date
// grouped into a single subgroup.
function parseLongRows(
  rows: Record<string, unknown>[],
  dateCol: string,
  weightCol: string,
): ParseResult {
  const rowErrors: RowError[] = [];
  const groups = new Map<string, { weights: number[]; rowNumbers: number[] }>();

  rows.forEach((row, idx) => {
    const rowNumber = idx + 2; // +1 for header row, +1 for 1-based indexing
    const rawDate = row[dateCol];
    const rawWeight = row[weightCol];

    if (isEmptyCell(rawDate) && isEmptyCell(rawWeight)) return;

    const iso = toIsoDate(rawDate);
    if (!iso) {
      rowErrors.push({ rowNumber, reason: `Unrecognized date value "${String(rawDate)}".` });
      return;
    }

    const weight = toWeight(rawWeight);
    if (weight === null) {
      rowErrors.push({ rowNumber, reason: `Unrecognized weight value "${String(rawWeight)}".` });
      return;
    }

    const entry = groups.get(iso) ?? { weights: [], rowNumbers: [] };
    entry.weights.push(weight);
    entry.rowNumbers.push(rowNumber);
    groups.set(iso, entry);
  });

  const validGroups: SubgroupGroup[] = [];
  const invalidGroups: InvalidGroup[] = [];

  for (const [productionDate, { weights, rowNumbers }] of groups) {
    const { validGroup, invalidGroup } = classifyGroup(productionDate, weights, rowNumbers);
    if (validGroup) validGroups.push(validGroup);
    if (invalidGroup) invalidGroups.push(invalidGroup);
  }

  validGroups.sort((a, b) => a.productionDate.localeCompare(b.productionDate));
  invalidGroups.sort((a, b) => a.productionDate.localeCompare(b.productionDate));

  return { validGroups, invalidGroups, rowErrors };
}

export function parseWorkbook(buffer: ArrayBuffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  if (rows.length === 0) {
    return {
      validGroups: [],
      invalidGroups: [],
      rowErrors: [{ rowNumber: 0, reason: 'The sheet has no data rows.' }],
    };
  }

  const headers = Object.keys(rows[0]);
  const dateCol = findDateColumn(headers);
  const sampleCols = findSampleColumns(headers);
  const weightCol = sampleCols.length === 0 ? findColumn(headers, 'weight') : undefined;

  if (!dateCol || (sampleCols.length === 0 && !weightCol)) {
    return {
      validGroups: [],
      invalidGroups: [],
      rowErrors: [
        {
          rowNumber: 0,
          reason: `Could not find a production date column and either a "Weight (g)" column or numbered "Sample N (g)" columns. Expected headers like "Production date" plus "Weight (g)", or "Production date" plus "Sample 1 (g)", "Sample 2 (g)", etc. Found: ${headers.join(', ')}`,
        },
      ],
    };
  }

  return sampleCols.length > 0
    ? parseWideRows(rows, dateCol, sampleCols)
    : parseLongRows(rows, dateCol, weightCol!);
}
