import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class CreateBackgroundDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  imageKey: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class UpdateBackgroundDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}
