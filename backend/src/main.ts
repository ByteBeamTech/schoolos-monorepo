import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import { json } from 'express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    bufferLogs: true,
    // PR-3: disable Nest's automatic body parser so we can apply json()
    // ourselves with a `verify` callback -- this is what makes
    // WebhookHmacGuard possible (it needs the exact raw bytes Razorpay/
    // Stripe/PayPal signed, not Nest's re-serialized JSON, which can differ
    // in whitespace/key-order and would make every signature check fail).
    bodyParser: false,
  });

  const configService = app.get(ConfigService);

  app.use(helmet());
  app.use(compression());
  app.use(json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  }));

  const allowedOrigins = configService
    .get<string>('CORS_ORIGINS', '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

// --- main.ts CORS Fix ---
  
  app.enableCors({
    // Origin is driven by CORS_ORIGINS env var — set in .env.production
    // e.g. CORS_ORIGINS=https://schoolos.bytebeamtech.com,https://superadmin.bytebeamtech.com
    origin: allowedOrigins.length ? allowedOrigins : false,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'x-tenant-id', 
      'x-branch-id', 
      'x-idempotency-key'
    ],
  });
  const apiPrefix = configService.get<string>('API_PREFIX', 'api');
  app.setGlobalPrefix(apiPrefix);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = configService.get<number>('PORT', 3000);

  if (configService.get('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('SchoolOS API')
      .setDescription('Enterprise School ERP SaaS — API Documentation')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .addTag('auth', 'Authentication endpoints')
      .addTag('students', 'Student management')
      .addTag('student-billing', 'Fee plans, invoices, payments, receipts')
      .addTag('notifications', 'Notification management')
      .addTag('transport', 'Transport routes and assignments')
      .addTag('reporting', 'Analytics and reports')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      swaggerOptions: { persistAuthorization: true },
    });

    console.log(`Swagger UI: http://localhost:${port}/${apiPrefix}/docs`);
  }

  await app.listen(port);
  console.log(`SchoolOS API running on: http://localhost:${port}/${apiPrefix}`);
  console.log(`Environment: ${configService.get('NODE_ENV')}`);
}

bootstrap();
