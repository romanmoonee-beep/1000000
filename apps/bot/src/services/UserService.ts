import { PrismaClient } from '@cargo/database'
import { RedisHelper, REDIS_KEYS, TTL } from '@cargo/config'
import { User, UserCreateInput, UserUpdateInput, UserSession } from '@cargo/shared'

export class UserService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: RedisHelper
  ) {}

  /**
   * Получить пользователя по Telegram ID
   */
  async getByTelegramId(telegramId: bigint): Promise<User | null> {
    // Сначала проверяем кэш
    const cacheKey = REDIS_KEYS.USER_PROFILE(telegramId)
    const cached = await this.redis.get<User>(cacheKey)
    
    if (cached) {
      return cached
    }

    // Если в кэше нет, получаем из БД
    const user = await this.prisma.user.findUnique({
      where: { telegramId },
      include: {
        city: true,
        addresses: true
      }
    })

    if (user) {
      // Кэшируем на 30 минут
      await this.redis.setWithTTL(cacheKey, user, TTL.MEDIUM)
    }

    return user
  }

  /**
   * Создать нового пользователя
   */
  async create(data: UserCreateInput): Promise<User> {
    const user = await this.prisma.user.create({
      data,
      include: {
        city: true,
        addresses: true
      }
    })

    // Кэшируем созданного пользователя
    const cacheKey = REDIS_KEYS.USER_PROFILE(user.telegramId)
    await this.redis.setWithTTL(cacheKey, user, TTL.MEDIUM)

    return user
  }

  /**
   * Обновить пользователя
   */
  async update(telegramId: bigint, data: UserUpdateInput): Promise<User> {
    const user = await this.prisma.user.update({
      where: { telegramId },
      data: {
        ...data,
        lastActivity: new Date()
      },
      include: {
        city: true,
        addresses: true
      }
    })

    // Обновляем кэш
    const cacheKey = REDIS_KEYS.USER_PROFILE(telegramId)
    await this.redis.setWithTTL(cacheKey, user, TTL.MEDIUM)

    return user
  }

  /**
   * Обновить последнюю активность
   */
  async updateLastActivity(telegramId: bigint): Promise<void> {
    await this.prisma.user.update({
      where: { telegramId },
      data: { lastActivity: new Date() }
    })

    // Обновляем кэш последней активности
    const cacheKey = REDIS_KEYS.USER_PROFILE(telegramId)
    const cached = await this.redis.get<User>(cacheKey)
    
    if (cached) {
      cached.lastActivity = new Date()
      await this.redis.setWithTTL(cacheKey, cached, TTL.MEDIUM)
    }
  }

  /**
   * Проверить существует ли пользователь
   */
  async exists(telegramId: bigint): Promise<boolean> {
    const user = await this.getByTelegramId(telegramId)
    return user !== null
  }

  /**
   * Получить или создать пользователя
   */
  async getOrCreate(telegramData: {
    telegramId: bigint
    username?: string
    firstName?: string
    lastName?: string
  }): Promise<User> {
    let user = await this.getByTelegramId(telegramData.telegramId)

    if (!user) {
      user = await this.create({
        telegramId: telegramData.telegramId,
        username: telegramData.username,
        firstName: telegramData.firstName,
        lastName: telegramData.lastName
      })
    } else {
      // Обновляем данные если они изменились
      const needsUpdate = 
        user.username !== telegramData.username ||
        user.firstName !== telegramData.firstName ||
        user.lastName !== telegramData.lastName

      if (needsUpdate) {
        user = await this.update(telegramData.telegramId, {
          username: telegramData.username,
          firstName: telegramData.firstName,
          lastName: telegramData.lastName
        })
      } else {
        // Просто обновляем активность
        await this.updateLastActivity(telegramData.telegramId)
      }
    }

    return user
  }

  /**
   * Получить баланс пользователя
   */
  async getBalance(telegramId: bigint): Promise<number> {
    const user = await this.getByTelegramId(telegramId)
    return user?.balance || 0
  }

  /**
   * Обновить баланс пользователя
   */
  async updateBalance(telegramId: bigint, amount: number, operation: 'add' | 'subtract'): Promise<User> {
    const currentUser = await this.getByTelegramId(telegramId)
    if (!currentUser) {
      throw new Error('User not found')
    }

    const newBalance = operation === 'add' 
      ? currentUser.balance + amount 
      : currentUser.balance - amount

    if (newBalance < 0) {
      throw new Error('Insufficient balance')
    }

    const user = await this.prisma.user.update({
      where: { telegramId },
      data: { balance: newBalance },
      include: {
        city: true,
        addresses: true
      }
    })

    // Обновляем кэш
    const cacheKey = REDIS_KEYS.USER_PROFILE(telegramId)
    await this.redis.setWithTTL(cacheKey, user, TTL.MEDIUM)

    return user
  }

  /**
   * Получить статистику пользователя
   */
  async getUserStats(telegramId: bigint): Promise<{
    totalOrders: number
    completedOrders: number
    totalSpent: number
    averageOrderValue: number
    registrationDays: number
  }> {
    const user = await this.getByTelegramId(telegramId)
    if (!user) {
      throw new Error('User not found')
    }

    const [shippingStats, purchaseStats] = await Promise.all([
      this.prisma.shippingOrder.aggregate({
        where: { userId: user.id },
        _count: { id: true },
        _sum: { totalCost: true }
      }),
      this.prisma.purchaseOrder.aggregate({
        where: { userId: user.id },
        _count: { id: true },
        _sum: { totalCost: true }
      })
    ])

    const totalOrders = (shippingStats._count.id || 0) + (purchaseStats._count.id || 0)
    const totalSpent = (shippingStats._sum.totalCost || 0) + (purchaseStats._sum.totalCost || 0)
    
    // Считаем завершенные заказы
    const [completedShipping, completedPurchase] = await Promise.all([
      this.prisma.shippingOrder.count({
        where: { 
          userId: user.id,
          status: 'DELIVERED'
        }
      }),
      this.prisma.purchaseOrder.count({
        where: { 
          userId: user.id,
          status: 'DELIVERED'
        }
      })
    ])

    const completedOrders = completedShipping + completedPurchase
    const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0
    const registrationDays = Math.ceil(
      (Date.now() - user.registrationDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    return {
      totalOrders,
      completedOrders,
      totalSpent,
      averageOrderValue,
      registrationDays
    }
  }

  /**
   * Управление сессией пользователя
   */
  async getSession(telegramId: bigint): Promise<UserSession | null> {
    const sessionKey = REDIS_KEYS.USER_SESSION(telegramId)
    return await this.redis.get<UserSession>(sessionKey)
  }

  async setSession(telegramId: bigint, session: Partial<UserSession>): Promise<void> {
    const sessionKey = REDIS_KEYS.USER_SESSION(telegramId)
    const currentSession = await this.getSession(telegramId) || {}
    
    const updatedSession: UserSession = {
      ...currentSession,
      ...session,
      userId: telegramId,
      lastActivity: new Date()
    }

    await this.redis.setWithTTL(sessionKey, updatedSession, TTL.LONG)
  }

  async clearSession(telegramId: bigint): Promise<void> {
    const sessionKey = REDIS_KEYS.USER_SESSION(telegramId)
    await this.redis.del(sessionKey)
  }

  /**
   * Управление VIP статусом
   */
  async makeVip(telegramId: bigint, expiresAt: Date): Promise<User> {
    const user = await this.update(telegramId, {
      isVip: true,
      vipExpiresAt: expiresAt
    })

    return user
  }

  async removeVip(telegramId: bigint): Promise<User> {
    const user = await this.update(telegramId, {
      isVip: false,
      vipExpiresAt: null
    })

    return user
  }

  /**
   * Проверить истек ли VIP статус
   */
  async checkVipExpiration(telegramId: bigint): Promise<boolean> {
    const user = await this.getByTelegramId(telegramId)
    
    if (!user || !user.isVip || !user.vipExpiresAt) {
      return false
    }

    if (new Date() > user.vipExpiresAt) {
      // VIP истек, убираем статус
      await this.removeVip(telegramId)
      return true // истек
    }

    return false // еще действует
  }

  /**
   * Добавить пользователя в онлайн
   */
  async addOnline(telegramId: bigint): Promise<void> {
    await this.redis.sadd(REDIS_KEYS.ONLINE_USERS, telegramId.toString())
    // Устанавливаем TTL на ключ пользователя
    await this.redis.setWithTTL(
      `online:user:${telegramId}`, 
      Date.now().toString(), 
      TTL.SHORT
    )
  }

  /**
   * Убрать пользователя из онлайна
   */
  async removeOnline(telegramId: bigint): Promise<void> {
    await this.redis.srem(REDIS_KEYS.ONLINE_USERS, telegramId.toString())
    await this.redis.del(`online:user:${telegramId}`)
  }

  /**
   * Получить количество онлайн пользователей
   */
  async getOnlineCount(): Promise<number> {
    const members = await this.redis.smembers(REDIS_KEYS.ONLINE_USERS)
    return members.length
  }

  /**
   * Очистка кэша пользователя
   */
  async clearCache(telegramId: bigint): Promise<void> {
    const cacheKey = REDIS_KEYS.USER_PROFILE(telegramId)
    await this.redis.del(cacheKey)
  }
}