import { z } from 'zod'
import dotenv from 'dotenv'

// Загрузка переменных окружения
dotenv.config()

const envSchema = z.object({
  // General
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('localhost'),
  PORT: z.string().transform(Number).default(3000),
  API_PORT: z.string().transform(Number).default(3001),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  
  // Database
  DATABASE_URL: z.string().url(),
  
  // Redis
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  
  // Telegram Bot
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_WEBHOOK_URL: z.string().url().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  
  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('30d'),
  
  // API
  API_URL: z.string().url().optional(),
  FRONTEND_URL: z.string().url().optional(),
  ADMIN_DASHBOARD_URL: z.string().url().optional(),
  
  // File Storage
  STORAGE_TYPE: z.enum(['local', 's3', 'cloudinary']).default('local'),
  STORAGE_PATH: z.string().default('./uploads'),
  
  // AWS S3 (if using S3 storage)
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  
  // Cloudinary (if using Cloudinary storage)
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  
  // Payment Systems
  YOOKASSA_SHOP_ID: z.string().optional(),
  YOOKASSA_SECRET_KEY: z.string().optional(),
  
  SBER_MERCHANT_ID: z.string().optional(),
  SBER_SECRET_KEY: z.string().optional(),
  
  CRYPTO_BOT_TOKEN: z.string().optional(),
  
  // External APIs
  EXCHANGE_RATE_API_KEY: z.string().optional(),
  
  // Email
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  
  // Security
  CORS_ORIGIN: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default(60000), // 1 minute
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default(100),
  
  // Monitoring
  SENTRY_DSN: z.string().optional(),
  
  // Development
  WEBHOOK_NGROK_URL: z.string().url().optional()
})

export type Env = z.infer<typeof envSchema>

// Валидация переменных окружения
const parseResult = envSchema.safeParse(process.env)

if (!parseResult.success) {
  console.error('❌ Invalid environment variables:')
  console.error(parseResult.error.format())
  process.exit(1)
}

export const env = parseResult.data

// Функции для генерации URL на основе HOST
const generateUrl = (host: string, port: number, path: string = ''): string => {
  const protocol = env.NODE_ENV === 'production' ? 'https' : 'http'
  const portStr = (env.NODE_ENV === 'production' || port === 80 || port === 443) ? '' : `:${port}`
  return `${protocol}://${host}${portStr}${path}`
}

// Получаем динамические URL
export const getApiUrl = (): string => {
  return env.API_URL || generateUrl(env.HOST, env.API_PORT)
}

export const getFrontendUrl = (): string => {
  return env.FRONTEND_URL || generateUrl(env.HOST, env.PORT)
}

export const getAdminDashboardUrl = (): string => {
  return env.ADMIN_DASHBOARD_URL || generateUrl(env.HOST, env.PORT, '/admin-dashboard')
}

export const getCorsOrigin = (): string[] => {
  if (env.CORS_ORIGIN) {
    return env.CORS_ORIGIN.split(',').map(url => url.trim())
  }
  
  // По умолчанию разрешаем фронтенд и админку
  return [
    getFrontendUrl(),
    getAdminDashboardUrl(),
    generateUrl(env.HOST, 3000), // дополнительный dev сервер
    generateUrl(env.HOST, 5173), // Vite dev
    generateUrl(env.HOST, 5174)  // дополнительный Vite
  ]
}

// Проверка критических переменных для production
if (env.NODE_ENV === 'production') {
  const requiredInProduction = [
    'DATABASE_URL',
    'REDIS_URL',
    'TELEGRAM_BOT_TOKEN',
    'JWT_SECRET',
    'REFRESH_TOKEN_SECRET'
  ]
  
  const missing = requiredInProduction.filter(key => !process.env[key])
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables for production:')
    console.error(missing.join(', '))
    process.exit(1)
  }
}

// Вспомогательные функции
export const isDevelopment = () => env.NODE_ENV === 'development'
export const isProduction = () => env.NODE_ENV === 'production'
export const isTest = () => env.NODE_ENV === 'test'

// Конфигурация базы данных
export const getDatabaseConfig = () => ({
  url: env.DATABASE_URL,
  ssl: isProduction() ? { rejectUnauthorized: false } : undefined
})

// Конфигурация Redis
export const getRedisConfig = () => ({
  url: env.REDIS_URL,
  retryDelayOnFailover: 100,
  retryTimes: 3,
  lazyConnect: true
})

// Конфигурация JWT
export const getJwtConfig = () => ({
  secret: env.JWT_SECRET,
  expiresIn: env.JWT_EXPIRES_IN,
  refreshSecret: env.REFRESH_TOKEN_SECRET,
  refreshExpiresIn: env.REFRESH_TOKEN_EXPIRES_IN
})

// Конфигурация Telegram
export const getTelegramConfig = () => ({
  token: env.TELEGRAM_BOT_TOKEN,
  webhookUrl: env.TELEGRAM_WEBHOOK_URL,
  webhookSecret: env.TELEGRAM_WEBHOOK_SECRET,
  apiUrl: 'https://api.telegram.org'
})

// Конфигурация CORS
export const getCorsConfig = () => ({
  origin: getCorsOrigin(),
  credentials: true,
  optionsSuccessStatus: 200
})

// Конфигурация rate limiting
export const getRateLimitConfig = () => ({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  message: {
    success: false,
    error: 'Too many requests, please try again later'
  }
})

// Конфигурация файлового хранилища
export const getStorageConfig = () => {
  const config: any = {
    type: env.STORAGE_TYPE
  }
  
  switch (env.STORAGE_TYPE) {
    case 'local':
      config.path = env.STORAGE_PATH
      break
    case 's3':
      config.region = env.AWS_REGION
      config.accessKeyId = env.AWS_ACCESS_KEY_ID
      config.secretAccessKey = env.AWS_SECRET_ACCESS_KEY
      config.bucket = env.AWS_S3_BUCKET
      break
    case 'cloudinary':
      config.cloudName = env.CLOUDINARY_CLOUD_NAME
      config.apiKey = env.CLOUDINARY_API_KEY
      config.apiSecret = env.CLOUDINARY_API_SECRET
      break
  }
  
  return config
}