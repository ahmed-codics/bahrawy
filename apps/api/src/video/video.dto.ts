import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const MAX_VIDEO_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;

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
  @Max(MAX_VIDEO_UPLOAD_BYTES)
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
