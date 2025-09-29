import Redis from 'ioredis'
import { env } from './env'

// Redis ключи
export const REDIS_KEYS = {
  // Сессии пользователей
  USER_SESSION: (userId: bigint) => `session:user:${userId}`,
  ADMIN_SESSION: (adminId: number) => `session:admin:${adminId}`,
  
  // Админ токены доступа
  ADMIN_DASHBOARD_TOKEN: (token: string) => `admin:dashboard:${token}`,
  ADMIN_PENDING_ACCESS: (adminId: number) => `admin:pending:${adminId}`,
  ADMIN_WEB_SESSION: (sessionId: string) => `admin:web_session:${sessionId}`,
  ADMIN_REFRESH_TOKEN: (refreshToken: string) => `admin:refresh:${refreshToken}`,
  
  // Состояние бота
  BOT_SCENE: (userId: bigint) => `bot:scene:${userId}`,
  BOT_DATA: (userId: bigint) => `bot:data:${userId}`,
  BOT_SESSION: (sessionKey: string) => `bot:session:${sessionKey}`,
  
  // Кэш
  COUNTRY_LIST: 'cache:countries',
  WAREHOUSE_LIST: (countryId: number) => `cache:warehouses:${countryId}`,
  TARIFF_LIST: 'cache:tariffs',
  USER_PROFILE: (userId: bigint) => `cache:user:${userId}`,
  ORDER_DETAILS: (orderId: bigint) => `cache:order:${orderId}`,
  
  // Статистика и метрики
  STATS_DAILY: (date: string) => `stats:daily:${date}`,
  STATS_MONTHLY: (month: string) => `stats:monthly:${month}`,
  ONLINE_USERS: 'online:users',
  ONLINE_ADMINS: 'online:admins',
  
  // Очереди и задачи
  PAYMENT_QUEUE: 'queue:payments',
  NOTIFICATION_QUEUE: 'queue:notifications',
  EMAIL_QUEUE: 'queue:emails',
  
  // Rate limiting
  RATE_LIMIT: (userId: bigint) => `rate_limit:${userId}`,
  ADMIN_RATE_LIMIT: (adminId: number) => `rate_limit:admin:${adminId}`,
  
  // Locks для предотвращения дублирования
  ORDER_LOCK: (userId: bigint) => `lock:order:${userId}`,
  PAYMENT_LOCK: (paymentId: string) => `lock:payment:${paymentId}`,
  
  // Временные данные
  PAYMENT_TEMP: (paymentId: string) => `temp:payment:${paymentId}`,
  VERIFICATION_CODE: (userId: bigint) => `verification:${userId}`,
  
  // Real-time updates
  REALTIME_ORDERS: 'realtime:orders',
  REALTIME_USERS: 'realtime:users',
  REALTIME_SUPPORT: 'realtime:support'
} as const

// Конфигурация Redis
export const createRedisClient = (config?: {
  db?: number
  keyPrefix?: string
  retryDelayOnFailover?: number
  retryTimes?: number
}) => {
  const redisConfig = {
    ...config,
    retryDelayOnFailover: config?.retryDelayOnFailover ?? 100,
    retryTimes: config?.retryTimes ?? 3,
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    keepAlive: 30000,
    family: 4, // IPv4
    ...getRedisConnectionConfig()
  }
  
  return new Redis(redisConfig)
}

// Получение конфигурации подключения
const getRedisConnectionConfig = () => {
  if (env.REDIS_URL.startsWith('redis://') || env.REDIS_URL.startsWith('rediss://')) {
    return env.REDIS_URL
  }
  
  // Fallback для кастомной конфигурации
  return {
    host: 'localhost',
    port: 6379,
    db: 0
  }
}

// Основные клиенты Redis
export const redis = createRedisClient()
export const redisPub = createRedisClient({ keyPrefix: 'pub:' })
export const redisSub = createRedisClient({ keyPrefix: 'sub:' })

// TTL константы (в секундах)
export const TTL = {
  SHORT: 60 * 5,        // 5 минут
  MEDIUM: 60 * 30,      // 30 минут
  LONG: 60 * 60 * 2,    // 2 часа
  DAY: 60 * 60 * 24,    // 1 день
  WEEK: 60 * 60 * 24 * 7, // 1 неделя
  MONTH: 60 * 60 * 24 * 30 // 1 месяц
} as const

// Утилиты для работы с Redis
export class RedisHelper {
  private client: Redis
  
  constructor(client: Redis = redis) {
    this.client = client
  }
  
  // Установка значения с TTL
  async setWithTTL(key: string, value: any, ttl: number = TTL.MEDIUM): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    await this.client.setex(key, ttl, serialized)
  }
  
  // Получение и десериализация значения
  async get<T = any>(key: string): Promise<T | null> {
    const value = await this.client.get(key)
    if (!value) return null
    
    try {
      return JSON.parse(value)
    } catch {
      return value as T
    }
  }
  
  // Получение нескольких ключей
  async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    const values = await this.client.mget(...keys)
    return values.map(value => {
      if (!value) return null
      try {
        return JSON.parse(value)
      } catch {
        return value as T
      }
    })
  }
  
  // Установка нескольких ключей
  async mset(keyValues: Record<string, any>, ttl?: number): Promise<void> {
    const pipeline = this.client.pipeline()
    
    Object.entries(keyValues).forEach(([key, value]) => {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value)
      if (ttl) {
        pipeline.setex(key, ttl, serialized)
      } else {
        pipeline.set(key, serialized)
      }
    })
    
    await pipeline.exec()
  }
  
  // Работа с множествами (sets)
  async sadd(key: string, ...members: string[]): Promise<number> {
    return await this.client.sadd(key, ...members)
  }
  
  async srem(key: string, ...members: string[]): Promise<number> {
    return await this.client.srem(key, ...members)
  }
  
  async smembers(key: string): Promise<string[]> {
    return await this.client.smembers(key)
  }
  
  async sismember(key: string, member: string): Promise<boolean> {
    return (await this.client.sismember(key, member)) === 1
  }
  
  // Работа с hash
  async hset(key: string, field: string, value: any): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    await this.client.hset(key, field, serialized)
  }
  
  async hget<T = any>(key: string, field: string): Promise<T | null> {
    const value = await this.client.hget(key, field)
    if (!value) return null
    
    try {
      return JSON.parse(value)
    } catch {
      return value as T
    }
  }
  
  async hgetall<T = any>(key: string): Promise<Record<string, T>> {
    const hash = await this.client.hgetall(key)
    const result: Record<string, T> = {}
    
    Object.entries(hash).forEach(([field, value]) => {
      try {
        result[field] = JSON.parse(value)
      } catch {
        result[field] = value as T
      }
    })
    
    return result
  }
  
  // Работа с счетчиками
  async incr(key: string): Promise<number> {
    return await this.client.incr(key)
  }
  
  async incrby(key: string, increment: number): Promise<number> {
    return await this.client.incrby(key, increment)
  }
  
  async decr(key: string): Promise<number> {
    return await this.client.decr(key)
  }
  
  // Блокировки
  async lock(key: string, ttl: number = 30): Promise<boolean> {
    const result = await this.client.set(key, '1', 'EX', ttl, 'NX')
    return result === 'OK'
  }
  
  async unlock(key: string): Promise<void> {
    await this.client.del(key)
  }
  
  // Pub/Sub
  async publish(channel: string, message: any): Promise<number> {
    const serialized = typeof message === 'string' ? message : JSON.stringify(message)
    return await this.client.publish(channel, serialized)
  }
  
  // Batch операции
  async deletePattern(pattern: string): Promise<number> {
    const keys = await this.client.keys(pattern)
    if (keys.length === 0) return 0
    return await this.client.del(...keys)
  }
  
  // Очистка кэша
  async clearCache(prefix?: string): Promise<number> {
    const pattern = prefix ? `${prefix}*` : 'cache:*'
    return await this.deletePattern(pattern)
  }
  
  // Health check
  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping()
      return result === 'PONG'
    } catch {
      return false
    }
  }
  
  // Получение информации о Redis
  async info(): Promise<Record<string, string>> {
    const info = await this.client.info()
    const result: Record<string, string> = {}
    
    info.split('\n').forEach(line => {
      const [key, value] = line.split(':')
      if (key && value) {
        result[key.trim()] = value.trim()
      }
    })
    
    return result
  }
}

// Экспорт готового хелпера
export const redisHelper = new RedisHelper(redis)

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('Closing Redis connections...')
  await Promise.all([
    redis.quit(),
    redisPub.quit(),
    redisSub.quit()
  ])
}

process.on('SIGTERM', gracefulShutdown)
process.on('SIGINT', gracefulShutdown)