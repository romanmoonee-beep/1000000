import { z } from 'zod'
import { OrderStatus, PurchaseOrderStatus, AdminRole, TransactionType, TransactionStatus, PaymentMethod } from '../types'

// Base schemas
export const IdSchema = z.number().int().positive()
export const BigIntIdSchema = z.bigint().positive()
export const TelegramIdSchema = z.bigint().positive()

// User schemas
export const UserCreateSchema = z.object({
  telegramId: TelegramIdSchema,
  username: z.string().optional(),
  firstName: z.string().min(1).max(255).optional(),
  lastName: z.string().min(1).max(255).optional(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
  email: z.string().email().optional(),
  cityId: IdSchema.optional(),
  address: z.string().min(1).max(500).optional(),
  language: z.string().length(2).default('ru')
})

export const UserUpdateSchema = z.object({
  firstName: z.string().min(1).max(255).optional(),
  lastName: z.string().min(1).max(255).optional(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
  email: z.string().email().optional(),
  cityId: IdSchema.optional(),
  address: z.string().min(1).max(500).optional(),
  language: z.string().length(2).optional()
})

export const UserAddressCreateSchema = z.object({
  userId: BigIntIdSchema,
  alias: z.string().min(1).max(100),
  cityId: IdSchema,
  address: z.string().min(1).max(500),
  isDefault: z.boolean().default(false)
})

// Order schemas
export const ShippingOrderCreateSchema = z.object({
  userId: BigIntIdSchema,
  countryFromId: IdSchema,
  weight: z.number().positive().max(50),
  declaredValue: z.number().positive().max(10000).optional(),
  declaredCurrency: z.string().length(3).default('USD'),
  description: z.string().min(1).max(500).optional(),
  recipientName: z.string().min(1).max(255),
  recipientPhone: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  recipientAddress: z.string().min(1).max(500),
  totalCost: z.number().positive()
})

export const PurchaseOrderCreateSchema = z.object({
  userId: BigIntIdSchema,
  countryId: IdSchema,
  productId: IdSchema.optional(),
  productUrl: z.string().url().optional(),
  productName: z.string().min(1).max(500),
  quantity: z.number().int().positive().max(100),
  productPrice: z.number().positive(),
  productCurrency: z.string().length(3).default('USD'),
  commission: z.number().positive(),
  prepaymentAmount: z.number().positive(),
  customerNotes: z.string().max(1000).optional()
})

export const OrderStatusUpdateSchema = z.object({
  orderId: BigIntIdSchema,
  newStatus: z.nativeEnum(OrderStatus).or(z.nativeEnum(PurchaseOrderStatus)),
  comment: z.string().max(1000).optional(),
  adminId: IdSchema.optional()
})

// Country schemas
export const CountryCreateSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().length(3).toUpperCase(),
  flagEmoji: z.string().min(1).max(10),
  currency: z.string().length(3).optional(),
  shippingAvailable: z.boolean().default(true),
  purchaseAvailable: z.boolean().default(true),
  purchaseCommission: z.number().min(0).max(50).default(5),
  popularityScore: z.number().int().min(0).default(0)
})

export const WarehouseCreateSchema = z.object({
  countryId: IdSchema,
  name: z.string().min(1).max(255),
  address: z.string().min(1).max(1000),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional(),
  workingHours: z.string().max(255).optional(),
  timezone: z.string().max(50).optional(),
  maxWeightKg: z.number().positive().max(1000).default(50),
  maxDeclaredValue: z.number().positive().max(100000).default(2000),
  restrictions: z.string().max(1000).optional()
})

export const ShippingTariffCreateSchema = z.object({
  countryFromId: IdSchema,
  countryToId: IdSchema,
  pricePerKg: z.number().positive().max(10000),
  minPrice: z.number().min(0).max(100000),
  deliveryDaysMin: z.number().int().positive().max(365).optional(),
  deliveryDaysMax: z.number().int().positive().max(365).optional()
})

// Admin schemas
export const AdminCreateSchema = z.object({
  telegramId: TelegramIdSchema,
  username: z.string().optional(),
  firstName: z.string().min(1).max(255).optional(),
  lastName: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
  role: z.nativeEnum(AdminRole),
  permissions: z.record(z.any()).optional()
})

export const AdminUpdateSchema = z.object({
  username: z.string().optional(),
  firstName: z.string().min(1).max(255).optional(),
  lastName: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
  role: z.nativeEnum(AdminRole).optional(),
  permissions: z.record(z.any()).optional(),
  isActive: z.boolean().optional()
})

// Payment schemas
export const TransactionCreateSchema = z.object({
  userId: BigIntIdSchema,
  orderId: BigIntIdSchema.optional(),
  orderType: z.enum(['shipping', 'purchase']).optional(),
  amount: z.number().positive(),
  type: z.nativeEnum(TransactionType),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  description: z.string().max(500).optional(),
  metadata: z.record(z.any()).optional()
})

export const PaymentCreateSchema = z.object({
  amount: z.number().positive().min(100).max(1000000),
  paymentMethod: z.nativeEnum(PaymentMethod),
  returnUrl: z.string().url().optional(),
  metadata: z.record(z.any()).optional()
})

// Support schemas
export const SupportChatCreateSchema = z.object({
  userId: BigIntIdSchema,
  subject: z.string().min(1).max(255).optional(),
  priority: z.number().int().min(1).max(4).default(1),
  initialMessage: z.string().min(1).max(4000).optional()
})

export const ChatMessageCreateSchema = z.object({
  chatId: BigIntIdSchema,
  senderId: BigIntIdSchema,
  senderType: z.enum(['user', 'admin']),
  message: z.string().min(1).max(4000),
  messageType: z.enum(['TEXT', 'IMAGE', 'DOCUMENT', 'VOICE', 'LOCATION', 'SYSTEM']).default('TEXT'),
  metadata: z.record(z.any()).optional()
})

// API schemas
export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
})

export const SearchSchema = z.object({
  q: z.string().min(1).max(255).optional(),
  filters: z.record(z.any()).optional()
})

export const FileUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  mimetype: z.string().min(1),
  size: z.number().int().positive().max(50 * 1024 * 1024) // 50MB
})

// Auth schemas
export const TelegramAuthSchema = z.object({
  id: z.number().int().positive(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().url().optional(),
  auth_date: z.number().int().positive(),
  hash: z.string().min(1)
})

export const LoginSchema = z.object({
  telegramId: TelegramIdSchema,
  authData: TelegramAuthSchema
})

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1)
})

// Product schemas
export const ProductCategoryCreateSchema = z.object({
  name: z.string().min(1).max(100),
  icon: z.string().max(20).optional(),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().min(0).default(0)
})

export const FixedPriceProductCreateSchema = z.object({
  countryId: IdSchema,
  categoryId: IdSchema,
  name: z.string().min(1).max(500),
  description: z.string().max(1000).optional(),
  price: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  estimatedWeight: z.number().positive().max(50).optional(),
  imageUrl: z.string().url().optional(),
  productUrl: z.string().url().optional(),
  sku: z.string().max(100).optional(),
  isPopular: z.boolean().default(false)
})

// System schemas
export const SystemSettingUpdateSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string().min(1),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().default(false)
})

export const NotificationCreateSchema = z.object({
  userId: BigIntIdSchema,
  title: z.string().min(1).max(255),
  message: z.string().min(1).max(4000),
  type: z.string().min(1).max(50),
  metadata: z.record(z.any()).optional()
})

// Webhook schemas
export const TelegramWebhookSchema = z.object({
  update_id: z.number().int(),
  message: z.object({
    message_id: z.number().int(),
    from: z.object({
      id: z.number().int(),
      is_bot: z.boolean(),
      first_name: z.string(),
      last_name: z.string().optional(),
      username: z.string().optional()
    }),
    chat: z.object({
      id: z.number().int(),
      type: z.string()
    }),
    date: z.number().int(),
    text: z.string().optional()
  }).optional(),
  callback_query: z.object({
    id: z.string(),
    from: z.object({
      id: z.number().int(),
      is_bot: z.boolean(),
      first_name: z.string(),
      last_name: z.string().optional(),
      username: z.string().optional()
    }),
    message: z.object({
      message_id: z.number().int(),
      chat: z.object({
        id: z.number().int(),
        type: z.string()
      }),
      date: z.number().int()
    }).optional(),
    data: z.string().optional()
  }).optional()
})

// Admin dashboard auth schemas
export const AdminDashboardTokenSchema = z.object({
  token: z.string().length(32),
  accessKey: z.string().length(16)
})

export const GenerateDashboardAccessSchema = z.object({
  adminId: z.number().int().positive()
})

export const AdminDashboardTokenCreateSchema = z.object({
  adminId: z.number().int().positive(),
  token: z.string().length(32),
  accessKey: z.string().length(16),
  expiresAt: z.date(),
  ipAddress: z.string().ip().optional()
})

export const AdminWebSessionSchema = z.object({
  sessionId: z.string().uuid(),
  adminId: z.number().int().positive(),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().optional()
})