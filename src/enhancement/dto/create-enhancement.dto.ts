import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class CreateEnhancementDto {
  @IsString()
  @IsNotEmpty()
  styleId: string;

  @IsString()
  @IsNotEmpty()
  imageKey: string; // R2 object key from presigned upload

  @IsIn(['standard', 'hd'])
  resolution: 'standard' | 'hd';
}
