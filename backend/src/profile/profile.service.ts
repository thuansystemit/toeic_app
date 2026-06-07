import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

const BCRYPT_ROUNDS = 12;

export interface ProfileView {
  id: string;
  email: string;
  displayName: string;
  role: string;
  preferredLocale: string;
  createdAt: string;
  lastLoginAt: string | null;
}

@Injectable()
export class ProfileService {
  constructor(private readonly usersService: UsersService) {}

  async get(userId: string): Promise<ProfileView> {
    const user = await this.usersService.getByIdOrThrow(userId);
    return this.toView(user);
  }

  async update(userId: string, dto: UpdateProfileDto): Promise<ProfileView> {
    const user = await this.usersService.updateProfile(userId, {
      displayName: dto.displayName,
      preferredLocale: dto.preferredLocale,
    });
    return this.toView(user);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.usersService.getByIdOrThrow(userId);
    if (!user.passwordHash) {
      // Social-only account (Google/Facebook) — no password to change.
      throw new BadRequestException(
        'This account signs in with a social provider and has no password',
      );
    }
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different');
    }
    const hash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.usersService.updatePasswordHash(userId, hash);
  }

  private toView(user: User): ProfileView {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      preferredLocale: user.preferredLocale,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    };
  }
}
