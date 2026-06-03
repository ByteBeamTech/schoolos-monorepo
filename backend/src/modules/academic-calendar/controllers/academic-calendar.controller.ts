import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
} from '@nestjs/common';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';

import { AcademicCalendarService } from '../services/academic-calendar.service';

import { CreateCalendarEventDto } from '../dto/create-calendar-event.dto';
import { UpdateCalendarEventDto } from '../dto/update-calendar-event.dto';
import { CalendarQueryDto } from '../dto/calendar-query.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Academic Calendar')
@Controller('academic-calendar')

export class AcademicCalendarController {
  constructor(
    private readonly service: AcademicCalendarService,
  ) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCalendarEventDto,
  ) {
    return this.service.createEvent(
      user.tenantId,
      user.branchId ?? null,
      user.id,
      dto.sessionId as any,
      dto,
    );
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CalendarQueryDto,
  ) {
    return this.service.listEvents(
      user.tenantId,
      query,
    );
  }

  @Get('month')
  month(
    @CurrentUser() user: AuthenticatedUser,
    @Query('sessionId') sessionId: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    return this.service.getMonthView(
      user.tenantId,
      sessionId,
      parseInt(year),
      parseInt(month),
    );
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCalendarEventDto,
  ) {
    return this.service.updateEvent(
      user.tenantId,
      id,
      dto,
    );
  }

  @Delete(':id')
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.deleteEvent(
      user.tenantId,
      id,
    );
  }

  @Patch(':id/publish')
  publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.publishEvent(
      user.tenantId,
      id,
    );
  }

  @Get('health')
  health() {
    return {
      module: 'academic-calendar',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
