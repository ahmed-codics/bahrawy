import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
  IsArray,
  ValidateNested,
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

export class CreateMultipartUploadDto {
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

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  partsCount!: number;
}

export class CompleteMultipartPartDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  PartNumber!: number;

  @IsString()
  @IsNotEmpty()
  ETag!: string;
}

export class CompleteMultipartUploadDto {
  @IsString()
  @IsNotEmpty()
  uploadId!: string;

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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompleteMultipartPartDto)
  parts!: CompleteMultipartPartDto[];
}

export class AbortMultipartUploadDto {
  @IsString()
  @IsNotEmpty()
  uploadId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  objectKey!: string;
}

export class DeleteVideoDto {}
