import {
  ArrayMaxSize,
  Equals,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidateIf,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import {
  ASSIGNABLE_CAUSES,
  EVIDENCE_TYPES,
  isKnownCause,
  REVIEW_OUTCOMES,
  type ReviewOutcome,
} from '../constants/assignable-causes.js';

@ValidatorConstraint({ name: 'exclusionNeedsConfirmedCause', async: false })
class ExclusionNeedsConfirmedCauseConstraint implements ValidatorConstraintInterface {
  validate(excluded: boolean, args: ValidationArguments): boolean {
    return !excluded || (args.object as ReviewSubgroupDto).outcome === 'confirmed';
  }

  defaultMessage(): string {
    return 'a subgroup may be excluded only when a specific assignable cause is confirmed';
  }
}

@ValidatorConstraint({ name: 'causesMatchCategory', async: false })
class CausesMatchCategoryConstraint implements ValidatorConstraintInterface {
  validate(causes: string[], args: ValidationArguments): boolean {
    const dto = args.object as ReviewSubgroupDto;
    if (!Array.isArray(causes)) return false;
    // "No assignable cause identified" records no cause: none is invented.
    if (dto.outcome === 'none') return causes.length === 0 && !dto.category;
    if (dto.excluded && causes.length === 0) return false;
    if (causes.length > 0 && !dto.category) return false;
    return causes.every((cause) => isKnownCause(dto.category ?? '', cause));
  }

  defaultMessage(): string {
    return 'causes must be listed under the chosen category; an exclusion needs at least one';
  }
}

@ValidatorConstraint({ name: 'evidenceForExclusion', async: false })
class EvidenceForExclusionConstraint implements ValidatorConstraintInterface {
  validate(evidence: string[], args: ValidationArguments): boolean {
    const dto = args.object as ReviewSubgroupDto;
    return Array.isArray(evidence) && (!dto.excluded || evidence.length > 0);
  }

  defaultMessage(): string {
    return 'an exclusion must record the evidence reviewed';
  }
}

/** Records the investigation of one subgroup's signal, and whether it excludes the subgroup. */
export class ReviewSubgroupDto {
  @IsIn(['x-bar', 'r'])
  chart!: 'x-bar' | 'r';

  @IsInt()
  @Min(1)
  @Max(8)
  rule!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  direction!: string;

  @IsNumber()
  value!: number;

  @IsIn(['ucl', 'cl', 'lcl'])
  limitType!: 'ucl' | 'cl' | 'lcl';

  @IsNumber()
  trialLimit!: number;

  @IsIn(REVIEW_OUTCOMES)
  outcome!: ReviewOutcome;

  /** Exclude the whole subgroup from the revised limits (true) or retain it (false). */
  @IsBoolean()
  @Validate(ExclusionNeedsConfirmedCauseConstraint)
  excluded!: boolean;

  @ValidateIf((o: ReviewSubgroupDto) => o.excluded || o.category != null)
  @IsIn(Object.keys(ASSIGNABLE_CAUSES))
  category?: string | null;

  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @Validate(CausesMatchCategoryConstraint)
  causes!: string[];

  @IsArray()
  @IsIn(EVIDENCE_TYPES, { each: true })
  @Validate(EvidenceForExclusionConstraint)
  evidence!: string[];

  @ValidateIf((o: ReviewSubgroupDto) => o.excluded || o.found != null)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  found?: string | null;

  @ValidateIf((o: ReviewSubgroupDto) => o.excluded || o.correctiveAction != null)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  correctiveAction?: string | null;

  /** Required when the subgroup is retained: how the condition will be followed up. */
  @ValidateIf((o: ReviewSubgroupDto) => !o.excluded || o.followUp != null)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  followUp?: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  reviewer!: string;

  @IsDateString()
  investigatedOn!: string;

  /** The reviewer's confirmation, required before a subgroup is excluded. */
  @ValidateIf((o: ReviewSubgroupDto) => o.excluded)
  @Equals(true)
  confirmed?: boolean;
}
