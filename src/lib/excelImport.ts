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
  const dateCol = findColumn(headers, 'date');
  const weightCol = findColumn(headers, 'weight');

  if (!dateCol || !weightCol) {
    return {
      validGroups: [],
      invalidGroups: [],
      rowErrors: [
        {
          rowNumber: 0,
          reason: `Could not find both a date column and a weight column. Expected headers like "Production date" and "Weight (g)". Found: ${headers.join(', ')}`,
        },
      ],
    };
  }

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
    if (weights.length < MIN_N) {
      invalidGroups.push({
        productionDate,
        count: weights.length,
        rowNumbers,
        reason: `Only ${weights.length} weight(s) found — a subgroup needs at least ${MIN_N}.`,
      });
    } else if (weights.length > MAX_N) {
      invalidGroups.push({
        productionDate,
        count: weights.length,
        rowNumbers,
        reason: `${weights.length} weights found — a subgroup allows at most ${MAX_N}.`,
      });
    } else {
      validGroups.push({ productionDate, weights, rowNumbers });
    }
  }

  validGroups.sort((a, b) => a.productionDate.localeCompare(b.productionDate));
  invalidGroups.sort((a, b) => a.productionDate.localeCompare(b.productionDate));

  return { validGroups, invalidGroups, rowErrors };
}
