import { generateId } from '../utils'
import { AdminDashboardAccess } from '../types/admin'

export class AdminAuthService {
  private readonly redisHelper: any
  private readonly prisma: any
  private readonly env: any
  
  constructor(redisHelper: any, prisma: any, env: any) {
    this.redisHelper = redisHelper
    this.prisma = prisma
    this.env = env
  }
  
  /**
   * Генерирует временный токен доступа к админ панели
   */
  async generateDashboardAccess(adminId: number, ipAddress?: string): Promise<AdminDashboardAccess> {
    // Отзываем все предыдущие токены админа
    await this.revokeAdminTokens(adminId)
    
    // Генерируем уникальный токен
    const accessKey = generateId(16)
    const token = generateId(32)
    
    // Время жизни токена: 15 минут
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000)
    
    // Сохраняем в БД
    await this.prisma.adminDashboardToken.create({
      data: {
        adminId,
        token,
        accessKey,
        expiresAt,
        ipAddress
      }
    })
    
    // Также сохраняем в Redis для быстрого доступа
    const tokenData = {
      adminId,
      accessKey,
      expiresAt: expiresAt.toISOString(),
      isUsed: false,
      createdAt: new Date().toISOString(),
      ipAddress
    }
    
    const redisKey = `admin:dashboard:${token}`
    await this.redisHelper.setWithTTL(redisKey, tokenData, 15 * 60)
    
    // Формируем URL для доступа
    const dashboardUrl = `${this.env.getAdminDashboardUrl()}/${token}`
    
    return {
      dashboardUrl,
      accessKey,
      expiresAt,
      instructions: 'Перейдите по ссылке и введите ключ доступа. Ссылка действительна 15 минут.'
    }
  }
  
  /**
   * Проверяет токен доступа и возвращает данные админа
   */
  async validateDashboardToken(token: string, accessKey: string, ipAddress?: string): Promise<{
    valid: boolean
    adminId?: number
    tokenRecord?: any
    error?: string
  }> {
    // Сначала проверяем в Redis (быстро)
    const redisKey = `admin:dashboard:${token}`
    let tokenData = await this.redisHelper.get(redisKey)
    
    // Если в Redis нет, проверяем в БД
    if (!tokenData) {
      const dbToken = await this.prisma.adminDashboardToken.findUnique({
        where: { token },
        include: { admin: true }
      })
      
      if (!dbToken) {
        return { valid: false, error: 'Токен не найден или истек' }
      }
      
      tokenData = {
        adminId: dbToken.adminId,
        accessKey: dbToken.accessKey,
        expiresAt: dbToken.expiresAt.toISOString(),
        isUsed: dbToken.isUsed,
        createdAt: dbToken.createdAt.toISOString()
      }
    }
    
    // Проверяем ключ доступа
    if (tokenData.accessKey !== accessKey) {
      return { valid: false, error: 'Неверный ключ доступа' }
    }
    
    // Проверяем не использован ли токен
    if (tokenData.isUsed) {
      return { valid: false, error: 'Токен уже был использован' }
    }
    
    // Проверяем срок действия
    if (new Date() > new Date(tokenData.expiresAt)) {
      await this.markTokenAsExpired(token)
      return { valid: false, error: 'Токен истек' }
    }
    
    // Получаем полную запись токена из БД
    const tokenRecord = await this.prisma.adminDashboardToken.findUnique({
      where: { token },
      include: { admin: true }
    })
    
    return {
      valid: true,
      adminId: tokenData.adminId,
      tokenRecord
    }
  }
  
  /**
   * Помечает токен как использованный
   */
  async markTokenAsUsed(token: string, ipAddress?: string): Promise<void> {
    // Обновляем в БД
    await this.prisma.adminDashboardToken.updateMany({
      where: { token },
      data: {
        isUsed: true,
        usedAt: new Date(),
        ipAddress
      }
    })
    
    // Удаляем из Redis
    const redisKey = `admin:dashboard:${token}`
    await this.redisHelper.del(redisKey)
  }
  
  /**
   * Помечает токен как истекший
   */
  async markTokenAsExpired(token: string): Promise<void> {
    await this.redisHelper.del(`admin:dashboard:${token}`)
  }
  
  /**
   * Отзывает все активные токены админа
   */
  async revokeAdminTokens(adminId: number): Promise<void> {
    // Помечаем в БД как использованные
    await this.prisma.adminDashboardToken.updateMany({
      where: {
        adminId,
        isUsed: false,
        expiresAt: { gt: new Date() }
      },
      data: {
        isUsed: true,
        usedAt: new Date()
      }
    })
    
    // Очищаем Redis
    const adminKey = `admin:pending:${adminId}`
    const activeToken = await this.redisHelper.get(adminKey)
    
    if (activeToken) {
      const tokenKey = `admin:dashboard:${activeToken}`
      await this.redisHelper.del(tokenKey)
      await this.redisHelper.del(adminKey)
    }
  }
  
  /**
   * Создает веб-сессию после успешной авторизации
   */
  async createWebSession(adminId: number, ipAddress?: string, userAgent?: string): Promise<{
    sessionId: string
    accessToken: string
    refreshToken: string
    expiresAt: Date
  }> {
    const sessionId = generateId(32)
    const accessToken = generateId(64)
    const refreshToken = generateId(64)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 дней
    
    const sessionData = {
      sessionId,
      adminId,
      accessToken,
      refreshToken,
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      ipAddress,
      userAgent
    }
    
    // Сохраняем сессию в Redis
    await this.redisHelper.setWithTTL(
      `admin:web_session:${sessionId}`,
      sessionData,
      7 * 24 * 60 * 60 // 7 дней
    )
    
    // Сохраняем refresh token отдельно
    await this.redisHelper.setWithTTL(
      `admin:refresh:${refreshToken}`,
      { sessionId, adminId },
      30 * 24 * 60 * 60 // 30 дней
    )
    
    return {
      sessionId,
      accessToken,
      refreshToken,
      expiresAt
    }
  }
  
  /**
   * Проверяет веб-сессию
   */
  async validateWebSession(sessionId: string): Promise<{
    valid: boolean
    admin?: any
    session?: any
  }> {
    const sessionData = await this.redisHelper.get(`admin:web_session:${sessionId}`)
    
    if (!sessionData) {
      return { valid: false }
    }
    
    if (new Date() > new Date(sessionData.expiresAt)) {
      await this.redisHelper.del(`admin:web_session:${sessionId}`)
      return { valid: false }
    }
    
    // Получаем данные админа
    const admin = await this.prisma.admin.findUnique({
      where: { id: sessionData.adminId }
    })
    
    if (!admin || !admin.isActive) {
      await this.redisHelper.del(`admin:web_session:${sessionId}`)
      return { valid: false }
    }
    
    // Обновляем последнюю активность
    sessionData.lastActivity = new Date().toISOString()
    await this.redisHelper.setWithTTL(
      `admin:web_session:${sessionId}`,
      sessionData,
      7 * 24 * 60 * 60
    )
    
    return {
      valid: true,
      admin,
      session: sessionData
    }
  }
}
}

// Утилиты для форматирования сообщений бота
export class AdminBotMessages {
  static dashboardAccess(access: AdminDashboardAccess): string {
    const expiresIn = Math.floor((access.expiresAt.getTime() - Date.now()) / 60000)
    
    return `🔐 **Доступ к админ панели**

**🔗 Ссылка для подключения:**
${access.dashboardUrl}

**🔑 Ключ доступа:**
\`${access.accessKey}\`

⏰ **Срок действия:** ${expiresIn} минут

📝 **Инструкция:**
1. Перейдите по ссылке выше
2. Введите ключ доступа
3. Войдите в админ панель

⚠️ **Важно:**
• Ссылка одноразовая
• Не делитесь ключом с другими
• После входа ссылка станет недействительной`
  }
  
  static accessDenied(role?: string): string {
    return `❌ **Доступ запрещен**

У вас нет прав доступа к админ панели.
${role ? `Ваша роль: ${role}` : ''}

Обратитесь к главному администратору для получения доступа.`
  }
  
  static tokenExpired(): string {
    return `⏰ **Токен истек**

Ваш токен доступа истек. Запросите новый командой /dashboard`
  }
  
  static tokenAlreadyUsed(): string {
    return `🔒 **Токен уже использован**

Этот токен уже был использован для входа. Запросите новый командой /dashboard`
  }
}

// Middleware для проверки админ прав в боте
export class AdminBotMiddleware {
  private prisma: any // Будет инжектиться
  
  constructor(prisma: any) {
    this.prisma = prisma
  }
  
  /**
   * Проверяет является ли пользователь админом
   */
  async checkAdminAccess(telegramId: bigint): Promise<{
    isAdmin: boolean
    admin?: any
    error?: string
  }> {
    try {
      const admin = await this.prisma.admin.findUnique({
        where: {
          telegramId,
          isActive: true
        }
      })
      
      if (!admin) {
        return {
          isAdmin: false,
          error: 'Не найден в списке администраторов'
        }
      }
      
      return {
        isAdmin: true,
        admin
      }
    } catch (error) {
      return {
        isAdmin: false,
        error: 'Ошибка проверки прав доступа'
      }
    }
  }
  
  /**
   * Проверяет права доступа к определенному действию
   */
  checkPermission(admin: any, action: string): boolean {
    // Супер админ имеет все права
    if (admin.role === 'SUPER_ADMIN') {
      return true
    }
    
    // Проверяем права в permissions объекте
    const permissions = admin.permissions || {}
    
    // Простая проверка прав (можно расширить)
    switch (action) {
      case 'dashboard_access':
        return ['SUPER_ADMIN', 'ORDER_MANAGER', 'FINANCE_MANAGER'].includes(admin.role)
      case 'orders_manage':
        return permissions.orders?.manage || admin.role === 'ORDER_MANAGER'
      case 'users_manage':
        return permissions.users?.manage || admin.role === 'SUPER_ADMIN'
      case 'finance_view':
        return permissions.finance?.view || ['SUPER_ADMIN', 'FINANCE_MANAGER'].includes(admin.role)
      default:
        return false
    }
  }
}