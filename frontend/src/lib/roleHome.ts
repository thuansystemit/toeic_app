import type { UserRole } from '../types/user';

/** The focused landing route for each role (used after login/register). */
export function roleHome(role: UserRole | undefined): string {
  switch (role) {
    case 'admin':
      return '/admin/users';
    case 'teacher':
      return '/authoring';
    default:
      return '/'; // learner
  }
}
