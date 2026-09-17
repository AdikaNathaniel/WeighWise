import { Inject, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { CreateSubgroupDto, Subgroup, UpdateSubgroupDto } from '@app/common';
import { SUPABASE_CLIENT } from './supabase.provider.js';

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
  samples?: SampleRow[];
}

@Injectable()
export class IngestionService {
  constructor(@Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient) {}

  async createSubgroup(dto: CreateSubgroupDto): Promise<Subgroup> {
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
      .select('id, production_date, sample_size, mean, range, created_at, samples(sample_index, weight_g)')
      .order('production_date', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return ((data ?? []) as SubgroupRow[]).map((row) => {
      const weights = (row.samples ?? [])
        .slice()
        .sort((a, b) => a.sample_index - b.sample_index)
        .map((s) => Number(s.weight_g));
      return this.toSubgroup(row, weights);
    });
  }

  async updateSubgroup(id: string, dto: UpdateSubgroupDto): Promise<Subgroup> {
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

  private toSubgroup(row: SubgroupRow, weights: number[]): Subgroup {
    return {
      id: row.id,
      productionDate: row.production_date,
      sampleSize: row.sample_size,
      weights,
      mean: Number(row.mean),
      range: Number(row.range),
      createdAt: row.created_at,
    };
  }
}
