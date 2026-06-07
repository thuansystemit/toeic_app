import { IsIn } from 'class-validator';
import { UserRole } from '../../users/user.entity';

export class ChangeRoleDto {
  @IsIn(['admin', 'teacher', 'learner'])
  role!: UserRole;
}
