export enum OrderStatus {
  CREATED = 'CREATED',
  PAID = 'PAID',
  WAREHOUSE_RECEIVED = 'WAREHOUSE_RECEIVED',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  CUSTOMS = 'CUSTOMS',
  IN_TRANSIT = 'IN_TRANSIT',
  READY_PICKUP = 'READY_PICKUP',
  DELIVERED = 'DELIVERED',
  PROBLEM = 'PROBLEM',
  CANCELLED = 'CANCELLED'
}

export enum PurchaseOrderStatus {
  CREATED = 'CREATED',
  PAID = 'PAID',
  PURCHASING = 'PURCHASING',
  PURCHASED = 'PURCHASED',
  WAREHOUSE_RECEIVED = 'WAREHOUSE_RECEIVED',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  PROBLEM = 'PROBLEM',
  REFUNDED = 'REFUNDED'
}

export interface ShippingOrder {
  id: bigint
  userId: bigint
  countryFromId: number
  weight: number
  declaredValue?: number
  declaredCurrency: string
  description?: string
  recipientName: string
  recipientPhone: string
  recipientAddress: string
  totalCost: number
  status: OrderStatus
  adminComment?: string
  trackNumber?: string
  createdAt: Date
  updatedAt: Date
}

export interface PurchaseOrder {
  id: bigint
  userId: bigint
  countryId: number
  productId?: number
  productUrl?: string
  productName: string
  quantity: number
  productPrice: number
  productCurrency: string
  commission: number
  deliveryCost?: number
  totalCost: number
  prepaymentAmount: number
  status: PurchaseOrderStatus
  adminComment?: string
  customerNotes?: string
  actualWeight?: number
  trackNumber?: string
  createdAt: Date
  updatedAt: Date
}

export interface ShippingOrderCreateInput {
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
}

export interface PurchaseOrderCreateInput {
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
}

export interface OrderStatusHistory {
  id: bigint
  orderId: bigint
  orderType: 'shipping' | 'purchase'
  oldStatus?: string
  newStatus: string
  comment?: string
  adminId?: number
  createdAt: Date
}

export interface OrderSummary {
  id: bigint
  type: 'shipping' | 'purchase'
  status: OrderStatus | PurchaseOrderStatus
  totalCost: number
  createdAt: Date
  countryName: string
  flagEmoji: string
}

export interface OrderFilters {
  status?: OrderStatus | PurchaseOrderStatus
  type?: 'shipping' | 'purchase'
  countryId?: number
  userId?: bigint
  dateFrom?: Date
  dateTo?: Date
  search?: string
}