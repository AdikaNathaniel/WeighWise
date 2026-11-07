import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'nonconformingWithinSamples', async: false })
class NonconformingWithinSamplesConstraint implements ValidatorConstraintInterface {
  validate(nonconforming: number, args: ValidationArguments): boolean {
    const dto = args.object as CreateColourBatchDto;
    return nonconforming <= dto.samplesInspected;
  }

  defaultMessage(): string {
    return 'nonconforming cannot exceed samplesInspected';
  }
}

export class CreateColourBatchDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  batchLabel!: string;

  @IsDateString()
  productionDate!: string;

  @IsInt()
  @Min(1)
  samplesInspected!: number;

  @IsInt()
  @Min(0)
  @Validate(NonconformingWithinSamplesConstraint)
  nonconforming!: number;
}
