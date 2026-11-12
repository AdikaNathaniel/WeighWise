'use client';

import { formatBatchDate } from '@/lib/pChartFormat';
import {
  ChartStage,
  currentStageGuidance,
  excludedSummary,
  StageAction,
  stageBadge,
  stageTitle,
  Workflow,
} from '@/lib/reviewWorkflow';
import { ControlChart } from './ControlChart';
import { RuleSignalList, SignalPointInfo } from './RuleSignalList';
import { StatusBadge } from './StatusBadge';
import { SummaryPanel } from './SummaryPanel';

const ACTION_LABELS: Record<StageAction, string> = {
  'review-r': 'Investigate R-chart signals',
  'review-x-bar': 'Investigate X-bar signals',
  monitor: 'Continue monitoring process',
};

function subtitle(stage: ChartStage): string {
  if (stage.kind === 'trial') return `${stage.summary.subgroupCount} production subgroups included`;
  return `${stage.summary.subgroupCount} retained subgroups · ${excludedSummary(stage.excludedNumbers)}`;
}

/**
 * The chart sequence: chart 1 (trial, every subgroup), chart 2 (after the
 * R-chart investigation) and chart 3 (after the X-bar investigation). Each
 * stage keeps its own limits, so earlier stages can be compared with the
 * current one; excluded subgroups keep their numbers and appear as grey X marks.
 */
export function ChartStages({
  workflow,
  selected,
  onSelect,
  onAction,
}: {
  workflow: Workflow;
  selected: number;
  onSelect: (index: number) => void;
  onAction: (action: StageAction) => void;
}) {
  const index = Math.min(selected, workflow.stages.length - 1);
  const stage = workflow.stages[index];
  const isCurrent = stage === workflow.current;
  const badge = stageBadge(stage, workflow.phase);
  const guidance = isCurrent ? currentStageGuidance(workflow) : null;
  // Signal indices count retained subgroups only; label each by its original number.
  const labels = (analysis: ChartStage['xBar']): SignalPointInfo[] => {
    const numbers = new Map(analysis.chartData.map((p) => [p.subgroupId, p.number]));
    return analysis.subgroups.map((s) => ({
      label: `Subgroup ${numbers.get(s.id)} (${formatBatchDate(s.productionDate)})`,
    }));
  };

  return (
    <div className="space-y-4">
      {workflow.stages.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Chart sequence">
          {workflow.stages.map((s, i) => (
            <button
              key={s.kind}
              type="button"
              role="tab"
              aria-selected={i === index}
              onClick={() => onSelect(i)}
              className={`rounded-md px-4 py-2 text-left text-sm transition ${
                i === index
                  ? 'bg-primary text-white'
                  : 'border border-border bg-surface text-muted hover:text-foreground'
              }`}
            >
              <span className="font-semibold">Chart {i + 1}</span>
              <span className="block text-xs opacity-80">
                {s.summary.subgroupCount} subgroups{s === workflow.current ? ' · current' : ''}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-foreground">
            Chart {index + 1} · {stageTitle(stage, workflow)}
          </h3>
          <p className="text-sm font-medium text-muted">{subtitle(stage)}</p>
        </div>
        <StatusBadge
          inControl={stage.rInControl && stage.xBarInControl}
          label={badge}
        />
      </div>

      <SummaryPanel summary={stage.summary} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ControlChart title="X-bar chart — subgroup mean" unit="g" data={stage.xBar.chartData} />
        <ControlChart title="R chart — subgroup range" unit="g" data={stage.r.chartData} />
      </div>

      {guidance && (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-amber-900">{guidance.text}</p>
          <button
            type="button"
            onClick={() => onAction(guidance.action)}
            className="shrink-0 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            {ACTION_LABELS[guidance.action]}
          </button>
        </div>
      )}
      {!isCurrent && (
        <p className="rounded-md border border-border bg-surface px-4 py-2 text-sm text-muted">
          An earlier stage of the revision, kept for comparison. The investigation continues on
          chart {workflow.stages.length}.
        </p>
      )}

      <div className="rounded-lg border border-border bg-surface p-4">
        <h3 className="text-sm font-semibold mb-3">Nelson rule signals — chart {index + 1}</h3>
        <RuleSignalList
          pointHeading="Subgroups flagged"
          groups={[
            { chart: 'X-bar', signals: stage.xBar.signals, points: labels(stage.xBar) },
            { chart: 'R', signals: stage.r.signals, points: labels(stage.r) },
          ]}
        />
      </div>
    </div>
  );
}
