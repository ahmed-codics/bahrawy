import { Type } from 'class-transformer';
import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class LifecycleMutationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  @MinLength(3)
  reason!: string;
}

export class PermanentDeleteDto extends LifecycleMutationDto {
  @IsString()
  @MinLength(1)
  confirmation!: string;
}
