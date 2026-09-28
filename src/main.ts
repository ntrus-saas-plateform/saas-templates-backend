import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { LoggerService } from './shared/logging/logger.service.js';
import express from 'express';
import type { EnvironmentConfig } from './shared/configuration/environment.schema.js';
import { APP_CONFIG } from './shared/configuration/configuration.module.js';
import { resolvePublicBaseUrl, resolveCorsOrigins } from './shared/configuration/resolve-public-base-url.js';
import {
  SWAGGER_JSON_PATH,
  SWAGGER_UI_PATH,
} from './shared/swagger/swagger.constants.js';
import {
  createPlatformOpenApiConfig,
  uniqueOperationId,
} from './shared/swagger/openapi-document.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, bodyParser: false });
  const config = app.get<EnvironmentConfig>(APP_CONFIG);
  const publicBaseUrl = resolvePublicBaseUrl(config);

  app.enableShutdownHooks();
  app.use(express.json({ limit: config.MAX_PAYLOAD_SIZE }));
  app.use(express.urlencoded({ extended: true, limit: config.MAX_PAYLOAD_SIZE }));

  const logger = app.get(LoggerService);
  const nestLog =
    config.NODE_ENV === 'development'
      ? (message: string) => {
          if (message.startsWith('Mapped {') || /Controller \{/.test(message)) return;
          logger.info(message);
        }
      : (message: string) => logger.info(message);

  if (config.NODE_ENV !== 'development') {
    app.use(helmet());
  }

  app.use(compression());
  app.use(cookieParser());
  app.enableCors({
    origin: resolveCorsOrigins(config, publicBaseUrl),
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-Id',
      'X-Correlation-Id',
      'Idempotency-Key',
    ],
  });

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.setGlobalPrefix('api', { exclude: ['liveness', 'readiness', 'health', 'metrics'] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerEnabled = config.NODE_ENV !== 'production' || config.SWAGGER_ENABLED;
  const document = SwaggerModule.createDocument(
    app,
    createPlatformOpenApiConfig(publicBaseUrl),
    { operationIdFactory: uniqueOperationId },
  );

  if (swaggerEnabled) {
    SwaggerModule.setup(SWAGGER_UI_PATH, app, document, {
      jsonDocumentUrl: SWAGGER_JSON_PATH,
      customSiteTitle: 'Platform Core API',
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'list',
        filter: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
        tryItOutEnabled: true,
        displayRequestDuration: true,
      },
    });

    const http = app.getHttpAdapter();
    http.get(`/docs/`, (_req: unknown, res: { redirect: (code: number, url: string) => void }) =>
      res.redirect(302, `/${SWAGGER_UI_PATH}`),
    );
    http.get('/api/docs', (_req: unknown, res: { redirect: (code: number, url: string) => void }) =>
      res.redirect(302, `/${SWAGGER_UI_PATH}`),
    );
    http.get('/swagger', (_req: unknown, res: { redirect: (code: number, url: string) => void }) =>
      res.redirect(302, `/${SWAGGER_UI_PATH}`),
    );
  }

  const port = config.PORT;
  await app.listen(port, '0.0.0.0', () => {
    logger.info(`Server is running on port ${port}`);
    logger.info(`Swagger is running on host http://0.0.0.0:${port}/${SWAGGER_UI_PATH}`);
    logger.info(`Docs are running on host http://0.0.0.0:${port}/${SWAGGER_UI_PATH}`);
  });

  app.useLogger({
    log: nestLog,
    error: (message: string, trace?: string) =>
      logger.error(message, trace ? new Error(trace) : undefined),
    warn: (message: string) => logger.warn(message),
    debug: (message: string) => logger.debug(message),
    verbose: (message: string) => logger.debug(message),
  });

  // printStartupBanner({
  //   config,
  //   baseUrl: publicBaseUrl,
  //   swaggerEnabled,
  //   apiOperationCount: Object.keys(document.paths).length,
  // });
  // logger.info('Platform Core ready', {
  //   port,
  //   host: config.HOST,
  //   baseUrl: publicBaseUrl,
  //   swaggerUrl: swaggerEnabled ? `${publicBaseUrl}/${SWAGGER_UI_PATH}` : null,
  //   swaggerEnabled,
  // });

  setupGracefulShutdown(app);
}

function setupGracefulShutdown(app: Awaited<ReturnType<typeof NestFactory.create>>): void {
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

  for (const signal of signals) {
    process.on(signal, () => {
      void (async () => {
        const logger = app.get(LoggerService);
        logger.info(`Received ${signal}, starting graceful shutdown`);

        await app.close();

        logger.info('Graceful shutdown complete');
        process.exit(0);
      })();
    });
  }
}

await bootstrap();
