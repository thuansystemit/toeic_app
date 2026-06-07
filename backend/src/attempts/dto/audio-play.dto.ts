import { IsUUID } from 'class-validator';

export class AudioPlayDto {
  @IsUUID()
  stimulusId!: string;
}
