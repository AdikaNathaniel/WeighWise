import {
  Equals,
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
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { isKnownCause } from '../constants/assignable-causes.js';

@ValidatorConstraint({ name: 'knownAssignableCause', async: false })
class KnownAssignableCauseConstraint implements ValidatorConstraintInterface {
  validate(cause: string, args: ValidationArguments): boolean {
    const dto = args.object as ExcludeSubgroupDto;
    return typeof cause === 'string' && isKnownCause(dto.category, cause);
  }

  defaultMessage(): string {
    return 'cause must be one of the listed causes for the chosen category';
  }
}

/** Records the assignable-cause review that excludes a subgroup from the revised limits. */
export class ExcludeSubgroupDto {
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

  @IsString()
  @IsNotEmpty()
  category!: string;

  @Validate(KnownAssignableCauseConstraint)
  cause!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  found!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  correctiveAction!: string;

  @IsDateString()
  investigatedOn!: string;

  /** The reviewer's confirmation that the whole subgroup should be excluded. */
  @Equals(true)
  confirmed!: boolean;
}
