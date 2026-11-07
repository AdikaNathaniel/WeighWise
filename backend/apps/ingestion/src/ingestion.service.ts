import { Inject, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  ClearColourBatchesResult,
  ClearedColourBatch,
  ColourBatch,
  CreateColourBatchDto,
  CreateSubgroupDto,
  ArchivedSubgroupSet,
  ImportSubgroupsResult,
  PaginatedSubgroups,
  RestoreColourBatchesResult,
  RestoreSubgroupsResult,
  ReviewSubgroupDto,
  Subgroup,
  SubgroupReview,
  UpdateColourBatchDto,
  UpdateSubgroupDto,
} from '@app/common';
import { SUPABASE_CLIENT } from './supabase.provider.js';

const MAX_PAGE_SIZE = 100;

interface SampleRow {
  sample_index: number;
  weight_g: number;
}

interface SubgroupRow {
  id: string;
  production_date: string;
  sample_size: number;
  mean: number;
  range: number;
  created_at: string;
  archived_at?: string | null;
  samples?: SampleRow[];
}

const SUBGROUP_COLUMNS =
  'id, production_date, sample_size, mean, range, created_at, archived_at, samples(sample_index, weight_g)';

interface ReviewRow {
  id: string;
  subgroup_id: string;
  chart: 'x-bar' | 'r';
  rule: number;
  direction: string;
  value: number;
  limit_type: 'ucl' | 'cl' | 'lcl';
  trial_limit: number;
  outcome: SubgroupReview['outcome'];
  excluded: boolean;
  category: string | null;
  cause: string | null;
  causes: string[] | null;
  evidence: string[] | null;
  found: string | null;
  corrective_action: string | null;
  follow_up: string | null;
  reviewer: string | null;
  investigated_on: string;
  created_at: string;
}

const REVIEW_COLUMNS =
  'id, subgroup_id, chart, rule, direction, value, limit_type, trial_limit, outcome, excluded, category, cause, causes, evidence, found, corrective_action, follow_up, reviewer, investigated_on, created_at';

interface ColourBatchRow {
  id: string;
  batch_label: string;
  production_date: string | null;
  samples_inspected: number;
  nonconforming: number;
  created_at: string;
  cleared_at?: string | null;
}

const COLOUR_BATCH_COLUMNS =
  'id, batch_label, production_date, samples_inspected, nonconforming, created_at, cleared_at';

@Injectable()
export class IngestionService {
  constructor(@Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient) {}

  async createSubgroup(dto: CreateSubgroupDto): Promise<Subgroup> {
    await this.assertConsistentSampleSize(dto.sampleSize);
    const mean = dto.weights.reduce((sum, w) => sum + w, 0) / dto.weights.length;
    const range = Math.max(...dto.weights) - Math.min(...dto.weights);

    const { data: subgroup, error: subgroupError } = await this.supabase
      .from('subgroups')
      .insert({
        production_date: dto.productionDate,
        sample_size: dto.sampleSize,
        mean,
        range,
      })
      .select()
      .single();

    if (subgroupError) {
      throw new Error(subgroupError.message);
    }

    const sampleRows = dto.weights.map((weight, index) => ({
      subgroup_id: subgroup.id,
      sample_index: index + 1,
      weight_g: weight,
    }));

    const { error: samplesError } = await this.supabase.from('samples').insert(sampleRows);
    if (samplesError) {
      await this.supabase.from('subgroups').delete().eq('id', subgroup.id);
      throw new Error(samplesError.message);
    }

    return this.toSubgroup({ ...(subgroup as SubgroupRow) }, dto.weights);
  }

  async listSubgroups(): Promise<Subgroup[]> {
    const { data, error } = await this.supabase
      .from('subgroups')
      .select(SUBGROUP_COLUMNS)
      .is('archived_at', null)
      .order('production_date', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const subgroups = ((data ?? []) as SubgroupRow[]).map((row) => {
      const weights = (row.samples ?? [])
        .slice()
        .sort((a, b) => a.sample_index - b.sample_index)
        .map((s) => Number(s.weight_g));
      return this.toSubgroup(row, weights);
    });
    return this.attachReviews(subgroups);
  }

  async listSubgroupsPage(page: number, pageSize: number): Promise<PaginatedSubgroups> {
    const safePage = Math.max(1, Math.trunc(page) || 1);
    const safePageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(pageSize) || 20));
    const from = (safePage - 1) * safePageSize;
    const to = from + safePageSize - 1;

    const { data, error, count } = await this.supabase
      .from('subgroups')
      .select(SUBGROUP_COLUMNS, { count: 'exact' })
      .is('archived_at', null)
      .order('production_date', { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    const subgroups = ((data ?? []) as SubgroupRow[]).map((row) => {
      const weights = (row.samples ?? [])
        .slice()
        .sort((a, b) => a.sample_index - b.sample_index)
        .map((s) => Number(s.weight_g));
      return this.toSubgroup(row, weights);
    });

    return {
      subgroups: await this.attachReviews(subgroups),
      total: count ?? 0,
      page: safePage,
      pageSize: safePageSize,
    };
  }

  async updateSubgroup(id: string, dto: UpdateSubgroupDto): Promise<Subgroup> {
    await this.assertConsistentSampleSize(dto.sampleSize, id);
    const mean = dto.weights.reduce((sum, w) => sum + w, 0) / dto.weights.length;
    const range = Math.max(...dto.weights) - Math.min(...dto.weights);

    const { data: subgroup, error: subgroupError } = await this.supabase
      .from('subgroups')
      .update({
        production_date: dto.productionDate,
        sample_size: dto.sampleSize,
        mean,
        range,
      })
      .eq('id', id)
      .select()
      .single();

    if (subgroupError) {
      throw new Error(subgroupError.message);
    }

    const { error: deleteSamplesError } = await this.supabase
      .from('samples')
      .delete()
      .eq('subgroup_id', id);
    if (deleteSamplesError) {
      throw new Error(deleteSamplesError.message);
    }

    const sampleRows = dto.weights.map((weight, index) => ({
      subgroup_id: id,
      sample_index: index + 1,
      weight_g: weight,
    }));

    const { error: samplesError } = await this.supabase.from('samples').insert(sampleRows);
    if (samplesError) {
      throw new Error(samplesError.message);
    }

    return this.toSubgroup({ ...(subgroup as SubgroupRow) }, dto.weights);
  }

  async deleteSubgroup(id: string): Promise<{ id: string }> {
    const { error } = await this.supabase.from('subgroups').delete().eq('id', id);
    if (error) {
      throw new Error(error.message);
    }
    return { id };
  }

  /**
   * Replaces the active subgroup set with an uploaded spreadsheet. The new
   * subgroups are first written hidden (archived under a staging timestamp);
   * only once every row is stored are the current subgroups archived and the
   * new ones made active, so a failed upload never leaves a partial set.
   */
  async importSubgroups(dtos: CreateSubgroupDto[]): Promise<ImportSubgroupsResult> {
    const stagingAt = new Date().toISOString();

    const { data: inserted, error: insertError } = await this.supabase
      .from('subgroups')
      .insert(
        dtos.map((dto) => ({
          production_date: dto.productionDate,
          sample_size: dto.sampleSize,
          mean: dto.weights.reduce((sum, w) => sum + w, 0) / dto.weights.length,
          range: Math.max(...dto.weights) - Math.min(...dto.weights),
          archived_at: stagingAt,
        })),
      )
      .select('id');
    if (insertError) {
      throw new Error(insertError.message);
    }

    const ids = (inserted ?? []).map((row: { id: string }) => row.id);
    const sampleRows = dtos.flatMap((dto, i) =>
      dto.weights.map((weight, index) => ({
        subgroup_id: ids[i],
        sample_index: index + 1,
        weight_g: weight,
      })),
    );
    const { error: samplesError } = await this.supabase.from('samples').insert(sampleRows);
    if (samplesError) {
      // Samples cascade-delete with their subgroup.
      await this.supabase.from('subgroups').delete().in('id', ids);
      throw new Error(samplesError.message);
    }

    const archivedAt = new Date(Math.max(Date.now(), Date.parse(stagingAt) + 1)).toISOString();
    const archived = await this.archiveActiveSubgroups(archivedAt);

    const { error: activateError } = await this.supabase
      .from('subgroups')
      .update({ archived_at: null })
      .in('id', ids);
    if (activateError) {
      throw new Error(activateError.message);
    }

    return { imported: ids.length, archived, archivedAt: archived > 0 ? archivedAt : null };
  }

  /** Archived subgroup sets, most recently archived first. */
  async listArchivedSubgroups(): Promise<ArchivedSubgroupSet[]> {
    const { data, error } = await this.supabase
      .from('subgroups')
      .select(SUBGROUP_COLUMNS)
      .not('archived_at', 'is', null)
      .order('archived_at', { ascending: false })
      .order('production_date', { ascending: true });
    if (error) {
      throw new Error(error.message);
    }

    const sets = new Map<number, ArchivedSubgroupSet>();
    for (const row of (data ?? []) as SubgroupRow[]) {
      const key = Date.parse(row.archived_at as string);
      const set = sets.get(key) ?? { archivedAt: row.archived_at as string, subgroups: [] };
      set.subgroups.push(this.toSubgroup(row, this.sortedWeights(row)));
      sets.set(key, set);
    }
    return [...sets.values()];
  }

  /**
   * Makes an archived set the active one again. The subgroups active at the
   * time are archived first, so only one set ever feeds the charts.
   */
  async restoreSubgroups(archivedAt: string): Promise<RestoreSubgroupsResult> {
    const target = (await this.listArchivedSubgroups()).find(
      (set) => Date.parse(set.archivedAt) === Date.parse(archivedAt),
    );
    if (!target) {
      throw new Error(`No archived subgroups found for ${archivedAt}.`);
    }

    const archived = await this.archiveActiveSubgroups(new Date().toISOString());
    const { error } = await this.supabase
      .from('subgroups')
      .update({ archived_at: null })
      .in(
        'id',
        target.subgroups.map((s) => s.id),
      );
    if (error) {
      throw new Error(error.message);
    }
    return { restored: target.subgroups.length, archived };
  }

  /**
   * Records the investigation of a subgroup's signal. A confirmed, evidenced
   * cause may exclude the whole subgroup from the revised limits; any other
   * outcome retains it. The subgroup's own data are left untouched.
   */
  async reviewSubgroup(id: string, dto: ReviewSubgroupDto): Promise<SubgroupReview> {
    const text = (value?: string | null) => value?.trim() || null;
    const found = text(dto.found);
    const correctiveAction = text(dto.correctiveAction);
    const followUp = text(dto.followUp);
    if (dto.excluded && (dto.outcome !== 'confirmed' || !found || !correctiveAction)) {
      throw new Error(
        'A subgroup can be excluded only for a confirmed cause with findings and a corrective action.',
      );
    }
    if (!dto.excluded && !followUp) {
      throw new Error('A follow-up action is required when the subgroup is retained.');
    }

    const { data: subgroup, error: subgroupError } = await this.supabase
      .from('subgroups')
      .select('id')
      .eq('id', id)
      .is('archived_at', null)
      .maybeSingle();
    if (subgroupError) {
      throw new Error(subgroupError.message);
    }
    if (!subgroup) {
      throw new Error(`No active subgroup found with id ${id}.`);
    }

    const { data, error } = await this.supabase
      .from('subgroup_exclusions')
      .insert({
        subgroup_id: id,
        chart: dto.chart,
        rule: dto.rule,
        direction: dto.direction,
        value: dto.value,
        limit_type: dto.limitType,
        trial_limit: dto.trialLimit,
        outcome: dto.outcome,
        excluded: dto.excluded,
        category: dto.outcome === 'none' ? null : (dto.category ?? null),
        causes: dto.outcome === 'none' ? [] : dto.causes,
        evidence: dto.evidence,
        found,
        corrective_action: correctiveAction,
        follow_up: followUp,
        reviewer: dto.reviewer.trim(),
        investigated_on: dto.investigatedOn.slice(0, 10),
      })
      .select(REVIEW_COLUMNS)
      .single();
    if (error) {
      // The partial unique index allows one active review per subgroup.
      if (error.code === '23505') {
        throw new Error('This subgroup has already been reviewed. Reopen its review to change it.');
      }
      throw new Error(error.message);
    }
    return this.toReview(data as ReviewRow);
  }

  /**
   * Reopens a subgroup's review: an excluded subgroup counts toward the limits
   * again and its signal can be investigated afresh. The review is kept as history.
   */
  async reopenReview(id: string): Promise<{ id: string; reopened: number }> {
    const { data, error } = await this.supabase
      .from('subgroup_exclusions')
      .update({ reverted_at: new Date().toISOString() })
      .eq('subgroup_id', id)
      .is('reverted_at', null)
      .select('id');
    if (error) {
      throw new Error(error.message);
    }
    return { id, reopened: (data ?? []).length };
  }

  private async attachReviews(subgroups: Subgroup[]): Promise<Subgroup[]> {
    if (subgroups.length === 0) return subgroups;
    // Active reviews are few, so fetch them all rather than filter by a long id list.
    const { data, error } = await this.supabase
      .from('subgroup_exclusions')
      .select(REVIEW_COLUMNS)
      .is('reverted_at', null);
    if (error) {
      throw new Error(error.message);
    }
    const bySubgroup = new Map(
      ((data ?? []) as ReviewRow[]).map((row) => [row.subgroup_id, this.toReview(row)]),
    );
    return subgroups.map((s) => {
      const review = bySubgroup.get(s.id) ?? null;
      return { ...s, review, exclusion: review?.excluded ? review : null };
    });
  }

  private toReview(row: ReviewRow): SubgroupReview {
    // Reviews recorded before several causes could be chosen hold a single cause.
    const causes = row.causes?.length ? row.causes : row.cause ? [row.cause] : [];
    return {
      id: row.id,
      chart: row.chart,
      rule: Number(row.rule),
      direction: row.direction,
      value: Number(row.value),
      limitType: row.limit_type,
      trialLimit: Number(row.trial_limit),
      outcome: row.outcome,
      excluded: row.excluded,
      category: row.category,
      causes,
      evidence: row.evidence ?? [],
      found: row.found,
      correctiveAction: row.corrective_action,
      followUp: row.follow_up,
      reviewer: row.reviewer,
      investigatedOn: row.investigated_on,
      createdAt: row.created_at,
    };
  }

  /** Every active subgroup feeds one chart, so they must all share one sample size. */
  private async assertConsistentSampleSize(sampleSize: number, ignoreId?: string): Promise<void> {
    let query = this.supabase
      .from('subgroups')
      .select('sample_size')
      .is('archived_at', null)
      .neq('sample_size', sampleSize)
      .limit(1);
    if (ignoreId) query = query.neq('id', ignoreId);
    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }
    const other = (data ?? [])[0] as { sample_size: number } | undefined;
    if (other) {
      throw new Error(
        `Every subgroup on the chart must have the same sample size: the recorded subgroups have n = ${other.sample_size}, this one has n = ${sampleSize}.`,
      );
    }
  }

  private async archiveActiveSubgroups(archivedAt: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('subgroups')
      .update({ archived_at: archivedAt })
      .is('archived_at', null)
      .select('id');
    if (error) {
      throw new Error(error.message);
    }
    return (data ?? []).length;
  }

  private sortedWeights(row: SubgroupRow): number[] {
    return (row.samples ?? [])
      .slice()
      .sort((a, b) => a.sample_index - b.sample_index)
      .map((s) => Number(s.weight_g));
  }

  async createColourBatch(dto: CreateColourBatchDto): Promise<ColourBatch> {
    const { data, error } = await this.supabase
      .from('colour_batches')
      .insert(this.toColourBatchRow(dto))
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }
    return this.toColourBatch(data as ColourBatchRow);
  }

  /**
   * Batches are returned in production order (date, then entry time) so the
   * p-chart plots them as a time sequence. Undated batches follow in the
   * order they were entered.
   */
  async listColourBatches(): Promise<ColourBatch[]> {
    const { data, error } = await this.supabase
      .from('colour_batches')
      .select(COLOUR_BATCH_COLUMNS)
      .is('cleared_at', null)
      .order('production_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }
    return ((data ?? []) as ColourBatchRow[]).map((row) => this.toColourBatch(row));
  }

  async updateColourBatch(id: string, dto: UpdateColourBatchDto): Promise<ColourBatch> {
    const { data, error } = await this.supabase
      .from('colour_batches')
      .update(this.toColourBatchRow(dto))
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }
    return this.toColourBatch(data as ColourBatchRow);
  }

  async deleteColourBatch(id: string): Promise<{ id: string }> {
    const { error } = await this.supabase.from('colour_batches').delete().eq('id', id);
    if (error) {
      throw new Error(error.message);
    }
    return { id };
  }

  /**
   * Archives every active batch under one shared timestamp. Nothing is
   * deleted, so the clear can be listed and restored later.
   */
  async clearColourBatches(): Promise<ClearColourBatchesResult> {
    const clearedAt = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('colour_batches')
      .update({ cleared_at: clearedAt })
      .is('cleared_at', null)
      .select('id');

    if (error) {
      throw new Error(error.message);
    }
    const cleared = (data ?? []).length;
    return { cleared, clearedAt: cleared > 0 ? clearedAt : null };
  }

  /** Cleared batches, most recent clear first, each clear in production order. */
  async listClearedColourBatches(): Promise<ClearedColourBatch[]> {
    const { data, error } = await this.supabase
      .from('colour_batches')
      .select(COLOUR_BATCH_COLUMNS)
      .not('cleared_at', 'is', null)
      .order('cleared_at', { ascending: false })
      .order('production_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }
    return ((data ?? []) as ColourBatchRow[]).map((row) => ({
      ...this.toColourBatch(row),
      clearedAt: row.cleared_at as string,
    }));
  }

  /**
   * Restores the batches from one clear (the most recent when `clearedAt` is
   * omitted). A cleared batch whose label is now used by an active batch is
   * left archived so the chart never shows the same batch number twice.
   */
  async restoreColourBatches(clearedAt?: string): Promise<RestoreColourBatchesResult> {
    const cleared = await this.listClearedColourBatches();
    const targetTime = clearedAt ? Date.parse(clearedAt) : Date.parse(cleared[0]?.clearedAt ?? '');
    const target = cleared.filter((b) => Date.parse(b.clearedAt) === targetTime);
    if (target.length === 0) {
      return { restored: 0, skippedLabels: [] };
    }

    const activeLabels = new Set((await this.listColourBatches()).map((b) => b.batchLabel));
    const toRestore = target.filter((b) => !activeLabels.has(b.batchLabel));
    const skippedLabels = target
      .filter((b) => activeLabels.has(b.batchLabel))
      .map((b) => b.batchLabel);

    if (toRestore.length > 0) {
      const { error } = await this.supabase
        .from('colour_batches')
        .update({ cleared_at: null })
        .in(
          'id',
          toRestore.map((b) => b.id),
        );
      if (error) {
        throw new Error(error.message);
      }
    }
    return { restored: toRestore.length, skippedLabels };
  }

  private toColourBatchRow(dto: CreateColourBatchDto) {
    return {
      batch_label: dto.batchLabel.trim(),
      production_date: dto.productionDate || null,
      samples_inspected: dto.samplesInspected,
      nonconforming: dto.nonconforming,
    };
  }

  private toColourBatch(row: ColourBatchRow): ColourBatch {
    return {
      id: row.id,
      batchLabel: row.batch_label,
      productionDate: row.production_date,
      samplesInspected: Number(row.samples_inspected),
      nonconforming: Number(row.nonconforming),
      createdAt: row.created_at,
    };
  }

  private toSubgroup(row: SubgroupRow, weights: number[]): Subgroup {
    return {
      id: row.id,
      productionDate: row.production_date,
      sampleSize: row.sample_size,
      weights,
      mean: Number(row.mean),
      range: Number(row.range),
      createdAt: row.created_at,
      review: null,
      exclusion: null,
    };
  }
}
