'use client';

import { ALL_RULES, isInvestigated, RULE_DESCRIPTIONS, RuleId } from '@/lib/nelsonRules';

export function RuleToggles({
  enabled,
  onChange,
  note,
}: {
  enabled: RuleId[];
  onChange: (rule: RuleId, on: boolean) => void;
  note?: string;
}) {
  return (
    <details className="rounded-lg border border-border bg-surface p-4">
      <summary className="cursor-pointer text-sm font-semibold text-foreground">
        Control chart rules ({enabled.length} of {ALL_RULES.length} on)
      </summary>
      <p className="mt-2 text-xs text-muted">
        Only points above the UCL or below the LCL (rule 1) are investigated and decide whether
        the process is in control. The other rules show pattern warnings to watch.
      </p>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {ALL_RULES.map((rule) => (
          <label key={rule} className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={isInvestigated(rule) || enabled.includes(rule)}
              disabled={isInvestigated(rule)}
              onChange={(e) => onChange(rule, e.target.checked)}
            />
            <span>
              <span className="font-medium text-foreground">
                Rule {rule}: {RULE_DESCRIPTIONS[rule].title}
              </span>{' '}
              <span
                className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                  isInvestigated(rule) ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'
                }`}
              >
                {isInvestigated(rule) ? 'Investigate · always on' : 'Warning'}
              </span>
              <span className="block text-xs text-muted">{RULE_DESCRIPTIONS[rule].detail}</span>
            </span>
          </label>
        ))}
      </div>
      {note && <p className="mt-3 text-xs text-muted">{note}</p>}
    </details>
  );
}
