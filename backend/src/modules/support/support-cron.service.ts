import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupportService } from './services/support.service';

@Injectable()
export class SupportCronService {
  private readonly logger = new Logger(SupportCronService.name);

  constructor(private readonly supportSvc: SupportService) {}

  @Cron('*/30 * * * *')
  async slaCheck() {
    this.logger.log('Running SLA check...');
    await this.supportSvc.runSLACheck();
  }
}
