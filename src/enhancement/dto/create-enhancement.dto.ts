import { IsString, IsNotEmpty, IsIn, IsOptional } from 'class-validator';

export class CreateEnhancementDto {
  @IsString()
  @IsNotEmpty()
  styleId: string;

  @IsString()
  @IsNotEmpty()
  imageKey: string;

  @IsIn(['standard', 'hd'])
  resolution: 'standard' | 'hd';

  @IsOptional()
  @IsString()
  backgroundId?: string; // Custom background ID — if set, overrides styleId prompt
}
