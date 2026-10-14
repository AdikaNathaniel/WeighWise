'use client';

import { ALL_RULES, RULE_DESCRIPTIONS, RuleId } from '@/lib/nelsonRules';

export function RuleToggles({
  enabled,
  onChange,
}: {
  enabled: RuleId[];
  onChange: (rule: RuleId, on: boolean) => void;
}) {
  return (
    <details className="rounded-lg border border-border bg-surface p-4">
      <summary className="cursor-pointer text-sm font-semibold text-foreground">
        Control chart rules ({enabled.length} of {ALL_RULES.length} on)
      </summary>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {ALL_RULES.map((rule) => (
          <label key={rule} className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={enabled.includes(rule)}
              onChange={(e) => onChange(rule, e.target.checked)}
            />
            <span>
              <span className="font-medium text-foreground">
                Rule {rule}: {RULE_DESCRIPTIONS[rule].title}
              </span>
              <span className="block text-xs text-muted">{RULE_DESCRIPTIONS[rule].detail}</span>
            </span>
          </label>
        ))}
      </div>
    </details>
  );
}
