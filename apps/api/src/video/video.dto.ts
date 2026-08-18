import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class YouTubeVideoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  youtubeUrl!: string;
}

export class CreateR2UploadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  originalFileName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  mimeType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  fileSizeBytes!: number;
}

export class ConfirmR2UploadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  objectKey!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  originalFileName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  mimeType!: string;
}

export class DeleteVideoDto {}
