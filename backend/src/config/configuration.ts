export interface AppConfig {
  port: number;
  nodeEnv: string;
  corsOrigin: string;
  uploadsDir: string;
  db: {
    host: string;
    port: number;
    user: string;
    password: string;
    name: string;
  };
  jwt: {
    accessSecret: string;
    accessTtl: string;
    refreshSecret: string;
    refreshTtlDays: number;
  };
  google: { clientId: string };
  facebook: { appId: string; appSecret: string };
  appBaseUrl: string;
  redisUrl: string;
  internalApiToken: string;
  extractionQueue: string;
  // LLM for synchronous vocab generation (English Learning KG, P1). Mirrors the
  // worker's provider env so both stay in sync; P1 ships ollama only.
  llm: {
    provider: string; // ollama | claude | openai (P1: ollama)
    ollamaBaseUrl: string;
    ollamaModel: string;
  };
  mail: {
    from: string;
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      user: string;
      pass: string;
    };
  };
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  uploadsDir: process.env.UPLOADS_DIR ?? 'uploads',
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    user: process.env.DB_USER ?? 'toeic',
    password: process.env.DB_PASSWORD ?? 'toeic',
    name: process.env.DB_NAME ?? 'toeic',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me',
    refreshTtlDays: parseInt(process.env.JWT_REFRESH_TTL_DAYS ?? '7', 10),
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
  },
  facebook: {
    appId: process.env.FACEBOOK_APP_ID ?? '',
    appSecret: process.env.FACEBOOK_APP_SECRET ?? '',
  },
  // Base URL of the frontend, used to build the password-reset link.
  appBaseUrl:
    process.env.APP_BASE_URL ?? process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379/0',
  internalApiToken: process.env.INTERNAL_API_TOKEN ?? 'dev-internal-token-change-me',
  extractionQueue: process.env.EXTRACTION_QUEUE ?? 'extraction:jobs',
  llm: {
    provider: process.env.LLM_PROVIDER ?? 'ollama',
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
    ollamaModel: process.env.OLLAMA_MODEL ?? 'qwen2.5:3b',
  },
  mail: {
    from: process.env.MAIL_FROM ?? 'TOEIC Platform <no-reply@toeic.local>',
    smtp: {
      host: process.env.SMTP_HOST ?? '',
      port: parseInt(process.env.SMTP_PORT ?? '587', 10),
      secure: (process.env.SMTP_SECURE ?? 'false') === 'true',
      user: process.env.SMTP_USER ?? '',
      pass: process.env.SMTP_PASS ?? '',
    },
  },
});
