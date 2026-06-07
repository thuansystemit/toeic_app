import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { User, UserRole, UserStatus } from '../users/user.entity';
import { RefreshToken } from '../auth/refresh-token.entity';
import { ListUsersQuery } from './dto/list-users.query';

export interface AdminUserView {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
  ) {}

  async listUsers(query: ListUsersQuery): Promise<Paginated<AdminUserView>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.users.createQueryBuilder('u');
    if (query.search) {
      qb.andWhere(
        new Brackets((w) => {
          w.where('LOWER(u.email) LIKE :s', {
            s: `%${query.search!.toLowerCase()}%`,
          }).orWhere('LOWER(u.display_name) LIKE :s', {
            s: `%${query.search!.toLowerCase()}%`,
          });
        }),
      );
    }
    if (query.role) qb.andWhere('u.role = :role', { role: query.role });
    if (query.status) qb.andWhere('u.status = :status', { status: query.status });

    qb.orderBy('u.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [rows, total] = await qb.getManyAndCount();
    return {
      data: rows.map((u) => this.toView(u)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async changeRole(
    actingAdminId: string,
    userId: string,
    role: UserRole,
  ): Promise<AdminUserView> {
    // REQ-063: an admin cannot change their own role.
    if (actingAdminId === userId) {
      throw new ForbiddenException('You cannot change your own role');
    }
    const user = await this.getOrThrow(userId);
    user.role = role;
    await this.users.save(user);
    return this.toView(user);
  }

  async deactivate(
    actingAdminId: string,
    userId: string,
  ): Promise<AdminUserView> {
    // REQ-063: an admin cannot deactivate themselves.
    if (actingAdminId === userId) {
      throw new ForbiddenException('You cannot deactivate your own account');
    }
    const user = await this.getOrThrow(userId);
    user.status = 'deactivated';
    await this.users.save(user);
    // REQ-062: invalidate sessions — revoke all refresh tokens. The access
    // token is rejected on its next use because JwtStrategy checks status.
    await this.refreshTokens.update(
      { userId, revoked: false },
      { revoked: true },
    );
    return this.toView(user);
  }

  async reactivate(userId: string): Promise<AdminUserView> {
    const user = await this.getOrThrow(userId);
    user.status = 'active';
    await this.users.save(user);
    return this.toView(user);
  }

  private async getOrThrow(userId: string): Promise<User> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private toView(u: User): AdminUserView {
    return {
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      status: u.status,
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      createdAt: u.createdAt.toISOString(),
    };
  }
}
