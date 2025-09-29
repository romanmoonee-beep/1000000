import { PrismaClient } from '@cargo/database'
import { RedisHelper, REDIS_KEYS, TTL } from '@cargo/config'
import { 
  ShippingOrder, 
  PurchaseOrder, 
  OrderStatus, 
  PurchaseOrderStatus,
  ShippingOrderCreateInput,
  PurchaseOrderCreateInput 
} from '@cargo/shared'

export class OrderService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: RedisHelper
  ) {}

  /**
   * Создать заказ на доставку посылки
   */
  async createShippingOrder(data: {
    userId: bigint
    countryFromId: number
    weight: number
    declaredValue?: number
    declaredCurrency?: string
    description?: string
    recipientName: string
    recipientPhone: string
    recipientAddress: string
    totalCost: number
  }): Promise<ShippingOrder> {
    const order = await this.prisma.shippingOrder.create({
      data: {
        ...data,
        declaredCurrency: data.declaredCurrency || 'USD',
        status: OrderStatus.CREATED
      },
      include: {
        user: true,
        countryFrom: true
      }
    })

    // Создаем запись в истории статусов
    await this.createStatusHistory({
      orderId: order.id,
      orderType: 'shipping',
      newStatus: OrderStatus.CREATED,
      comment: 'Заказ создан'
    })

    // Кэшируем заказ
    await this.cacheOrder(order.id, order, 'shipping')

    return order
  }

  /**
   * Создать заказ на выкуп товара
   */
  async createPurchaseOrder(data: {
    userId: bigint
    countryId: number
    productId?: number
    productUrl?: string
    productName: string
    quantity: number
    productPrice: number
    productCurrency?: string
    commission: number
    prepaymentAmount: number
    customerNotes?: string
  }): Promise<PurchaseOrder> {
    const totalCost = data.productPrice + data.commission

    const order = await this.prisma.purchaseOrder.create({
      data: {
        ...data,
        productCurrency: data.productCurrency || 'USD',
        totalCost,
        status: 'CREATED' as any
      },
      include: {
        user: true,
        country: true,
        product: true
      }
    })

    // Создаем запись в истории статусов
    await this.createStatusHistory({
      orderId: order.id,
      orderType: 'purchase',
      newStatus: 'CREATED',
      comment: 'Заявка на выкуп создана'
    })

    // Кэшируем заказ
    await this.cacheOrder(order.id, order, 'purchase')

    return order
  }

  /**
   * Получить заказ по ID
   */
  async getShippingOrder(orderId: bigint): Promise<ShippingOrder | null> {
    // Проверяем кэш
    const cached = await this.getCachedOrder(orderId, 'shipping')
    if (cached) return cached

    const order = await this.prisma.shippingOrder.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        countryFrom: true,
        statusHistory: {
          orderBy: { createdAt: 'desc' }
        },
        transactions: true
      }
    })

    if (order) {
      await this.cacheOrder(orderId, order, 'shipping')
    }

    return order
  }

  async getPurchaseOrder(orderId: bigint): Promise<PurchaseOrder | null> {
    // Проверяем кэш
    const cached = await this.getCachedOrder(orderId, 'purchase')
    if (cached) return cached

    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        country: true,
        product: true,
        statusHistory: {
          orderBy: { createdAt: 'desc' }
        },
        transactions: true
      }
    })

    if (order) {
      await this.cacheOrder(orderId, order, 'purchase')
    }

    return order
  }

  /**
   * Получить заказы пользователя
   */
  async getUserOrders(userId: bigint, filters?: {
    status?: string[]
    type?: 'shipping' | 'purchase' | 'all'
    limit?: number
    offset?: number
  }): Promise<{
    shipping: ShippingOrder[]
    purchase: PurchaseOrder[]
    total: number
  }> {
    const { status, type = 'all', limit = 20, offset = 0 } = filters || {}

    const whereClause = {
      userId,
      ...(status && { status: { in: status } })
    }

    let shipping: ShippingOrder[] = []
    let purchase: PurchaseOrder[] = []

    if (type === 'all' || type === 'shipping') {
      shipping = await this.prisma.shippingOrder.findMany({
        where: whereClause,
        include: {
          countryFrom: true,
          user: true
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      })
    }

    if (type === 'all' || type === 'purchase') {
      purchase = await this.prisma.purchaseOrder.findMany({
        where: whereClause,
        include: {
          country: true,
          user: true,
          product: true
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      })
    }

    const total = shipping.length + purchase.length

    return { shipping, purchase, total }
  }

  /**
   * Обновить статус заказа
   */
  async updateShippingOrderStatus(
    orderId: bigint, 
    newStatus: OrderStatus, 
    comment?: string,
    adminId?: number
  ): Promise<ShippingOrder> {
    const currentOrder = await this.getShippingOrder(orderId)
    if (!currentOrder) {
      throw new Error('Order not found')
    }

    const updatedOrder = await this.prisma.shippingOrder.update({
      where: { id: orderId },
      data: { 
        status: newStatus,
        updatedAt: new Date()
      },
      include: {
        user: true,
        countryFrom: true
      }
    })

    // Создаем запись в истории
    await this.createStatusHistory({
      orderId,
      orderType: 'shipping',
      oldStatus: currentOrder.status,
      newStatus,
      comment,
      adminId
    })

    // Обновляем кэш
    await this.cacheOrder(orderId, updatedOrder, 'shipping')

    return updatedOrder
  }

  async updatePurchaseOrderStatus(
    orderId: bigint, 
    newStatus: PurchaseOrderStatus, 
    comment?: string,
    adminId?: number
  ): Promise<PurchaseOrder> {
    const currentOrder = await this.getPurchaseOrder(orderId)
    if (!currentOrder) {
      throw new Error('Order not found')
    }

    const updatedOrder = await this.prisma.purchaseOrder.update({
      where: { id: orderId },
      data: { 
        status: newStatus as any,
        updatedAt: new Date()
      },
      include: {
        user: true,
        country: true,
        product: true
      }
    })

    // Создаем запись в истории
    await this.createStatusHistory({
      orderId,
      orderType: 'purchase',
      oldStatus: currentOrder.status,
      newStatus: newStatus as string,
      comment,
      adminId
    })

    // Обновляем кэш
    await this.cacheOrder(orderId, updatedOrder, 'purchase')

    return updatedOrder
  }

  /**
   * Добавить трек-номер к заказу
   */
  async addTrackingNumber(
    orderId: bigint,
    trackNumber: string,
    orderType: 'shipping' | 'purchase'
  ): Promise<void> {
    if (orderType === 'shipping') {
      await this.prisma.shippingOrder.update({
        where: { id: orderId },
        data: { trackNumber }
      })
    } else {
      await this.prisma.purchaseOrder.update({
        where: { id: orderId },
        data: { trackNumber }
      })
    }

    // Очищаем кэш заказа
    await this.clearOrderCache(orderId, orderType)
  }

  /**
   * Получить активные заказы пользователя
   */
  async getActiveUserOrders(userId: bigint): Promise<{
    shipping: ShippingOrder[]
    purchase: PurchaseOrder[]
    count: number
  }> {
    const activeStatuses = [
      OrderStatus.CREATED,
      OrderStatus.PAID,
      OrderStatus.WAREHOUSE_RECEIVED,
      OrderStatus.PROCESSING,
      OrderStatus.SHIPPED,
      OrderStatus.CUSTOMS,
      OrderStatus.IN_TRANSIT,
      OrderStatus.READY_PICKUP
    ]

    const activePurchaseStatuses = [
      'CREATED',
      'PAID',
      'PURCHASING',
      'PURCHASED',
      'WAREHOUSE_RECEIVED',
      'SHIPPED'
    ]

    const [shipping, purchase] = await Promise.all([
      this.prisma.shippingOrder.findMany({
        where: {
          userId,
          status: { in: activeStatuses }
        },
        include: {
          countryFrom: true,
          user: true
        },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.purchaseOrder.findMany({
        where: {
          userId,
          status: { in: activePurchaseStatuses }
        },
        include: {
          country: true,
          user: true,
          product: true
        },
        orderBy: { createdAt: 'desc' }
      })
    ])

    return {
      shipping,
      purchase,
      count: shipping.length + purchase.length
    }
  }

  /**
   * Поиск заказов по трек-номеру
   */
  async findByTrackingNumber(trackNumber: string): Promise<{
    shipping?: ShippingOrder
    purchase?: PurchaseOrder
    type?: 'shipping' | 'purchase'
  }> {
    const [shipping, purchase] = await Promise.all([
      this.prisma.shippingOrder.findFirst({
        where: { trackNumber },
        include: {
          user: true,
          countryFrom: true,
          statusHistory: {
            orderBy: { createdAt: 'desc' }
          }
        }
      }),
      this.prisma.purchaseOrder.findFirst({
        where: { trackNumber },
        include: {
          user: true,
          country: true,
          product: true,
          statusHistory: {
            orderBy: { createdAt: 'desc' }
          }
        }
      })
    ])

    if (shipping) {
      return { shipping, type: 'shipping' }
    }

    if (purchase) {
      return { purchase, type: 'purchase' }
    }

    return {}
  }

  /**
   * Создать запись в истории статусов
   */
  private async createStatusHistory(data: {
    orderId: bigint
    orderType: 'shipping' | 'purchase'
    oldStatus?: string
    newStatus: string
    comment?: string
    adminId?: number
  }): Promise<void> {
    await this.prisma.orderStatusHistory.create({
      data
    })
  }

  /**
   * Кэширование заказов
   */
  private async cacheOrder(
    orderId: bigint, 
    order: any, 
    type: 'shipping' | 'purchase'
  ): Promise<void> {
    const cacheKey = REDIS_KEYS.ORDER_DETAILS(orderId)
    await this.redis.setWithTTL(cacheKey, { ...order, type }, TTL.MEDIUM)
  }

  private async getCachedOrder(
    orderId: bigint, 
    type: 'shipping' | 'purchase'
  ): Promise<any | null> {
    const cacheKey = REDIS_KEYS.ORDER_DETAILS(orderId)
    const cached = await this.redis.get(cacheKey)
    
    if (cached && cached.type === type) {
      return cached
    }
    
    return null
  }

  private async clearOrderCache(
    orderId: bigint, 
    type: 'shipping' | 'purchase'
  ): Promise<void> {
    const cacheKey = REDIS_KEYS.ORDER_DETAILS(orderId)
    await this.redis.del(cacheKey)
  }

  /**
   * Получить статистику заказов
   */
  async getOrderStats(): Promise<{
    today: {
      shipping: number
      purchase: number
      total: number
    }
    active: {
      shipping: number
      purchase: number
      total: number
    }
    problems: {
      shipping: number
      purchase: number
      total: number
    }
  }> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [todayShipping, todayPurchase, activeShipping, activePurchase, problemShipping, problemPurchase] = await Promise.all([
      this.prisma.shippingOrder.count({
        where: { createdAt: { gte: today } }
      }),
      this.prisma.purchaseOrder.count({
        where: { createdAt: { gte: today } }
      }),
      this.prisma.shippingOrder.count({
        where: { 
          status: { 
            notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] 
          } 
        }
      }),
      this.prisma.purchaseOrder.count({
        where: { 
          status: { 
            notIn: ['DELIVERED', 'REFUNDED'] 
          } 
        }
      }),
      this.prisma.shippingOrder.count({
        where: { status: OrderStatus.PROBLEM }
      }),
      this.prisma.purchaseOrder.count({
        where: { status: 'PROBLEM' }
      })
    ])

    return {
      today: {
        shipping: todayShipping,
        purchase: todayPurchase,
        total: todayShipping + todayPurchase
      },
      active: {
        shipping: activeShipping,
        purchase: activePurchase,
        total: activeShipping + activePurchase
      },
      problems: {
        shipping: problemShipping,
        purchase: problemPurchase,
        total: problemShipping + problemPurchase
      }
    }
  }
}