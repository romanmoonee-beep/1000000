import { PrismaClient } from '@cargo/database'
import { RedisHelper, REDIS_KEYS, TTL } from '@cargo/config'
import { NotificationType } from '@cargo/shared'

export class NotificationService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: RedisHelper
  ) {}

  /**
   * Создать уведомление
   */
  async createNotification(data: {
    userId: bigint
    title: string
    message: string
    type: string
    metadata?: Record<string, any>
  }): Promise<void> {
    await this.prisma.notification.create({
      data
    })

    // Увеличиваем счетчик непрочитанных уведомлений
    const unreadKey = `unread_notifications:${data.userId}`
    await this.redis.incr(unreadKey)
  }

  /**
   * Отправить уведомление об обновлении статуса заказа
   */
  async sendOrderStatusUpdate(
    userId: bigint,
    orderId: bigint,
    orderType: 'shipping' | 'purchase',
    oldStatus: string,
    newStatus: string,
    customMessage?: string
  ): Promise<void> {
    const orderPrefix = orderType === 'shipping' ? 'SP' : 'PU'
    const orderNumber = `#${orderPrefix}${orderId}`

    let title = `Статус заказа ${orderNumber} изменен`
    let message = customMessage || this.getStatusMessage(newStatus, orderType)

    await this.createNotification({
      userId,
      title,
      message,
      type: NotificationType.ORDER_STATUS_UPDATE,
      metadata: {
        orderId: orderId.toString(),
        orderType,
        oldStatus,
        newStatus
      }
    })

    // Отправляем push уведомление через очередь
    await this.queuePushNotification(userId, title, message, {
      orderId: orderId.toString(),
      orderType
    })
  }

  /**
   * Уведомление об успешной оплате
   */
  async sendPaymentReceived(
    userId: bigint,
    amount: number,
    orderId?: bigint,
    orderType?: 'shipping' | 'purchase'
  ): Promise<void> {
    const title = 'Платеж получен'
    let message = `Успешно получен платеж на сумму ${amount.toLocaleString('ru-RU')}₽`

    if (orderId && orderType) {
      const orderPrefix = orderType === 'shipping' ? 'SP' : 'PU'
      message += ` за заказ #${orderPrefix}${orderId}`
    }

    await this.createNotification({
      userId,
      title,
      message,
      type: NotificationType.PAYMENT_RECEIVED,
      metadata: {
        amount,
        orderId: orderId?.toString(),
        orderType
      }
    })

    await this.queuePushNotification(userId, title, message)
  }

  /**
   * Уведомление о неудачной оплате
   */
  async sendPaymentFailed(
    userId: bigint,
    amount: number,
    reason: string,
    orderId?: bigint,
    orderType?: 'shipping' | 'purchase'
  ): Promise<void> {
    const title = 'Ошибка оплаты'
    let message = `Не удалось обработать платеж на сумму ${amount.toLocaleString('ru-RU')}₽. ${reason}`

    if (orderId && orderType) {
      const orderPrefix = orderType === 'shipping' ? 'SP' : 'PU'
      message += ` для заказа #${orderPrefix}${orderId}`
    }

    await this.createNotification({
      userId,
      title,
      message,
      type: NotificationType.PAYMENT_FAILED,
      metadata: {
        amount,
        reason,
        orderId: orderId?.toString(),
        orderType
      }
    })

    await this.queuePushNotification(userId, title, message)
  }

  /**
   * Уведомление о доставке
   */
  async sendOrderDelivered(
    userId: bigint,
    orderId: bigint,
    orderType: 'shipping' | 'purchase'
  ): Promise<void> {
    const orderPrefix = orderType === 'shipping' ? 'SP' : 'PU'
    const orderNumber = `#${orderPrefix}${orderId}`

    const title = 'Заказ доставлен!'
    const message = `Ваш заказ ${orderNumber} успешно доставлен. Спасибо за использование наших услуг!`

    await this.createNotification({
      userId,
      title,
      message,
      type: NotificationType.ORDER_DELIVERED,
      metadata: {
        orderId: orderId.toString(),
        orderType
      }
    })

    await this.queuePushNotification(userId, title, message)
  }

  /**
   * Уведомление об истечении VIP статуса
   */
  async sendVipExpired(userId: bigint): Promise<void> {
    const title = 'VIP статус истек'
    const message = 'Ваш VIP статус истек. Продлите подписку для получения скидок и приоритетной поддержки.'

    await this.createNotification({
      userId,
      title,
      message,
      type: NotificationType.VIP_EXPIRED
    })

    await this.queuePushNotification(userId, title, message)
  }

  /**
   * Уведомление о низком балансе
   */
  async sendLowBalance(userId: bigint, currentBalance: number): Promise<void> {
    const title = 'Низкий баланс'
    const message = `На вашем балансе осталось ${currentBalance.toLocaleString('ru-RU')}₽. Пополните баланс для оплаты заказов.`

    await this.createNotification({
      userId,
      title,
      message,
      type: NotificationType.BALANCE_LOW,
      metadata: {
        balance: currentBalance
      }
    })

    await this.queuePushNotification(userId, title, message)
  }

  /**
   * Системное уведомление
   */
  async sendSystemNotification(
    userId: bigint,
    title: string,
    message: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.createNotification({
      userId,
      title,
      message,
      type: NotificationType.SYSTEM_MAINTENANCE,
      metadata
    })

    await this.queuePushNotification(userId, title, message, metadata)
  }

  /**
   * Массовая рассылка
   */
  async sendBroadcast(
    userIds: bigint[],
    title: string,
    message: string,
    type: string = NotificationType.PROMOTION,
    metadata?: Record<string, any>
  ): Promise<void> {
    // Создаем уведомления пачками
    const batchSize = 100
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize)
      
      const notifications = batch.map(userId => ({
        userId,
        title,
        message,
        type,
        metadata
      }))

      await this.prisma.notification.createMany({
        data: notifications
      })

      // Добавляем в очередь уведомлений
      for (const userId of batch) {
        await this.queuePushNotification(userId, title, message, metadata)
      }
    }
  }

  /**
   * Получить уведомления пользователя
   */
  async getUserNotifications(
    userId: bigint,
    options?: {
      limit?: number
      offset?: number
      unreadOnly?: boolean
    }
  ): Promise<{
    notifications: any[]
    unreadCount: number
    total: number
  }> {
    const { limit = 20, offset = 0, unreadOnly = false } = options || {}

    const whereClause: any = { userId }
    if (unreadOnly) {
      whereClause.isRead = false
    }

    const [notifications, unreadCount, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      this.prisma.notification.count({
        where: { userId, isRead: false }
      }),
      this.prisma.notification.count({
        where: { userId }
      })
    ])

    return {
      notifications,
      unreadCount,
      total
    }
  }

  /**
   * Пометить уведомления как прочитанные
   */
  async markAsRead(userId: bigint, notificationIds?: bigint[]): Promise<void> {
    const whereClause: any = { userId }
    
    if (notificationIds) {
      whereClause.id = { in: notificationIds }
    }

    await this.prisma.notification.updateMany({
      where: whereClause,
      data: { isRead: true }
    })

    // Сбрасываем счетчик непрочитанных
    if (!notificationIds) {
      const unreadKey = `unread_notifications:${userId}`
      await this.redis.del(unreadKey)
    }
  }

  /**
   * Получить количество непрочитанных уведомлений
   */
  async getUnreadCount(userId: bigint): Promise<number> {
    const unreadKey = `unread_notifications:${userId}`
    const cached = await this.redis.get(unreadKey)
    
    if (cached !== null) {
      return parseInt(cached.toString())
    }

    // Если в кэше нет, считаем из БД
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false }
    })

    await this.redis.setWithTTL(unreadKey, count.toString(), TTL.MEDIUM)
    return count
  }

  /**
   * Добавить уведомление в очередь для отправки
   */
  private async queuePushNotification(
    userId: bigint,
    title: string,
    message: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const notificationData = {
      userId: userId.toString(),
      title,
      message,
      metadata,
      timestamp: Date.now()
    }

    await this.redis.lpush(
      REDIS_KEYS.NOTIFICATION_QUEUE,
      JSON.stringify(notificationData)
    )
  }

  /**
   * Получить сообщение для статуса заказа
   */
  private getStatusMessage(status: string, orderType: 'shipping' | 'purchase'): string {
    const messages: Record<string, string> = {
      // Доставка посылок
      'CREATED': 'Заказ создан и ожидает оплаты',
      'PAID': 'Оплата получена, заказ принят в работу',
      'WAREHOUSE_RECEIVED': 'Посылка получена на складе',
      'PROCESSING': 'Посылка обрабатывается на складе',
      'SHIPPED': 'Посылка отправлена в Россию',
      'CUSTOMS': 'Посылка проходит таможенное оформление',
      'IN_TRANSIT': 'Посылка в пути к пункту выдачи',
      'READY_PICKUP': 'Посылка готова к получению',
      'DELIVERED': 'Заказ успешно доставлен',
      'PROBLEM': 'Возникла проблема с заказом',
      'CANCELLED': 'Заказ отменен',

      // Выкуп товаров
      'PURCHASING': 'Выкупаем товар',
      'PURCHASED': 'Товар выкуплен и готовится к отправке',
      'REFUNDED': 'Средства возвращены'
    }

    return messages[status] || `Статус изменен на: ${status}`
  }

  /**
   * Очистить старые уведомления
   */
  async cleanupOldNotifications(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    const result = await this.prisma.notification.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        isRead: true
      }
    })

    return result.count
  }

  /**
   * Получить статистику уведомлений
   */
  async getNotificationStats(): Promise<{
    total: number
    unread: number
    byType: Record<string, number>
    todayCount: number
  }> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [total, unread, byType, todayCount] = await Promise.all([
      this.prisma.notification.count(),
      this.prisma.notification.count({ where: { isRead: false } }),
      this.prisma.notification.groupBy({
        by: ['type'],
        _count: { id: true }
      }),
      this.prisma.notification.count({
        where: { createdAt: { gte: today } }
      })
    ])

    const typeStats: Record<string, number> = {}
    byType.forEach(item => {
      typeStats[item.type] = item._count.id
    })

    return {
      total,
      unread,
      byType: typeStats,
      todayCount
    }
  }
}