import { PrismaClient } from '@cargo/database'
import { RedisHelper, REDIS_KEYS, TTL } from '@cargo/config'
import { ChatStatus, ChatPriority, MessageType } from '@cargo/shared'

export class SupportService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: RedisHelper
  ) {}

  /**
   * Создать новый чат поддержки
   */
  async createSupportChat(data: {
    userId: bigint
    subject?: string
    priority?: ChatPriority
    initialMessage?: string
  }): Promise<any> {
    const { userId, subject, priority = ChatPriority.MEDIUM, initialMessage } = data

    // Проверяем есть ли уже открытый чат у пользователя
    const existingChat = await this.prisma.supportChat.findFirst({
      where: {
        userId,
        status: { in: [ChatStatus.OPEN, ChatStatus.IN_PROGRESS, ChatStatus.WAITING_USER] }
      },
      include: {
        user: true,
        admin: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    })

    if (existingChat) {
      return existingChat
    }

    // Создаем новый чат
    const chat = await this.prisma.supportChat.create({
      data: {
        userId,
        subject,
        priority,
        status: ChatStatus.OPEN
      },
      include: {
        user: true,
        messages: true
      }
    })

    // Добавляем первое сообщение если есть
    if (initialMessage) {
      await this.addMessage({
        chatId: chat.id,
        senderId: userId,
        senderType: 'user',
        message: initialMessage,
        messageType: MessageType.TEXT
      })
    }

    // Добавляем чат в очередь поддержки
    await this.addToSupportQueue(chat.id, priority)

    return chat
  }

  /**
   * Добавить сообщение в чат
   */
  async addMessage(data: {
    chatId: bigint
    senderId: bigint
    senderType: 'user' | 'admin'
    message: string
    messageType?: MessageType
    metadata?: Record<string, any>
  }): Promise<any> {
    const { messageType = MessageType.TEXT } = data

    const message = await this.prisma.chatMessage.create({
      data: {
        ...data,
        messageType
      },
      include: {
        chat: {
          include: {
            user: true,
            admin: true
          }
        }
      }
    })

    // Обновляем статус чата
    if (data.senderType === 'user') {
      await this.updateChatStatus(data.chatId, ChatStatus.WAITING_ADMIN)
    } else {
      await this.updateChatStatus(data.chatId, ChatStatus.WAITING_USER)
    }

    // Отправляем уведомление через WebSocket
    await this.notifyNewMessage(message)

    return message
  }

  /**
   * Получить чат по ID
   */
  async getChatById(chatId: bigint): Promise<any | null> {
    return await this.prisma.supportChat.findUnique({
      where: { id: chatId },
      include: {
        user: true,
        admin: true,
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    })
  }

  /**
   * Получить активный чат пользователя
   */
  async getUserActiveChat(userId: bigint): Promise<any | null> {
    return await this.prisma.supportChat.findFirst({
      where: {
        userId,
        status: { in: [ChatStatus.OPEN, ChatStatus.IN_PROGRESS, ChatStatus.WAITING_USER, ChatStatus.WAITING_ADMIN] }
      },
      include: {
        user: true,
        admin: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 50
        }
      }
    })
  }

  /**
   * Получить чаты пользователя
   */
  async getUserChats(
    userId: bigint,
    options?: {
      limit?: number
      offset?: number
      status?: ChatStatus[]
    }
  ): Promise<{
    chats: any[]
    total: number
  }> {
    const { limit = 10, offset = 0, status } = options || {}

    const whereClause: any = { userId }
    if (status) {
      whereClause.status = { in: status }
    }

    const [chats, total] = await Promise.all([
      this.prisma.supportChat.findMany({
        where: whereClause,
        include: {
          admin: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset
      }),
      this.prisma.supportChat.count({
        where: whereClause
      })
    ])

    return { chats, total }
  }

  /**
   * Назначить админа на чат
   */
  async assignAdmin(chatId: bigint, adminId: number): Promise<any> {
    const chat = await this.prisma.supportChat.update({
      where: { id: chatId },
      data: {
        adminId,
        status: ChatStatus.IN_PROGRESS,
        updatedAt: new Date()
      },
      include: {
        user: true,
        admin: true
      }
    })

    // Убираем чат из очереди
    await this.removeFromSupportQueue(chatId)

    // Добавляем системное сообщение
    await this.addMessage({
      chatId,
      senderId: BigInt(adminId),
      senderType: 'admin',
      message: 'К чату подключился оператор поддержки',
      messageType: MessageType.SYSTEM
    })

    return chat
  }

  /**
   * Закрыть чат
   */
  async closeChat(
    chatId: bigint, 
    closedBy: 'user' | 'admin',
    adminId?: number,
    reason?: string
  ): Promise<any> {
    const chat = await this.prisma.supportChat.update({
      where: { id: chatId },
      data: {
        status: ChatStatus.CLOSED,
        closedAt: new Date(),
        updatedAt: new Date()
      },
      include: {
        user: true,
        admin: true
      }
    })

    // Добавляем системное сообщение о закрытии
    const closeMessage = closedBy === 'user' 
      ? 'Чат закрыт пользователем'
      : `Чат закрыт оператором${reason ? `: ${reason}` : ''}`

    await this.addMessage({
      chatId,
      senderId: adminId ? BigInt(adminId) : chat.userId,
      senderType: closedBy,
      message: closeMessage,
      messageType: MessageType.SYSTEM
    })

    // Убираем из очереди если был там
    await this.removeFromSupportQueue(chatId)

    return chat
  }

  /**
   * Оценить чат
   */
  async rateChat(chatId: bigint, rating: number): Promise<any> {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5')
    }

    return await this.prisma.supportChat.update({
      where: { id: chatId },
      data: { 
        rating,
        updatedAt: new Date()
      }
    })
  }

  /**
   * Обновить статус чата
   */
  async updateChatStatus(chatId: bigint, status: ChatStatus): Promise<void> {
    await this.prisma.supportChat.update({
      where: { id: chatId },
      data: { 
        status,
        updatedAt: new Date()
      }
    })
  }

  /**
   * Получить очередь поддержки
   */
  async getSupportQueue(limit: number = 20): Promise<{
    chats: any[]
    total: number
  }> {
    const [chats, total] = await Promise.all([
      this.prisma.supportChat.findMany({
        where: {
          status: { in: [ChatStatus.OPEN, ChatStatus.WAITING_ADMIN] },
          adminId: null
        },
        include: {
          user: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' }
        ],
        take: limit
      }),
      this.prisma.supportChat.count({
        where: {
          status: { in: [ChatStatus.OPEN, ChatStatus.WAITING_ADMIN] },
          adminId: null
        }
      })
    ])

    return { chats, total }
  }

  /**
   * Получить чаты админа
   */
  async getAdminChats(
    adminId: number,
    options?: {
      status?: ChatStatus[]
      limit?: number
      offset?: number
    }
  ): Promise<{
    chats: any[]
    total: number
  }> {
    const { status, limit = 20, offset = 0 } = options || {}

    const whereClause: any = { adminId }
    if (status) {
      whereClause.status = { in: status }
    }

    const [chats, total] = await Promise.all([
      this.prisma.supportChat.findMany({
        where: whereClause,
        include: {
          user: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 3
          }
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset
      }),
      this.prisma.supportChat.count({
        where: whereClause
      })
    ])

    return { chats, total }
  }

  /**
   * Получить статистику поддержки
   */
  async getSupportStats(): Promise<{
    today: {
      newChats: number
      closedChats: number
      averageResponseTime: number
      averageResolutionTime: number
    }
    active: {
      openChats: number
      inProgressChats: number
      waitingChats: number
    }
    queue: {
      pending: number
      highPriority: number
      averageWaitTime: number
    }
  }> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [newChats, closedChats, activeStats, queueStats] = await Promise.all([
      this.prisma.supportChat.count({
        where: { createdAt: { gte: today } }
      }),
      this.prisma.supportChat.count({
        where: { 
          status: ChatStatus.CLOSED,
          closedAt: { gte: today }
        }
      }),
      this.prisma.supportChat.groupBy({
        by: ['status'],
        where: {
          status: { in: [ChatStatus.OPEN, ChatStatus.IN_PROGRESS, ChatStatus.WAITING_ADMIN, ChatStatus.WAITING_USER] }
        },
        _count: { id: true }
      }),
      this.prisma.supportChat.findMany({
        where: {
          status: { in: [ChatStatus.OPEN, ChatStatus.WAITING_ADMIN] },
          adminId: null
        },
        select: {
          priority: true,
          createdAt: true
        }
      })
    ])

    // Подсчитываем активные чаты по статусам
    const activeByStatus = activeStats.reduce((acc, item) => {
      acc[item.status] = item._count.id
      return acc
    }, {} as Record<string, number>)

    // Подсчитываем очередь
    const highPriorityCount = queueStats.filter(chat => chat.priority >= ChatPriority.HIGH).length
    const averageWaitTime = queueStats.length > 0 
      ? queueStats.reduce((sum, chat) => sum + (Date.now() - chat.createdAt.getTime()), 0) / queueStats.length / (1000 * 60)
      : 0

    return {
      today: {
        newChats,
        closedChats,
        averageResponseTime: 0, // TODO: рассчитать из сообщений
        averageResolutionTime: 0 // TODO: рассчитать из времени закрытия
      },
      active: {
        openChats: activeByStatus[ChatStatus.OPEN] || 0,
        inProgressChats: activeByStatus[ChatStatus.IN_PROGRESS] || 0,
        waitingChats: (activeByStatus[ChatStatus.WAITING_ADMIN] || 0) + (activeByStatus[ChatStatus.WAITING_USER] || 0)
      },
      queue: {
        pending: queueStats.length,
        highPriority: highPriorityCount,
        averageWaitTime: Math.round(averageWaitTime)
      }
    }
  }

  /**
   * Добавить чат в очередь поддержки
   */
  private async addToSupportQueue(chatId: bigint, priority: ChatPriority): Promise<void> {
    const queueData = {
      chatId: chatId.toString(),
      priority,
      timestamp: Date.now()
    }

    await this.redis.lpush(
      REDIS_KEYS.SUPPORT_QUEUE,
      JSON.stringify(queueData)
    )
  }

  /**
   * Убрать чат из очереди поддержки
   */
  private async removeFromSupportQueue(chatId: bigint): Promise<void> {
    // Получаем все элементы очереди
    const queueItems = await this.redis.lrange(REDIS_KEYS.SUPPORT_QUEUE, 0, -1)
    
    // Находим и удаляем нужный чат
    for (const item of queueItems) {
      try {
        const parsed = JSON.parse(item)
        if (parsed.chatId === chatId.toString()) {
          await this.redis.lrem(REDIS_KEYS.SUPPORT_QUEUE, 1, item)
          break
        }
      } catch (error) {
        // Игнорируем некорректные записи
      }
    }
  }

  /**
   * Отправить уведомление о новом сообщении
   */
  private async notifyNewMessage(message: any): Promise<void> {
    const notificationData = {
      type: 'new_support_message',
      chatId: message.chatId.toString(),
      message: {
        id: message.id.toString(),
        senderType: message.senderType,
        message: message.message,
        messageType: message.messageType,
        createdAt: message.createdAt
      },
      chat: {
        id: message.chat.id.toString(),
        userId: message.chat.userId.toString(),
        adminId: message.chat.adminId,
        status: message.chat.status,
        priority: message.chat.priority
      }
    }

    // Отправляем через WebSocket
    await this.redis.publish(
      REDIS_KEYS.REALTIME_SUPPORT,
      JSON.stringify(notificationData)
    )
  }

  /**
   * Поиск по чатам
   */
  async searchChats(
    query: string,
    filters?: {
      status?: ChatStatus[]
      adminId?: number
      userId?: bigint
      priority?: ChatPriority[]
      dateFrom?: Date
      dateTo?: Date
    },
    options?: {
      limit?: number
      offset?: number
    }
  ): Promise<{
    chats: any[]
    total: number
  }> {
    const { limit = 20, offset = 0 } = options || {}
    const { status, adminId, userId, priority, dateFrom, dateTo } = filters || {}

    const whereClause: any = {
      OR: [
        { subject: { contains: query, mode: 'insensitive' } },
        { 
          messages: {
            some: {
              message: { contains: query, mode: 'insensitive' }
            }
          }
        }
      ]
    }

    if (status) whereClause.status = { in: status }
    if (adminId) whereClause.adminId = adminId
    if (userId) whereClause.userId = userId
    if (priority) whereClause.priority = { in: priority }
    if (dateFrom) whereClause.createdAt = { ...whereClause.createdAt, gte: dateFrom }
    if (dateTo) whereClause.createdAt = { ...whereClause.createdAt, lte: dateTo }

    const [chats, total] = await Promise.all([
      this.prisma.supportChat.findMany({
        where: whereClause,
        include: {
          user: true,
          admin: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 3
          }
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset
      }),
      this.prisma.supportChat.count({
        where: whereClause
      })
    ])

    return { chats, total }
  }

  /**
   * Получить FAQ или быстрые ответы
   */
  async getFAQ(): Promise<Array<{
    question: string
    answer: string
    category: string
  }>> {
    // В реальной системе это будет из БД
    return [
      {
        question: 'Как отследить посылку?',
        answer: 'Используйте команду /track или найдите ваш заказ в разделе "Мои заказы"',
        category: 'tracking'
      },
      {
        question: 'Сколько стоит доставка?',
        answer: 'Стоимость зависит от страны и веса. Используйте калькулятор в разделе "Адреса складов"',
        category: 'pricing'
      },
      {
        question: 'Как пополнить баланс?',
        answer: 'Перейдите в раздел "Профиль" → "Пополнить баланс" и выберите удобный способ оплаты',
        category: 'payment'
      }
    ]
  }
}