// common/middleware/raw-body.middleware.ts
// Required for webhook HMAC verification — preserves raw request body
// before Express JSON parser consumes it.
//
// Register in main.ts BEFORE app.use(express.json()):
//
//   app.use('/api/v1/webhooks', rawBodyMiddleware);
//   app.use(express.json());
//
// Or use NestJS middleware registration in AppModule:
//
//   consumer.apply(RawBodyMiddleware).forRoutes('webhooks');

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RawBodyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      (req as any).rawBody = Buffer.concat(chunks);
      next();
    });
    req.on('error', next);
  }
}
