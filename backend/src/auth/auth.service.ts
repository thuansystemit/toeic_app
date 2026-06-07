import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { QueryFailedError, Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { AuthProvider, User } from '../users/user.entity';
import { RefreshToken } from './refresh-token.entity';
import { PasswordResetToken } from './password-reset-token.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './jwt.strategy';
import { EmailService } from '../email/email.service';

interface SocialProfile {
  providerId: string;
  email: string;
  displayName: string;
}

const BCRYPT_ROUNDS = 12;

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  preferredLocale: string;
}

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
    @InjectRepository(PasswordResetToken)
    private readonly resetTokens: Repository<PasswordResetToken>,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    let user: User;
    try {
      // Open self-registration always yields the 'learner' role (REQ-001).
      user = await this.usersService.create({
        email: dto.email,
        passwordHash,
        displayName: dto.displayName,
        role: 'learner',
      });
    } catch (err) {
      // REQ-002 / NFR-003: the unique index on LOWER(email) is the race-safe
      // source of truth for duplicate detection.
      if (err instanceof QueryFailedError && this.isUniqueViolation(err)) {
        throw new ConflictException('Email is already registered');
      }
      throw err;
    }
    return this.issueAuthResult(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(dto.email);
    // REQ-005: ambiguous 401 — do not reveal whether the email exists.
    // Social-only accounts have no password hash and can never password-login.
    const ok =
      user &&
      user.passwordHash !== null &&
      (await bcrypt.compare(dto.password, user.passwordHash));
    if (!user || !ok) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.status !== 'active') {
      throw new UnauthorizedException('Account is deactivated');
    }
    await this.usersService.touchLastLogin(user.id);
    return this.issueAuthResult(user);
  }

  // --- Social login (frontend token -> backend verify) ---

  async loginWithGoogle(idToken: string): Promise<AuthResult> {
    const profile = await this.verifyGoogle(idToken);
    return this.socialLogin('google', profile);
  }

  async loginWithFacebook(accessToken: string): Promise<AuthResult> {
    const profile = await this.verifyFacebook(accessToken);
    return this.socialLogin('facebook', profile);
  }

  private async socialLogin(
    provider: AuthProvider,
    profile: SocialProfile,
  ): Promise<AuthResult> {
    // Link by verified email: existing accounts (incl. local) are matched and
    // logged in; otherwise a new passwordless social account is created.
    const existing = await this.usersService.findByEmail(profile.email);
    if (existing) {
      if (existing.status !== 'active') {
        throw new UnauthorizedException('Account is deactivated');
      }
      if (!existing.providerId || existing.provider === 'local') {
        await this.usersService.linkProvider(
          existing.id,
          provider,
          profile.providerId,
        );
      }
      await this.usersService.touchLastLogin(existing.id);
      return this.issueAuthResult(existing);
    }
    const created = await this.usersService.createSocial({
      email: profile.email,
      displayName: profile.displayName,
      provider,
      providerId: profile.providerId,
    });
    return this.issueAuthResult(created);
  }

  private async verifyGoogle(idToken: string): Promise<SocialProfile> {
    const clientId = this.config.get<string>('google.clientId');
    if (!clientId) {
      throw new ServiceUnavailableException('Google login is not configured');
    }
    try {
      const client = new OAuth2Client(clientId);
      const ticket = await client.verifyIdToken({
        idToken,
        audience: clientId,
      });
      const payload = ticket.getPayload();
      if (!payload?.email) {
        throw new UnauthorizedException('Google account has no email');
      }
      return {
        providerId: payload.sub,
        email: payload.email,
        displayName: payload.name ?? payload.email,
      };
    } catch (err) {
      if (
        err instanceof UnauthorizedException ||
        err instanceof ServiceUnavailableException
      ) {
        throw err;
      }
      throw new UnauthorizedException('Invalid Google token');
    }
  }

  private async verifyFacebook(accessToken: string): Promise<SocialProfile> {
    const appId = this.config.get<string>('facebook.appId');
    const appSecret = this.config.get<string>('facebook.appSecret');
    if (!appId || !appSecret) {
      throw new ServiceUnavailableException('Facebook login is not configured');
    }
    const appToken = `${appId}|${appSecret}`;
    const debugUrl =
      `https://graph.facebook.com/debug_token?input_token=` +
      `${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appToken)}`;
    const dbgRes = await fetch(debugUrl);
    const dbg = (await dbgRes.json()) as {
      data?: { is_valid?: boolean; app_id?: string };
    };
    if (!dbg.data?.is_valid || String(dbg.data.app_id) !== String(appId)) {
      throw new UnauthorizedException('Invalid Facebook token');
    }
    const meRes = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(accessToken)}`,
    );
    const me = (await meRes.json()) as {
      id?: string;
      name?: string;
      email?: string;
    };
    if (!me.id) {
      throw new UnauthorizedException('Could not read Facebook profile');
    }
    if (!me.email) {
      // Facebook can omit email if the user didn't grant it.
      throw new BadRequestException(
        'Email permission is required for Facebook login',
      );
    }
    return {
      providerId: me.id,
      email: me.email,
      displayName: me.name ?? me.email,
    };
  }

  /** Rotate a refresh token: validate, revoke the old one, issue a new pair. */
  async refresh(presentedToken: string | undefined): Promise<AuthResult> {
    if (!presentedToken) {
      throw new UnauthorizedException('Missing refresh token');
    }
    const tokenHash = this.hashToken(presentedToken);
    const stored = await this.refreshTokens.findOne({ where: { tokenHash } });
    if (!stored || stored.revoked || stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    stored.revoked = true;
    await this.refreshTokens.save(stored);

    const user = await this.usersService.findById(stored.userId);
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Invalid or inactive account');
    }
    return this.issueAuthResult(user);
  }

  async logout(presentedToken: string | undefined): Promise<void> {
    if (!presentedToken) {
      return;
    }
    const tokenHash = this.hashToken(presentedToken);
    await this.refreshTokens.update({ tokenHash }, { revoked: true });
  }

  refreshTtlDays(): number {
    return this.config.get<number>('jwt.refreshTtlDays')!;
  }

  // --- Password reset (forgot password) ---

  /**
   * REQ-006: issue a 30-minute single-use reset link. Always succeeds silently
   * so the response can't be used to enumerate which emails are registered.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user || user.status !== 'active') {
      return; // do not reveal whether the email exists
    }
    const raw = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await this.resetTokens.save(
      this.resetTokens.create({
        userId: user.id,
        tokenHash: this.hashToken(raw),
        expiresAt,
        used: false,
      }),
    );
    const baseUrl = this.config.get<string>('appBaseUrl')!;
    const resetUrl = `${baseUrl}/reset-password?token=${raw}`;
    await this.emailService.sendPasswordReset(user.email, resetUrl);
  }

  /** REQ-007: consume a valid token to set a new password; expired/used -> 410. */
  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    const record = await this.resetTokens.findOne({ where: { tokenHash } });
    if (!record || record.used || record.expiresAt.getTime() < Date.now()) {
      throw new GoneException('Reset link is invalid or has expired');
    }
    const user = await this.usersService.findById(record.userId);
    if (!user) {
      throw new GoneException('Reset link is invalid or has expired');
    }
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.usersService.updatePasswordHash(user.id, passwordHash);

    record.used = true;
    await this.resetTokens.save(record);
    // Invalidate other sessions for safety.
    await this.refreshTokens.update(
      { userId: user.id, revoked: false },
      { revoked: true },
    );
  }

  private async issueAuthResult(user: User): Promise<AuthResult> {
    const payload: JwtPayload = { sub: user.id, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = await this.createRefreshToken(user.id);
    return {
      user: this.toPublicUser(user),
      accessToken,
      refreshToken,
    };
  }

  private async createRefreshToken(userId: string): Promise<string> {
    const raw = randomBytes(48).toString('hex');
    const expiresAt = new Date(
      Date.now() + this.refreshTtlDays() * 24 * 60 * 60 * 1000,
    );
    await this.refreshTokens.save(
      this.refreshTokens.create({
        userId,
        tokenHash: this.hashToken(raw),
        expiresAt,
        revoked: false,
      }),
    );
    return raw;
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private isUniqueViolation(err: QueryFailedError): boolean {
    // Postgres unique_violation
    return (err as unknown as { code?: string }).code === '23505';
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      preferredLocale: user.preferredLocale,
    };
  }
}
