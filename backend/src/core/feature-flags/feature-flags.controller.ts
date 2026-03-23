import { Controller, Get, Patch, Param, Body, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtGuard }          from '../auth/guards/jwt.guard';
import { Roles }             from '../roles/roles.decorator';
import { RolesGuard }        from '../roles/roles.guard';
import { FeatureFlagService } from './feature-flags.service';

@Controller('api/flags')
@UseGuards(JwtGuard)
export class FeatureFlagsController {
  constructor(private readonly flags: FeatureFlagService) {}

  @Get()
  async getFlags(@Req() req: Request) {
    const user = (req as any).user;
    return this.flags.getAllForTenant(user.tenantId);
  }

  @Get('stream')
  async streamFlags(@Req() req: Request, @Res() res: Response) {
    const user = (req as any).user;
    res.setHeader('Content-Type',  'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection',    'keep-alive');
    res.flushHeaders();

    const send = async () => {
      const flags = await this.flags.getAllForTenant(user.tenantId);
      res.write(`data: ${JSON.stringify(flags)}\n\n`);
    };

    await send();
    const interval = setInterval(send, 30_000);
    req.on('close', () => clearInterval(interval));
  }

  @Patch(':flagName')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  async toggleFlag(
    @Param('flagName') flagName: string,
    @Body() body: { tenantId: string; enabled: boolean },
  ) {
    await this.flags.setFlag(body.tenantId, flagName, body.enabled);
    return { ok: true };
  }
}
