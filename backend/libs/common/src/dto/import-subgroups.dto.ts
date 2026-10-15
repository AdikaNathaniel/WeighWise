import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CreateSubgroupDto } from './create-subgroup.dto.js';

/** A spreadsheet upload: replaces the active subgroup set as one operation. */
export class ImportSubgroupsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => CreateSubgroupDto)
  subgroups!: CreateSubgroupDto[];
}
