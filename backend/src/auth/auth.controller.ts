import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AuthService, AuthResult, PublicUser } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto, FacebookLoginDto } from './dto/social-login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { AuthenticatedUser } from './jwt.strategy';

const REFRESH_COOKIE = 'refresh_token';
// Scope the cookie to the auth routes only (global prefix is 'api').
const REFRESH_COOKIE_PATH = '/api/auth';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: PublicUser; accessToken: string }> {
    const result = await this.authService.register(dto);
    return this.respondWithTokens(res, result);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: PublicUser; accessToken: string }> {
    const result = await this.authService.login(dto);
    return this.respondWithTokens(res, result);
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  async google(
    @Body() dto: GoogleLoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: PublicUser; accessToken: string }> {
    const result = await this.authService.loginWithGoogle(dto.idToken);
    return this.respondWithTokens(res, result);
  }

  @Post('facebook')
  @HttpCode(HttpStatus.OK)
  async facebook(
    @Body() dto: FacebookLoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: PublicUser; accessToken: string }> {
    const result = await this.authService.loginWithFacebook(dto.accessToken);
    return this.respondWithTokens(res, result);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.requestPasswordReset(dto.email);
    // Always the same response (anti-enumeration).
    return { message: 'If that email exists, a reset link has been sent.' };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Password has been reset. You can now log in.' };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: PublicUser; accessToken: string }> {
    const presented = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    const result = await this.authService.refresh(presented);
    return this.respondWithTokens(res, result);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const presented = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    await this.authService.logout(presented);
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  private respondWithTokens(
    res: Response,
    result: AuthResult,
  ): { user: PublicUser; accessToken: string } {
    // ADR-011: refresh token lives in an HttpOnly cookie, never in the body.
    const isProd = this.config.get<string>('nodeEnv') === 'production';
    res.cookie(REFRESH_COOKIE, result.refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
      maxAge: this.authService.refreshTtlDays() * 24 * 60 * 60 * 1000,
    });
    return { user: result.user, accessToken: result.accessToken };
  }
}
