import { Controller, Get, Query, Res, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { StorageService } from './storage.service';
import { Public } from '../../core/auth/decorators/public.decorator';

@Controller('storage')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Public()
  @Get('download')
  async download(@Query('key') key: string, @Res() response: Response) {
    if (!key || key.includes('..') || key.startsWith('/')) {
      throw new BadRequestException('Invalid storage key.');
    }
    if (this.storage.getMode() === 's3') {
      return response.redirect(await this.storage.getSignedDownloadUrl(key));
    }
    const file = await this.storage.readLocalFile(key);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Cache-Control', 'private, max-age=3600');
    return response.send(file.body);
  }
}
