import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ImportSubgroupsDto } from './import-subgroups.dto.js';
import { CreateSubgroupDto } from './create-subgroup.dto.js';
import { ReviewSubgroupDto } from './review-subgroup.dto.js';

const signal = {
  chart: 'r',
  rule: 1,
  direction: 'above',
  value: 92.88,
  limitType: 'ucl',
  trialLimit: 88.37,
  reviewer: 'Processor',
  investigatedOn: '2026-11-07',
};

const confirmedExclusion = {
  ...signal,
  outcome: 'confirmed',
  excluded: true,
  category: 'Filling method',
  causes: ['Scoop size or scoop count varied within the batch'],
  evidence: ['Discussion with processor', 'Scale examination'],
  found: 'Contents were adjusted visually and the scoop count varied.',
  correctiveAction: 'Standardise scoop use and verify weights.',
  followUp: null,
  confirmed: true,
};

function failures(plain: object): string[] {
  const errors = validateSync(plainToInstance(ReviewSubgroupDto, plain), { whitelist: true });
  return errors.map((e) => e.property);
}

describe('ReviewSubgroupDto — exclusion rules', () => {
  it('accepts a confirmed, evidenced exclusion', () => {
    expect(failures(confirmedExclusion)).toEqual([]);
  });

  it('refuses to exclude when the cause is only possible', () => {
    expect(failures({ ...confirmedExclusion, outcome: 'possible' })).toContain('excluded');
  });

  it('refuses an exclusion without the confirmation, evidence or a specific cause', () => {
    expect(failures({ ...confirmedExclusion, confirmed: false })).toContain('confirmed');
    expect(failures({ ...confirmedExclusion, evidence: [] })).toContain('evidence');
    expect(failures({ ...confirmedExclusion, causes: [] })).toContain('causes');
    expect(failures({ ...confirmedExclusion, found: null })).toContain('found');
  });

  it('only accepts causes listed under the chosen category', () => {
    expect(failures({ ...confirmedExclusion, category: 'Packaging and sealing' })).toContain('causes');
    expect(failures({ ...confirmedExclusion, category: 'Machine' })).toContain('category');
  });

  it('retains a possible cause with a follow-up action and no confirmation', () => {
    const retained = {
      ...signal,
      outcome: 'possible',
      excluded: false,
      category: 'Personnel and workload',
      causes: ['An urgent order caused rushing'],
      evidence: [],
      found: null,
      correctiveAction: null,
      followUp: 'Monitor the same condition in future batches.',
    };
    expect(failures(retained)).toEqual([]);
    expect(failures({ ...retained, followUp: null })).toContain('followUp');
  });

  it('records "no assignable cause" without inventing one', () => {
    const none = {
      ...signal,
      outcome: 'none',
      excluded: false,
      category: null,
      causes: [],
      evidence: ['Production record'],
      found: null,
      correctiveAction: null,
      followUp: 'Improve production records.',
    };
    expect(failures(none)).toEqual([]);
    expect(failures({ ...none, causes: ['Packages were not weighed'] })).toContain('causes');
  });

  it('requires the reviewer', () => {
    expect(failures({ ...confirmedExclusion, reviewer: '' })).toContain('reviewer');
  });
});

describe('subgroup data validation', () => {
  const subgroup = (weights: number[]) => ({ productionDate: '2026-11-07', sampleSize: weights.length, weights });

  it('refuses a weight of zero or less', () => {
    const errors = validateSync(plainToInstance(CreateSubgroupDto, subgroup([500, 0, 498, 501])));
    expect(errors.map((e) => e.property)).toContain('weights');
  });

  it('refuses an upload whose subgroups differ in size', () => {
    const mixed = { subgroups: [subgroup([500, 502, 498, 501]), subgroup([500, 502, 498])] };
    const errors = validateSync(plainToInstance(ImportSubgroupsDto, mixed));
    expect(errors.map((e) => e.property)).toContain('subgroups');
  });
});
