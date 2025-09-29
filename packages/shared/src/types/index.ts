// Base types
export interface BaseEntity {
  id: number | bigint
  createdAt: Date
  updatedAt: Date
}

// User types
export interface User extends BaseEntity {
  telegramId: bigint
  username?: string
  firstName?: string
  lastName?: string
  phone?: string
  email?: string
  cityId?: number
  address?: string
  balance: number
  isVip: boolean
  vipExpiresAt?: Date
  language: string
  isActive: boolean
  isBlocked: boolean
  registrationDate: Date
  lastActivity: Date
}

export interface UserCreateInput {
  telegramId: bigint
  username?: string
  firstName?: string
  lastName?: string
  phone?: string
  email?: string
  cityId?: number
  address?: string
}

// Order types
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

export interface ShippingOrder extends BaseEntity {
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
}

export interface PurchaseOrder extends BaseEntity {
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
}

// Country and warehouse types
export interface Country extends BaseEntity {
  name: string
  code: string
  flagEmoji: string
  currency?: string
  isActive: boolean
  shippingAvailable: boolean
  purchaseAvailable: boolean
  purchaseCommission: number
  popularityScore: number
}

export interface Warehouse extends BaseEntity {
  countryId: number
  name: string
  address: string
  phone?: string
  email?: string
  workingHours?: string
  timezone?: string
  maxWeightKg: number
  maxDeclaredValue: number
  restrictions?: string
  isActive: boolean
}

// Admin types
export enum AdminRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ORDER_MANAGER = 'ORDER_MANAGER',
  FINANCE_MANAGER = 'FINANCE_MANAGER',
  SUPPORT_OPERATOR = 'SUPPORT_OPERATOR',
  CONTENT_MANAGER = 'CONTENT_MANAGER'
}

export interface Admin extends BaseEntity {
  telegramId: bigint
  username?: string
  firstName?: string
  lastName?: string
  email?: string
  role: AdminRole
  permissions?: Record<string, any>
  isActive: boolean
  lastLogin?: Date
}

// Transaction types
export enum TransactionType {
  PAYMENT = 'PAYMENT',
  REFUND = 'REFUND',
  BONUS = 'BONUS',
  WITHDRAWAL = 'WITHDRAWAL'
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export interface Transaction extends BaseEntity {
  userId: bigint
  orderId?: bigint
  orderType?: string
  amount: number
  type: TransactionType
  paymentMethod?: string
  paymentId?: string
  status: TransactionStatus
  description?: string
  metadata?: Record<string, any>
  completedAt?: Date
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Dashboard statistics
export interface DashboardStats {
  todayRevenue: number
  todayOrders: number
  activeOrders: number
  totalUsers: number
  vipUsers: number
  onlineUsers: number
  pendingPayments: number
  problemOrders: number
  supportChats: number
}

// Real-time events
export enum SocketEvent {
  ORDER_UPDATED = 'order_updated',
  PAYMENT_RECEIVED = 'payment_received',
  NEW_USER = 'new_user',
  SUPPORT_MESSAGE = 'support_message',
  ADMIN_ACTION = 'admin_action'
}

export interface SocketEventData {
  type: SocketEvent
  data: any
  timestamp: Date
  userId?: bigint
  adminId?: number
}