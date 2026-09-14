import {
  ArrayMinSize,
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  Max,
  Min,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'weightsMatchSampleSize', async: false })
class WeightsMatchSampleSizeConstraint implements ValidatorConstraintInterface {
  validate(weights: number[], args: ValidationArguments): boolean {
    const dto = args.object as CreateSubgroupDto;
    return Array.isArray(weights) && weights.length === dto.sampleSize;
  }

  defaultMessage(): string {
    return 'weights array length must match sampleSize';
  }
}

export class CreateSubgroupDto {
  @IsDateString()
  productionDate!: string;

  @IsInt()
  @Min(2)
  @Max(10)
  sampleSize!: number;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(10)
  @IsNumber({}, { each: true })
  @Validate(WeightsMatchSampleSizeConstraint)
  weights!: number[];
}
