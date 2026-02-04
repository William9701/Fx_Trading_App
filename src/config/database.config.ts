import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const isDevelopment = configService.get<string>('node_env') === 'development';

  // Render / Neon / Supabase provide a single DATABASE_URL.
  // When it exists, use it directly and skip individual host/port/etc fields.
  const databaseUrl = configService.get<string>('database.url');

  const baseConfig: TypeOrmModuleOptions = {
    type: 'postgres',
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    // No migration files exist yet — synchronize handles schema on every start.
    // Once migrations are added, set synchronize: false and migrationsRun: true.
    synchronize: true,
    logging: isDevelopment,
  };

  if (databaseUrl) {
    // Connection-string mode — used on Render, Neon, Supabase, etc.
    // ssl: true is required by most managed Postgres providers.
    return {
      ...baseConfig,
      url: databaseUrl,
      ssl: !isDevelopment,
    };
  }

  // Individual-field mode — used for local Docker development.
  return {
    ...baseConfig,
    host: configService.get<string>('database.host'),
    port: configService.get<number>('database.port'),
    username: configService.get<string>('database.username'),
    password: configService.get<string>('database.password'),
    database: configService.get<string>('database.database'),
  };
};
