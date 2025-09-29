import { PrismaClient } from '@cargo/database'
import { RedisHelper, REDIS_KEYS, TTL } from '@cargo/config'
import { 
  Transaction, 
  TransactionType, 
  TransactionStatus, 
  PaymentMethod,
  TransactionCreateInput 
} from '@cargo/shared'

export class PaymentService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: RedisHelper
  ) {}

  /**
   * Создать транзакцию
   */
  async createTransaction(data: {
    userId: bigint
    orderId?: bigint
    orderType?: 'shipping' | 'purchase'
    amount: number
    type: TransactionType
    paymentMethod?: PaymentMethod
    description?: string
    metadata?: Record<string, any>
  }): Promise<Transaction> {
    const transaction = await this.prisma.transaction.create({
      data: {
        ...data,
        status: TransactionStatus.PENDING
      },
      include: {
        user: true,
        shippingOrder: data.orderType === 'shipping' ? true : undefined,
        purchaseOrder: data.orderType === 'purchase' ? true : undefined
      }
    })

    // Кэшируем транзакцию
    const cacheKey = `transaction:${transaction.id}`
    await this.redis.setWithTTL(cacheKey, transaction, TTL.MEDIUM)

    return transaction
  }

  /**
   * Обновить статус транзакции
   */
  async updateTransactionStatus(
    transactionId: bigint,
    status: TransactionStatus,
    metadata?: Record<string, any>
  ): Promise<Transaction> {
    const updateData: any = {
      status,
      updatedAt: new Date()
    }

    if (status === TransactionStatus.COMPLETED) {
      updateData.completedAt = new Date()
    }

    if (metadata) {
      updateData.metadata = metadata
    }

    const transaction = await this.prisma.transaction.update({
      where: { id: transactionId },
      data: updateData,
      include: {
        user: true,
        shippingOrder: true,
        purchaseOrder: true
      }
    })

    // Если транзакция завершена успешно, обновляем баланс
    if (status === TransactionStatus.COMPLETED) {
      await this.processCompletedTransaction(transaction)
    }

    // Обновляем кэш
    const cacheKey = `transaction:${transactionId}`
    await this.redis.setWithTTL(cacheKey, transaction, TTL.MEDIUM)

    return transaction
  }

  /**
   * Обработать завершенную транзакцию
   */
  private async processCompletedTransaction(transaction: Transaction): Promise<void> {
    const { userId, type, amount } = transaction

    switch (type) {
      case TransactionType.PAYMENT:
        // Пополнение баланса
        await this.updateUserBalance(userId, amount, 'add')
        break

      case TransactionType.REFUND:
      case TransactionType.BONUS:
        // Возврат средств или бонус
        await this.updateUserBalance(userId, amount, 'add')
        break

      case TransactionType.WITHDRAWAL:
        // Списание средств
        await this.updateUserBalance(userId, amount, 'subtract')
        break
    }
  }

  /**
   * Обновить баланс пользователя
   */
  private async updateUserBalance(
    userId: bigint, 
    amount: number, 
    operation: 'add' | 'subtract'
  ): Promise<void> {
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId }
    })

    if (!currentUser) {
      throw new Error('User not found')
    }

    const newBalance = operation === 'add' 
      ? currentUser.balance + amount 
      : currentUser.balance - amount

    if (newBalance < 0 && operation === 'subtract') {
      throw new Error('Insufficient balance')
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { balance: newBalance }
    })

    // Очищаем кэш пользователя
    const userCacheKey = REDIS_KEYS.USER_PROFILE(currentUser.telegramId)
    await this.redis.del(userCacheKey)
  }

  /**
   * Получить транзакции пользователя
   */
  async getUserTransactions(
    userId: bigint,
    filters?: {
      type?: TransactionType[]
      status?: TransactionStatus[]
      limit?: number
      offset?: number
    }
  ): Promise<Transaction[]> {
    const { type, status, limit = 20, offset = 0 } = filters || {}

    const whereClause: any = { userId }

    if (type) {
      whereClause.type = { in: type }
    }

    if (status) {
      whereClause.status = { in: status }
    }

    return await this.prisma.transaction.findMany({
      where: whereClause,
      include: {
        user: true,
        shippingOrder: true,
        purchaseOrder: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })
  }

  /**
   * Получить транзакцию по ID
   */
  async getTransaction(transactionId: bigint): Promise<Transaction | null> {
    // Проверяем кэш
    const cacheKey = `transaction:${transactionId}`
    const cached = await this.redis.get<Transaction>(cacheKey)
    
    if (cached) {
      return cached
    }

    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        user: true,
        shippingOrder: true,
        purchaseOrder: true
      }
    })

    if (transaction) {
      await this.redis.setWithTTL(cacheKey, transaction, TTL.MEDIUM)
    }

    return transaction
  }

  /**
   * Создать платеж для заказа
   */
  async createOrderPayment(
    userId: bigint,
    orderId: bigint,
    orderType: 'shipping' | 'purchase',
    amount: number,
    paymentMethod: PaymentMethod,
    description?: string
  ): Promise<Transaction> {
    return await this.createTransaction({
      userId,
      orderId,
      orderType,
      amount,
      type: TransactionType.PAYMENT,
      paymentMethod,
      description: description || `Оплата заказа #${orderType === 'shipping' ? 'SP' : 'PU'}${orderId}`
    })
  }

  /**
   * Создать возврат средств
   */
  async createRefund(
    userId: bigint,
    originalTransactionId: bigint,
    amount: number,
    reason: string
  ): Promise<Transaction> {
    const originalTransaction = await this.getTransaction(originalTransactionId)
    
    if (!originalTransaction) {
      throw new Error('Original transaction not found')
    }

    return await this.createTransaction({
      userId,
      orderId: originalTransaction.orderId,
      orderType: originalTransaction.orderType as 'shipping' | 'purchase',
      amount,
      type: TransactionType.REFUND,
      description: `Возврат средств: ${reason}`,
      metadata: {
        originalTransactionId: originalTransactionId.toString(),
        reason
      }
    })
  }

  /**
   * Начислить бонус
   */
  async createBonus(
    userId: bigint,
    amount: number,
    reason: string,
    metadata?: Record<string, any>
  ): Promise<Transaction> {
    return await this.createTransaction({
      userId,
      amount,
      type: TransactionType.BONUS,
      description: `Бонус: ${reason}`,
      metadata
    })
  }

  /**
   * Списать средства с баланса
   */
  async createWithdrawal(
    userId: bigint,
    orderId: bigint,
    orderType: 'shipping' | 'purchase',
    amount: number,
    description?: string
  ): Promise<Transaction> {
    // Проверяем достаточность средств
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user || user.balance < amount) {
      throw new Error('Insufficient balance')
    }

    const transaction = await this.createTransaction({
      userId,
      orderId,
      orderType,
      amount,
      type: TransactionType.WITHDRAWAL,
      paymentMethod: PaymentMethod.BALANCE,
      description: description || `Оплата заказа с баланса #${orderType === 'shipping' ? 'SP' : 'PU'}${orderId}`
    })

    // Сразу помечаем как завершенную
    return await this.updateTransactionStatus(
      transaction.id,
      TransactionStatus.COMPLETED
    )
  }

  /**
   * Рассчитать комиссию
   */
  calculateCommission(amount: number, paymentMethod: PaymentMethod): number {
    switch (paymentMethod) {
      case PaymentMethod.CARD:
        return amount * 0.025 // 2.5%
      case PaymentMethod.SBP:
        return amount * 0.007 // 0.7%
      case PaymentMethod.CRYPTO:
      case PaymentMethod.BALANCE:
        return 0
      default:
        return 0
    }
  }

  /**
   * Рассчитать сумму к получению (с учетом комиссии)
   */
  calculateNetAmount(amount: number, paymentMethod: PaymentMethod): {
    gross: number
    commission: number
    net: number
  } {
    const commission = this.calculateCommission(amount, paymentMethod)
    const net = amount - commission

    return {
      gross: amount,
      commission,
      net
    }
  }

  /**
   * Получить статистику платежей
   */
  async getPaymentStats(): Promise<{
    today: {
      amount: number
      count: number
      methods: Record<PaymentMethod, number>
    }
    pending: {
      amount: number
      count: number
    }
    failed: {
      amount: number
      count: number
    }
  }> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [todayStats, pendingStats, failedStats] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: {
          type: TransactionType.PAYMENT,
          status: TransactionStatus.COMPLETED,
          completedAt: { gte: today }
        },
        _sum: { amount: true },
        _count: { id: true }
      }),
      this.prisma.transaction.aggregate({
        where: {
          type: TransactionType.PAYMENT,
          status: TransactionStatus.PENDING
        },
        _sum: { amount: true },
        _count: { id: true }
      }),
      this.prisma.transaction.aggregate({
        where: {
          type: TransactionType.PAYMENT,
          status: TransactionStatus.FAILED
        },
        _sum: { amount: true },
        _count: { id: true }
      })
    ])

    // Статистика по методам оплаты за сегодня
    const methodsStats = await this.prisma.transaction.groupBy({
      by: ['paymentMethod'],
      where: {
        type: TransactionType.PAYMENT,
        status: TransactionStatus.COMPLETED,
        completedAt: { gte: today }
      },
      _sum: { amount: true }
    })

    const methods: Record<PaymentMethod, number> = {
      [PaymentMethod.CARD]: 0,
      [PaymentMethod.SBP]: 0,
      [PaymentMethod.CRYPTO]: 0,
      [PaymentMethod.BALANCE]: 0,
      [PaymentMethod.BANK_TRANSFER]: 0
    }

    methodsStats.forEach(stat => {
      if (stat.paymentMethod && stat._sum.amount) {
        methods[stat.paymentMethod as PaymentMethod] = stat._sum.amount
      }
    })

    return {
      today: {
        amount: todayStats._sum.amount || 0,
        count: todayStats._count.id || 0,
        methods
      },
      pending: {
        amount: pendingStats._sum.amount || 0,
        count: pendingStats._count.id || 0
      },
      failed: {
        amount: failedStats._sum.amount || 0,
        count: failedStats._count.id || 0
      }
    }
  }

  /**
   * Получить баланс пользователя
   */
  async getUserBalance(userId: bigint): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true }
    })

    return user?.balance || 0
  }

  /**
   * Проверить возможность оплаты с баланса
   */
  async canPayFromBalance(userId: bigint, amount: number): Promise<boolean> {
    const balance = await this.getUserBalance(userId)
    return balance >= amount
  }

  /**
   * Создать ссылку на оплату (заглушка для интеграции с платежными системами)
   */
  async createPaymentLink(
    transactionId: bigint,
    amount: number,
    paymentMethod: PaymentMethod,
    description: string
  ): Promise<{
    paymentUrl: string
    paymentId: string
    expiresAt: Date
  }> {
    // В реальной системе здесь будет интеграция с YooKassa, Сбер и т.д.
    const paymentId = `pay_${Date.now()}_${transactionId}`
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 минут

    let paymentUrl = ''
    
    switch (paymentMethod) {
      case PaymentMethod.CARD:
        paymentUrl = `https://yookassa.ru/payments/${paymentId}`
        break
      case PaymentMethod.SBP:
        paymentUrl = `https://sbp.nspk.ru/pay/${paymentId}`
        break
      case PaymentMethod.CRYPTO:
        paymentUrl = `https://crypto-bot.app/payments/${paymentId}`
        break
      default:
        throw new Error(`Payment method ${paymentMethod} not supported`)
    }

    // Сохраняем временные данные платежа
    const tempKey = REDIS_KEYS.PAYMENT_TEMP(paymentId)
    await this.redis.setWithTTL(tempKey, {
      transactionId: transactionId.toString(),
      amount,
      paymentMethod,
      description,
      expiresAt: expiresAt.toISOString()
    }, 15 * 60)

    return {
      paymentUrl,
      paymentId,
      expiresAt
    }
  }
}