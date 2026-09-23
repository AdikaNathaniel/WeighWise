import * as XLSX from 'xlsx';
import { PChartData } from '@/types/pChart';

export const TARGET_COLOUR = 'Light brown';

export const INVESTIGATE_MESSAGE =
  'Investigate this batch for possible changes in roasting time, temperature, stirring, raw materials or other processing conditions.';

/** Formats a fraction (0–1) as a percentage, e.g. 0.2179 → "21.79%". */
export function formatPercent(fraction: number | null | undefined, digits = 2): string {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) return '—';
  return `${(fraction * 100).toFixed(digits)}%`;
}

/**
 * Production dates are plain calendar dates ("YYYY-MM-DD"). Parsing them with
 * `new Date(iso)` treats them as UTC midnight, which shows the previous day in
 * timezones west of UTC — so build a local date from the parts instead.
 */
export function formatBatchDate(isoDate: string | null): string {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function statusLabel(status: string): string {
  return status === 'out-of-control' ? 'OUT OF CONTROL' : 'IN CONTROL';
}

const TABLE_HEADERS = [
  'Batch No.',
  'Production Date',
  'Samples Inspected (n)',
  'Outside Light-Brown Range (d)',
  'Conforming (n-d)',
  'Proportion Nonconforming (p)',
  'Standard Deviation (σp)',
  'Centre Line (p̄)',
  'UCL',
  'LCL',
  'Batch Status',
  'Action',
];

function fileStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Excel export: the batch table with proportions stored as real percentages, plus a summary sheet. */
export function exportPChartXlsx(data: PChartData): void {
  const PCT_COLUMNS = [5, 6, 7, 8, 9];

  const rows = data.points.map((p) => [
    p.batchLabel,
    p.productionDate ?? '',
    p.samplesInspected,
    p.nonconforming,
    p.conforming,
    p.proportion,
    p.sigma,
    p.cl,
    p.ucl,
    p.lcl,
    statusLabel(p.status),
    p.status === 'out-of-control' ? INVESTIGATE_MESSAGE : '',
  ]);

  const tableSheet = XLSX.utils.aoa_to_sheet([TABLE_HEADERS, ...rows]);
  rows.forEach((_, r) => {
    for (const c of PCT_COLUMNS) {
      const cell = tableSheet[XLSX.utils.encode_cell({ r: r + 1, c })];
      if (cell) cell.z = '0.00%';
    }
  });
  tableSheet['!cols'] = TABLE_HEADERS.map((_, i) => ({ wch: i === 11 ? 60 : 16 }));

  const s = data.summary;
  const summarySheet = XLSX.utils.aoa_to_sheet([
    ['Tom Brown Colour p-Chart — Summary'],
    ['Target colour', TARGET_COLOUR],
    ['Total batches', s.totalBatches],
    ['Total samples inspected', s.totalSamples],
    ['Total nonconforming', s.totalNonconforming],
    ['Overall proportion nonconforming (p̄)', s.overallProportion ?? ''],
    ['Out-of-control batches', s.outOfControlCount],
    ['Overall status', s.isStable ? 'NO POINTS OUTSIDE LIMITS' : 'INVESTIGATE PROCESS'],
    ['Control-limit basis', '3-sigma'],
    ['Exported', new Date().toLocaleString()],
  ]);
  if (summarySheet['B6'] && typeof summarySheet['B6'].v === 'number') summarySheet['B6'].z = '0.00%';
  summarySheet['!cols'] = [{ wch: 38 }, { wch: 28 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');
  XLSX.utils.book_append_sheet(wb, tableSheet, 'Colour P-Chart');
  XLSX.writeFile(wb, `tom-brown-colour-p-chart-${fileStamp()}.xlsx`);
}

/** CSV export with proportions written as percentage text. */
export function exportPChartCsv(data: PChartData): void {
  const escape = (v: string | number) => {
    const str = String(v);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const lines = [
    TABLE_HEADERS,
    ...data.points.map((p) => [
      p.batchLabel,
      p.productionDate ?? '',
      p.samplesInspected,
      p.nonconforming,
      p.conforming,
      formatPercent(p.proportion),
      formatPercent(p.sigma),
      formatPercent(p.cl),
      formatPercent(p.ucl),
      formatPercent(p.lcl),
      statusLabel(p.status),
      p.status === 'out-of-control' ? INVESTIGATE_MESSAGE : '',
    ]),
  ].map((row) => row.map(escape).join(','));

  // BOM so Excel opens the σ / p̄ headers as UTF-8.
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tom-brown-colour-p-chart-${fileStamp()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
