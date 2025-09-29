import { StorageAdapter } from 'grammy'
import { RedisHelper, REDIS_KEYS, TTL } from '@cargo/config'

interface SessionData {
  scene?: string
  data?: Record<string, any>
  userId?: bigint
  adminId?: number
  lastActivity?: Date
}

export function setupSession(redis: RedisHelper): StorageAdapter<SessionData> {
  return {
    async read(key: string): Promise<SessionData | undefined> {
      try {
        const sessionKey = REDIS_KEYS.BOT_SESSION(key)
        const data = await redis.get<SessionData>(sessionKey)
        return data || undefined
      } catch (error) {
        console.error('Session read error:', error)
        return undefined
      }
    },

    async write(key: string, value: SessionData): Promise<void> {
      try {
        const sessionKey = REDIS_KEYS.BOT_SESSION(key)
        const sessionData = {
          ...value,
          lastActivity: new Date()
        }
        
        // Сохраняем сессию на 24 часа
        await redis.setWithTTL(sessionKey, sessionData, TTL.DAY)
      } catch (error) {
        console.error('Session write error:', error)
      }
    },

    async delete(key: string): Promise<void> {
      try {
        const sessionKey = REDIS_KEYS.BOT_SESSION(key)
        await redis.del(sessionKey)
      } catch (error) {
        console.error('Session delete error:', error)
      }
    }
  }
}

// Функция для генерации ключа сессии
export function getSessionKey(ctx: any): string {
  // Используем chat.id как ключ для приватных чатов
  if (ctx.chat?.type === 'private') {
    return `user:${ctx.chat.id}`
  }
  
  // Для групп используем комбинацию chat.id и user.id
  return `group:${ctx.chat?.id}:user:${ctx.from?.id}`
}

// Middleware для очистки старых сессий
export function setupSessionCleanup(redis: RedisHelper) {
  // Запускаем очистку каждые 6 часов
  setInterval(async () => {
    try {
      await cleanupExpiredSessions(redis)
    } catch (error) {
      console.error('Session cleanup error:', error)
    }
  }, 6 * 60 * 60 * 1000) // 6 часов
}

async function cleanupExpiredSessions(redis: RedisHelper): Promise<void> {
  const pattern = 'bot:session:*'
  const keys = await redis.keys(pattern)
  
  let cleanedCount = 0
  const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000) // 7 дней назад
  
  for (const key of keys) {
    try {
      const session = await redis.get<SessionData>(key)
      
      if (session?.lastActivity) {
        const lastActivity = new Date(session.lastActivity).getTime()
        
        if (lastActivity < cutoffTime) {
          await redis.del(key)
          cleanedCount++
        }
      }
    } catch (error) {
      // Удаляем поврежденные сессии
      await redis.del(key)
      cleanedCount++
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned up ${cleanedCount} expired sessions`)
  }
}

// Утилиты для работы с сессиями
export class SessionUtils {
  static async getUserSession(redis: RedisHelper, userId: bigint): Promise<SessionData | null> {
    const sessionKey = REDIS_KEYS.BOT_SESSION(`user:${userId}`)
    return await redis.get<SessionData>(sessionKey)
  }

  static async setUserSession(
    redis: RedisHelper, 
    userId: bigint, 
    data: Partial<SessionData>
  ): Promise<void> {
    const sessionKey = REDIS_KEYS.BOT_SESSION(`user:${userId}`)
    const currentSession = await redis.get<SessionData>(sessionKey) || {}
    
    const updatedSession: SessionData = {
      ...currentSession,
      ...data,
      userId,
      lastActivity: new Date()
    }
    
    await redis.setWithTTL(sessionKey, updatedSession, TTL.DAY)
  }

  static async clearUserSession(redis: RedisHelper, userId: bigint): Promise<void> {
    const sessionKey = REDIS_KEYS.BOT_SESSION(`user:${userId}`)
    await redis.del(sessionKey)
  }

  static async setScene(
    redis: RedisHelper, 
    userId: bigint, 
    scene: string, 
    data?: Record<string, any>
  ): Promise<void> {
    await this.setUserSession(redis, userId, { scene, data })
  }

  static async clearScene(redis: RedisHelper, userId: bigint): Promise<void> {
    await this.setUserSession(redis, userId, { scene: undefined, data: undefined })
  }

  static async getScene(redis: RedisHelper, userId: bigint): Promise<{
    scene?: string
    data?: Record<string, any>
  }> {
    const session = await this.getUserSession(redis, userId)
    return {
      scene: session?.scene,
      data: session?.data
    }
  }

  // Для админов
  static async setAdminSession(
    redis: RedisHelper,
    userId: bigint,
    adminId: number,
    data?: Record<string, any>
  ): Promise<void> {
    await this.setUserSession(redis, userId, { 
      adminId, 
      data: { ...data, isAdmin: true }
    })
  }

  static async isAdmin(redis: RedisHelper, userId: bigint): Promise<boolean> {
    const session = await this.getUserSession(redis, userId)
    return session?.adminId !== undefined
  }

  // Статистика сессий
  static async getActiveSessionsCount(redis: RedisHelper): Promise<number> {
    const pattern = 'bot:session:user:*'
    const keys = await redis.keys(pattern)
    
    let activeCount = 0
    const cutoffTime = Date.now() - (30 * 60 * 1000) // 30 минут назад
    
    for (const key of keys) {
      try {
        const session = await redis.get<SessionData>(key)
        if (session?.lastActivity) {
          const lastActivity = new Date(session.lastActivity).getTime()
          if (lastActivity > cutoffTime) {
            activeCount++
          }
        }
      } catch (error) {
        // Игнорируем ошибки при подсчете
      }
    }
    
    return activeCount
  }

  static async getSessionStats(redis: RedisHelper): Promise<{
    total: number
    active: number
    withScenes: number
    adminSessions: number
  }> {
    const pattern = 'bot:session:user:*'
    const keys = await redis.keys(pattern)
    
    let total = keys.length
    let active = 0
    let withScenes = 0
    let adminSessions = 0
    
    const cutoffTime = Date.now() - (30 * 60 * 1000) // 30 минут назад
    
    for (const key of keys) {
      try {
        const session = await redis.get<SessionData>(key)
        
        if (session) {
          if (session.lastActivity) {
            const lastActivity = new Date(session.lastActivity).getTime()
            if (lastActivity > cutoffTime) {
              active++
            }
          }
          
          if (session.scene) {
            withScenes++
          }
          
          if (session.adminId) {
            adminSessions++
          }
        }
      } catch (error) {
        // Игнорируем ошибки
      }
    }
    
    return {
      total,
      active,
      withScenes,
      adminSessions
    }
  }
}