import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../users/user.entity';

export const ROLES_KEY = 'roles';

/** Restrict a route to one or more roles. Use together with JwtAuthGuard + RolesGuard. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
