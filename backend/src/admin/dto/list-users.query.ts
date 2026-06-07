import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListUsersQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  // REQ-065: search by email
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  // REQ-065: filter by role
  @IsOptional()
  @IsIn(['admin', 'teacher', 'learner'])
  role?: 'admin' | 'teacher' | 'learner';

  @IsOptional()
  @IsIn(['active', 'deactivated'])
  status?: 'active' | 'deactivated';
}
