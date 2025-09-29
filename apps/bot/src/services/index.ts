import { PrismaClient } from '@cargo/database'
import { RedisHelper } from '@cargo/config'
import { AdminAuthService, AdminBotMiddleware } from '@cargo/shared'

import { UserService } from './UserService'
import { OrderService } from './OrderService'
import { PaymentService } from './PaymentService'
import { NotificationService } from './NotificationService'
import { CountryService } from './CountryService'
import { SupportService } from './SupportService'

export class BotServices {
  // Основные сервисы
  public readonly user: UserService
  public readonly order: OrderService
  public readonly payment: PaymentService
  public readonly notification: NotificationService
  public readonly country: CountryService
  public readonly support: SupportService
  
  // Админ сервисы
  public readonly adminAuth: AdminAuthService
  public readonly adminMiddleware: AdminBotMiddleware

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: RedisHelper
  ) {
    // Инициализируем основные сервисы
    this.user = new UserService(prisma, redis)
    this.order = new OrderService(prisma, redis)
    this.payment = new PaymentService(prisma, redis)
    this.notification = new NotificationService(prisma, redis)
    this.country = new CountryService(prisma, redis)
    this.support = new SupportService(prisma, redis)
    
    // Инициализируем админ сервисы
    this.adminAuth = new AdminAuthService(redis, prisma, { getAdminDashboardUrl: () => '' })
    this.adminMiddleware = new AdminBotMiddleware(prisma)
  }

  // Метод для проверки здоровья всех сервисов
  async healthCheck(): Promise<{
    database: boolean
    redis: boolean
    services: boolean
  }> {
    try {
      // Проверяем подключение к БД
      await this.prisma.$queryRaw`SELECT 1`
      
      // Проверяем Redis
      const redisOk = await this.redis.ping()
      
      return {
        database: true,
        redis: redisOk,
        services: true
      }
    } catch (error) {
      console.error('Services health check failed:', error)
      return {
        database: false,
        redis: false,
        services: false
      }
    }
  }
}

export * from './UserService'
export * from './OrderService'
export * from './PaymentService'
export * from './NotificationService'
export * from './CountryService'
export * from './SupportService'