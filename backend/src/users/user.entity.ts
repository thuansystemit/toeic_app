import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type UserRole = 'admin' | 'teacher' | 'learner';
export type UserStatus = 'active' | 'deactivated';
export type AuthProvider = 'local' | 'google' | 'facebook';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  // Null for social-only accounts (Google/Facebook) that never set a password.
  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true })
  passwordHash!: string | null;

  @Column({ name: 'display_name', type: 'varchar', length: 100 })
  displayName!: string;

  @Column({ type: 'varchar', length: 20, default: 'local' })
  provider!: AuthProvider;

  @Column({ name: 'provider_id', type: 'varchar', length: 255, nullable: true })
  providerId!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'learner' })
  role!: UserRole;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: UserStatus;

  @Column({ name: 'preferred_locale', type: 'varchar', length: 5, default: 'vi' })
  preferredLocale!: string;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
