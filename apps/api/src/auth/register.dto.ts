import { IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const egyptianPhone = /^01[0125][0-9]{8}$/;

export class RegisterStudentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  secondName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  thirdName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName!: string;

  @Matches(egyptianPhone)
  phone!: string;

  @Matches(egyptianPhone)
  fatherPhone!: string;

  @Matches(egyptianPhone)
  motherPhone!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  schoolName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  guardianOccupation!: string;

  @IsIn(['MALE', 'FEMALE'])
  gender!: 'MALE' | 'FEMALE';

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  city!: string;

  @IsString()
  gradeId!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
