import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { CreateSubgroupDto } from './create-subgroup.dto.js';

@ValidatorConstraint({ name: 'sameSubgroupSize', async: false })
class SameSubgroupSizeConstraint implements ValidatorConstraintInterface {
  validate(subgroups: CreateSubgroupDto[]): boolean {
    return Array.isArray(subgroups) && new Set(subgroups.map((s) => s?.sampleSize)).size <= 1;
  }

  defaultMessage(): string {
    return 'every subgroup on a chart must have the same sample size';
  }
}

/** A spreadsheet upload: replaces the active subgroup set as one operation. */
export class ImportSubgroupsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => CreateSubgroupDto)
  @Validate(SameSubgroupSizeConstraint)
  subgroups!: CreateSubgroupDto[];
}
