import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/** Guards the /internal/* endpoints used by the Python extraction worker. */
@Injectable()
export class InternalTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const token = req.header('x-internal-token');
    const expected = this.config.get<string>('internalApiToken');
    if (!token || token !== expected) {
      throw new UnauthorizedException('Invalid internal token');
    }
    return true;
  }
}
