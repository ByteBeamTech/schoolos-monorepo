import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '@core/auth/guards/jwt.guard';
import { RolesGuard } from '@core/roles/roles.guard';
import { Roles } from '@core/roles/roles.decorator';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';
import { StudentTransportAssignmentService } from '../services/student-transport-assignment.service';
import {
  AssignStudentDto,
  ConfirmTransferStudentDto,
  EndAssignmentDto,
  ListStudentAssignmentsQueryDto,
  TransferPreviewQueryDto,
} from '../dto/student-transport-assignment.dto';

const FLEET_ROLES = ['SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'TRANSPORT_MANAGER'];

@Controller('transport/student-assignments')
@UseGuards(JwtGuard, RolesGuard)
export class StudentTransportAssignmentController {
  constructor(private readonly service: StudentTransportAssignmentService) {}

  @Get()
  @Roles(...FLEET_ROLES)
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListStudentAssignmentsQueryDto) {
    return this.service.list(user, query);
  }

  @Get(':id')
  @Roles(...FLEET_ROLES)
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.getOne(user, id);
  }

  @Post()
  @Roles(...FLEET_ROLES)
  assign(@CurrentUser() user: AuthenticatedUser, @Body() dto: AssignStudentDto) {
    return this.service.assign(user, dto);
  }

  @Post(':id/remove')
  @Roles(...FLEET_ROLES)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: EndAssignmentDto,
  ) {
    return this.service.remove(user, id, dto);
  }

  // AF-007 wizard: Preview / Impact Analysis step for Student Transfer.
  @Get(':id/transfer/preview')
  @Roles(...FLEET_ROLES)
  previewTransfer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: TransferPreviewQueryDto,
  ) {
    return this.service.previewTransfer(user, id, query);
  }

  // AF-007 wizard: User Confirmation -> Execute -> Publish Domain Events -> Audit.
  @Post(':id/transfer/confirm')
  @Roles(...FLEET_ROLES)
  confirmTransfer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ConfirmTransferStudentDto,
  ) {
    return this.service.confirmTransfer(user, id, dto);
  }
}
