import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { AdminService } from './admin.service';
import { ListUsersQuery } from './dto/list-users.query';
import { ChangeRoleDto } from './dto/change-role.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  listUsers(@Query() query: ListUsersQuery) {
    return this.adminService.listUsers(query);
  }

  @Patch('users/:userId/role')
  changeRole(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: ChangeRoleDto,
  ) {
    return this.adminService.changeRole(admin.id, userId, dto.role);
  }

  @Post('users/:userId/deactivate')
  deactivate(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.adminService.deactivate(admin.id, userId);
  }

  @Post('users/:userId/reactivate')
  reactivate(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.adminService.reactivate(userId);
  }

  @Delete('users/:userId')
  hardDelete(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.adminService.hardDelete(admin.id, userId);
  }
}
