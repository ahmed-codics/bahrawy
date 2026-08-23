import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateVideoAccessRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lessonId!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  requestedEmail?: string;
}
