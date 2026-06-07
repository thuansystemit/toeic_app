import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthProvider, User, UserRole } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  /** Case-insensitive lookup (REQ-008: email normalized to lowercase). */
  findByEmail(email: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('u')
      .where('LOWER(u.email) = LOWER(:email)', { email })
      .getOne();
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  async getByIdOrThrow(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  create(params: {
    email: string;
    passwordHash: string;
    displayName: string;
    role?: UserRole;
    preferredLocale?: string;
  }): Promise<User> {
    const user = this.users.create({
      email: params.email.toLowerCase(),
      passwordHash: params.passwordHash,
      displayName: params.displayName,
      role: params.role ?? 'learner',
      preferredLocale: params.preferredLocale ?? 'vi',
    });
    return this.users.save(user);
  }

  async touchLastLogin(id: string): Promise<void> {
    await this.users.update({ id }, { lastLoginAt: new Date() });
  }

  createSocial(params: {
    email: string;
    displayName: string;
    provider: AuthProvider;
    providerId: string;
  }): Promise<User> {
    const user = this.users.create({
      email: params.email.toLowerCase(),
      passwordHash: null,
      displayName: params.displayName,
      role: 'learner',
      provider: params.provider,
      providerId: params.providerId,
      preferredLocale: 'vi',
    });
    return this.users.save(user);
  }

  /** Backfill provider info on an existing (e.g. local) account on first social login. */
  async linkProvider(
    id: string,
    provider: AuthProvider,
    providerId: string,
  ): Promise<void> {
    await this.users.update({ id }, { provider, providerId });
  }

  async updateProfile(
    id: string,
    patch: { displayName?: string; preferredLocale?: string },
  ): Promise<User> {
    const user = await this.getByIdOrThrow(id);
    if (patch.displayName !== undefined) user.displayName = patch.displayName;
    if (patch.preferredLocale !== undefined)
      user.preferredLocale = patch.preferredLocale;
    return this.users.save(user);
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.users.update({ id }, { passwordHash });
  }
}
