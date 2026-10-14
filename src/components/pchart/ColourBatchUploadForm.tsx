'use client';

import { useState } from 'react';
import { createColourBatch } from '@/lib/api';
import { ColourParseResult, parseColourWorkbook } from '@/lib/colourBatchImport';
import { formatBatchDate } from '@/lib/pChartFormat';

type ImportOutcome = { batchLabel: string; success: boolean; error?: string };

export function ColourBatchUploadForm({
  existingLabels,
  onImported,
}: {
  existingLabels: string[];
  onImported: () => void;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ColourParseResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [outcomes, setOutcomes] = useState<ImportOutcome[] | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParseError(null);
    setOutcomes(null);
    setParseResult(null);

    try {
      setParseResult(parseColourWorkbook(await file.arrayBuffer(), existingLabels));
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Could not read that file.');
    }
  }

  async function handleImport() {
    if (!parseResult) return;
    setImporting(true);
    const results: ImportOutcome[] = [];

    // Sequential so batches keep the spreadsheet's entry order for same-day batches.
    for (const { input } of parseResult.batches) {
      try {
        await createColourBatch(input);
        results.push({ batchLabel: input.batchLabel, success: true });
      } catch (err) {
        results.push({
          batchLabel: input.batchLabel,
          success: false,
          error: err instanceof Error ? err.message : 'Import failed.',
        });
      }
    }

    setOutcomes(results);
    setParseResult(null);
    setImporting(false);
    if (results.some((r) => r.success)) onImported();
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5 space-y-4 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground">Upload colour batches</h3>
      <p className="text-sm text-muted">
        Upload the Tom Brown colour p-chart calculator (.xlsx), or any .xlsx/.csv with the
        columns <strong>Batch No.</strong>, <strong>Production Date</strong>,{' '}
        <strong>Samples Inspected (n)</strong> and <strong>Outside Light-Brown Range (d)</strong>.
        Only n and d are read — p, σ, the limits and status are recalculated. Batches already
        recorded are skipped.
      </p>

      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileChange}
        className="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-primary-hover"
      />
      {fileName && <p className="text-xs text-muted">Selected: {fileName}</p>}

      {parseError && <p className="text-sm text-red-600">{parseError}</p>}
      {parseResult?.error && <p className="text-sm text-red-600">{parseResult.error}</p>}

      {parseResult && !parseResult.error && (
        <div className="space-y-3">
          {parseResult.batches.length === 0 && parseResult.skipped.length === 0 && (
            <p className="text-sm text-muted">No batch rows with data were found.</p>
          )}

          {(parseResult.batches.length > 0 || parseResult.skipped.length > 0) && (
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="py-1 pr-4">Row</th>
                    <th className="py-1 pr-4">Batch</th>
                    <th className="py-1 pr-4">Date</th>
                    <th className="py-1 pr-4">n</th>
                    <th className="py-1 pr-4">d</th>
                    <th className="py-1">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parseResult.batches.map(({ rowNumber, input }) => (
                    <tr key={`ok-${rowNumber}`} className="border-t border-border">
                      <td className="py-1 pr-4 text-muted">{rowNumber}</td>
                      <td className="py-1 pr-4">{input.batchLabel}</td>
                      <td className="py-1 pr-4">{formatBatchDate(input.productionDate)}</td>
                      <td className="py-1 pr-4">{input.samplesInspected}</td>
                      <td className="py-1 pr-4">{input.nonconforming}</td>
                      <td className="py-1 text-green-700">Ready</td>
                    </tr>
                  ))}
                  {parseResult.skipped.map((s) => (
                    <tr key={`skip-${s.rowNumber}`} className="border-t border-border">
                      <td className="py-1 pr-4 text-muted">{s.rowNumber}</td>
                      <td className="py-1 pr-4">{s.batchLabel}</td>
                      <td colSpan={4} className="py-1 text-red-600">
                        Skipped — {s.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {parseResult.batches.length > 0 && (
            <button
              type="button"
              onClick={handleImport}
              disabled={importing}
              className="rounded-md bg-primary text-white px-4 py-2 text-sm font-medium transition hover:bg-primary-hover disabled:opacity-50"
            >
              {importing
                ? 'Importing…'
                : `Import ${parseResult.batches.length} batch${
                    parseResult.batches.length === 1 ? '' : 'es'
                  }`}
            </button>
          )}
        </div>
      )}

      {outcomes && (
        <div className="rounded-md border border-border p-3 text-sm space-y-1">
          <p className="font-medium">
            {outcomes.filter((o) => o.success).length} of {outcomes.length} batches imported.
          </p>
          {outcomes
            .filter((o) => !o.success)
            .map((o, i) => (
              <p key={i} className="text-red-600">
                Batch {o.batchLabel}: {o.error}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
