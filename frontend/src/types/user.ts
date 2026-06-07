export type UserRole = 'admin' | 'teacher' | 'learner';

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  preferredLocale?: string;
}

export interface AuthResponse {
  user: PublicUser;
  accessToken: string;
}
