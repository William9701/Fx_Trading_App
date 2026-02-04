import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const port = configService.get<number>('port');
  const apiPrefix = configService.get<string>('api_prefix');

  // Global prefix so every route lives under /api/v1/...
  app.setGlobalPrefix(apiPrefix);

  // Validation pipe strips unknown properties and transforms types automatically
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Catch anything that escapes individual controller/service error handling
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Enable CORS — tighten the origin list in production via env
  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Swagger docs — only mounted outside production
  if (configService.get<string>('node_env') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('FX Trading API')
      .setDescription('Backend API for the FX Trading Application')
      .setVersion('1.0.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'Bearer',
      )
      .addTag('Authentication', 'Register, verify, and login')
      .addTag('Wallet', 'Fund, convert, and trade currencies')
      .addTag('FX Rates', 'Real-time exchange rates')
      .addTag('Transactions', 'Transaction history and details')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(port);

  console.log(`🚀 FX Trading API running on port ${port}`);
  console.log(`📖 Swagger docs: http://localhost:${port}/docs`);
}

bootstrap();
