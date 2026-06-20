import * as fs from 'fs';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';
import { User, UserRole, UserStatus } from '../users/user.entity';
import { RefreshToken } from '../auth/refresh-token.entity';
import { ListUsersQuery } from './dto/list-users.query';

export interface ConfigEntry {
  key: string;
  value: string;
  secret: boolean;
}

export interface AppConfigView {
  path: string;
  present: boolean;
  entries: ConfigEntry[];
}

// Keys whose values are secrets — masked before leaving the server.
const SECRET_KEY = /KEY|SECRET|TOKEN|PASSWORD/i;

function maskSecret(value: string): string {
  if (!value) return '';
  return value.length <= 4 ? '••••' : '••••••••' + value.slice(-4);
}

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
    private readonly dataSource: DataSource,
  ) {}

  /** Read the mounted .env and return its entries, masking secret values.
   * Read-only view for the admin Configuration page. */
  getConfig(): AppConfigView {
    const path = process.env.LLM_ENV_FILE ?? '/app/.env';
    let raw: string;
    try {
      raw = fs.readFileSync(path, 'utf8');
    } catch {
      return { path, present: false, entries: [] };
    }
    const entries: ConfigEntry[] = [];
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const eq = trimmed.indexOf('=');
      const key = trimmed.slice(0, eq).trim();
      if (!key) continue;
      const rawValue = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
      const secret = SECRET_KEY.test(key);
      entries.push({ key, value: secret ? maskSecret(rawValue) : rawValue, secret });
    }
    return { path, present: true, entries };
  }

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

  /** Reset a user's password to a generated temporary one, returned ONCE so the
   * admin can share it. Revokes the user's sessions so they must log in afresh.
   * The temp password satisfies the policy (>= 8 chars, contains a digit). */
  async resetPassword(userId: string): Promise<{ tempPassword: string }> {
    const user = await this.getOrThrow(userId);
    const tempPassword =
      'Tmp-' + randomBytes(4).toString('hex') + (10 + Math.floor(Math.random() * 90));
    user.passwordHash = await bcrypt.hash(tempPassword, 12);
    await this.users.save(user);
    await this.refreshTokens.update(
      { userId, revoked: false },
      { revoked: true },
    );
    return { tempPassword };
  }

  /**
   * Permanently remove a user and everything tied to them (full purge):
   *  - attempts they made AND every attempt on the tests they authored,
   *  - exam files they uploaded (extraction jobs cascade),
   *  - tests they authored (parts/questions/choices/stimuli/skill tags cascade),
   *  - the user (refresh + password-reset tokens cascade).
   * Irreversible. Guarded so an admin can't delete themselves or the last admin.
   */
  async hardDelete(
    actingAdminId: string,
    userId: string,
  ): Promise<{ deleted: true }> {
    if (actingAdminId === userId) {
      throw new ForbiddenException('You cannot delete your own account');
    }
    const user = await this.getOrThrow(userId);
    if (user.role === 'admin') {
      const admins = await this.users.count({ where: { role: 'admin' } });
      if (admins <= 1) {
        throw new ForbiddenException('Cannot delete the last administrator');
      }
    }

    await this.dataSource.transaction(async (m) => {
      // The user's own attempts + everyone's attempts on the user's tests
      // (attempts.test_id has no cascade, so it must be cleared explicitly).
      await m.query(
        `DELETE FROM attempts
           WHERE user_id = $1
              OR test_id IN (SELECT id FROM tests WHERE created_by = $1)`,
        [userId],
      );
      await m.query(`DELETE FROM exam_files WHERE uploaded_by = $1`, [userId]);
      await m.query(`DELETE FROM tests WHERE created_by = $1`, [userId]);
      await m.query(`DELETE FROM users WHERE id = $1`, [userId]);
    });
    return { deleted: true };
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
