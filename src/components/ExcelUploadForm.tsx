'use client';

import { useState } from 'react';
import { importSubgroups } from '@/lib/api';
import { parseWorkbook, ParseResult } from '@/lib/excelImport';

type ImportOutcome = { imported: number; archived: number } | { error: string };

export function ExcelUploadForm({
  activeCount,
  onImported,
}: {
  /** Subgroups currently in use — they are archived when the upload is imported. */
  activeCount: number;
  onImported: () => void;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParseError(null);
    setOutcome(null);
    setParseResult(null);

    try {
      const buffer = await file.arrayBuffer();
      setParseResult(parseWorkbook(buffer));
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Could not read that file.');
    }
  }

  async function handleImport() {
    if (!parseResult) return;
    setImporting(true);
    // One request: the upload replaces the active set all-or-nothing.
    try {
      const result = await importSubgroups(
        parseResult.validGroups.map((group) => ({
          productionDate: group.productionDate,
          sampleSize: group.weights.length,
          weights: group.weights,
        })),
      );
      setOutcome({ imported: result.imported, archived: result.archived });
      setParseResult(null);
      onImported();
    } catch (err) {
      setOutcome({ error: err instanceof Error ? err.message : 'Import failed.' });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5 space-y-4 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground">Upload daily production records</h3>
      <p className="text-sm text-muted">
        Upload a .xlsx, .xls, or .csv file. Two layouts are supported:{' '}
        <strong>Production date</strong> + <strong>Weight (g)</strong> with one row per package
        (rows sharing a date are grouped into one subgroup), or <strong>Production date</strong> +{' '}
        <strong>Sample 1 (g)</strong>, <strong>Sample 2 (g)</strong>, etc. with one row per
        subgroup — the SPC template layout. Either way, subgroups need 2–10 packages.
      </p>
      <p className="rounded-md border border-border bg-primary-soft px-3 py-2 text-sm text-primary-hover">
        An upload <strong>replaces</strong> the subgroups used for the charts and calculations
        {activeCount > 0 ? ` (currently ${activeCount})` : ''}. Earlier subgroups are kept under{' '}
        <strong>Records → Previous uploads</strong>, where they can be viewed or used again.
      </p>

      <input
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileChange}
        className="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-primary-hover"
      />
      {fileName && <p className="text-xs text-muted">Selected: {fileName}</p>}

      {parseError && <p className="text-sm text-red-600">{parseError}</p>}

      {parseResult && (
        <div className="space-y-3">
          {parseResult.rowErrors.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 space-y-1">
              {parseResult.rowErrors.map((e, i) => (
                <p key={i}>
                  {e.rowNumber ? `Row ${e.rowNumber}: ` : ''}
                  {e.reason}
                </p>
              ))}
            </div>
          )}

          {(parseResult.validGroups.length > 0 || parseResult.invalidGroups.length > 0) && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="py-1 pr-4">Date</th>
                    <th className="py-1 pr-4">Packages</th>
                    <th className="py-1">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parseResult.validGroups.map((g) => (
                    <tr key={g.productionDate} className="border-t border-border">
                      <td className="py-1 pr-4">{g.productionDate}</td>
                      <td className="py-1 pr-4">{g.weights.length}</td>
                      <td className="py-1 text-green-700">Ready</td>
                    </tr>
                  ))}
                  {parseResult.invalidGroups.map((g) => (
                    <tr key={g.productionDate} className="border-t border-border">
                      <td className="py-1 pr-4">{g.productionDate}</td>
                      <td className="py-1 pr-4">{g.count}</td>
                      <td className="py-1 text-red-600" title={g.reason}>
                        Skipped — {g.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {parseResult.validGroups.length > 0 && (
            <button
              type="button"
              onClick={handleImport}
              disabled={importing}
              className="rounded-md bg-primary text-white px-4 py-2 text-sm font-medium transition hover:bg-primary-hover disabled:opacity-50"
            >
              {importing
                ? 'Importing…'
                : `Import ${parseResult.validGroups.length} subgroup${
                    parseResult.validGroups.length === 1 ? '' : 's'
                  }${activeCount > 0 ? ` and replace the current ${activeCount}` : ''}`}
            </button>
          )}
        </div>
      )}

      {outcome && (
        <div className="rounded-md border border-border p-3 text-sm">
          {'error' in outcome ? (
            <p className="text-red-600">
              Import failed — nothing was changed. {outcome.error}
            </p>
          ) : (
            <p className="font-medium">
              {outcome.imported} subgroup{outcome.imported === 1 ? '' : 's'} imported and now in
              use.
              {outcome.archived > 0 &&
                ` The previous ${outcome.archived} moved to Records → Previous uploads.`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
