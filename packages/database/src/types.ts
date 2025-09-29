import { Prisma } from '@prisma/client'

// Расширенные типы с отношениями
export type UserWithRelations = Prisma.UserGetPayload<{
  include: {
    city: true
    addresses: true
    shippingOrders: true
    purchaseOrders: true
    transactions: true
    supportChats: true
    notifications: true
  }
}>

export type CountryWithRelations = Prisma.CountryGetPayload<{
  include: {
    warehouses: true
    shippingTariffs: true
    shippingOrders: true
    purchaseOrders: true
    fixedPriceProducts: true
  }
}>

export type WarehouseWithRelations = Prisma.WarehouseGetPayload<{
  include: {
    country: true
  }
}>

export type ShippingOrderWithRelations = Prisma.ShippingOrderGetPayload<{
  include: {
    user: true
    countryFrom: true
    statusHistory: true
    transactions: true
  }
}>

export type PurchaseOrderWithRelations = Prisma.PurchaseOrderGetPayload<{
  include: {
    user: true
    country: true
    product: true
    statusHistory: true
    transactions: true
  }
}>

export type TransactionWithRelations = Prisma.TransactionGetPayload<{
  include: {
    user: true
    shippingOrder: true
    purchaseOrder: true
  }
}>

export type AdminWithRelations = Prisma.AdminGetPayload<{
  include: {
    logs: true
    statusHistory: true
    supportChats: true
    dashboardTokens: true
  }
}>

export type AdminDashboardTokenWithRelations = Prisma.AdminDashboardTokenGetPayload<{
  include: {
    admin: true
  }
}>

export type SupportChatWithRelations = Prisma.SupportChatGetPayload<{
  include: {
    user: true
    admin: true
    messages: true
  }
}>

export type ChatMessageWithRelations = Prisma.ChatMessageGetPayload<{
  include: {
    chat: {
      include: {
        user: true
        admin: true
      }
    }
  }
}>

export type ProductCategoryWithRelations = Prisma.ProductCategoryGetPayload<{
  include: {
    fixedPriceProducts: true
  }
}>

export type FixedPriceProductWithRelations = Prisma.FixedPriceProductGetPayload<{
  include: {
    country: true
    category: true
    purchaseOrders: true
  }
}>

export type NotificationWithRelations = Prisma.NotificationGetPayload<{
  include: {
    user: true
  }
}>

// Типы для создания записей
export type UserCreateData = Prisma.UserCreateInput
export type UserUpdateData = Prisma.UserUpdateInput

export type CountryCreateData = Prisma.CountryCreateInput
export type CountryUpdateData = Prisma.CountryUpdateInput

export type WarehouseCreateData = Prisma.WarehouseCreateInput
export type WarehouseUpdateData = Prisma.WarehouseUpdateInput

export type ShippingTariffCreateData = Prisma.ShippingTariffCreateInput
export type ShippingTariffUpdateData = Prisma.ShippingTariffUpdateInput

export type ShippingOrderCreateData = Prisma.ShippingOrderCreateInput
export type ShippingOrderUpdateData = Prisma.ShippingOrderUpdateInput

export type PurchaseOrderCreateData = Prisma.PurchaseOrderCreateInput
export type PurchaseOrderUpdateData = Prisma.PurchaseOrderUpdateInput

export type TransactionCreateData = Prisma.TransactionCreateInput
export type TransactionUpdateData = Prisma.TransactionUpdateInput

export type AdminCreateData = Prisma.AdminCreateInput
export type AdminUpdateData = Prisma.AdminUpdateInput

export type AdminDashboardTokenCreateData = Prisma.AdminDashboardTokenCreateInput
export type AdminDashboardTokenUpdateData = Prisma.AdminDashboardTokenUpdateInput

export type SupportChatCreateData = Prisma.SupportChatCreateInput
export type SupportChatUpdateData = Prisma.SupportChatUpdateInput

export type ChatMessageCreateData = Prisma.ChatMessageCreateInput

export type ProductCategoryCreateData = Prisma.ProductCategoryCreateInput
export type ProductCategoryUpdateData = Prisma.ProductCategoryUpdateInput

export type FixedPriceProductCreateData = Prisma.FixedPriceProductCreateInput
export type FixedPriceProductUpdateData = Prisma.FixedPriceProductUpdateInput

export type NotificationCreateData = Prisma.NotificationCreateInput

export type SystemSettingCreateData = Prisma.SystemSettingCreateInput
export type SystemSettingUpdateData = Prisma.SystemSettingUpdateInput

export type UserAddressCreateData = Prisma.UserAddressCreateInput
export type UserAddressUpdateData = Prisma.UserAddressUpdateInput

export type CityCreateData = Prisma.CityCreateInput

export type OrderStatusHistoryCreateData = Prisma.OrderStatusHistoryCreateInput

export type AdminLogCreateData = Prisma.AdminLogCreateInput

// Специальные типы для запросов
export type UserWithStats = UserWithRelations & {
  _count: {
    shippingOrders: number
    purchaseOrders: number
    transactions: number
  }
  totalSpent: number
  averageOrderValue: number
}

export type CountryWithStats = CountryWithRelations & {
  _count: {
    warehouses: number
    shippingOrders: number
    purchaseOrders: number
    fixedPriceProducts: number
  }
  monthlyRevenue: number
  monthlyOrders: number
}

export type AdminWithLastActivity = AdminWithRelations & {
  lastActivity: Date
  activeSessions: number
}

// Utility types для фильтрации
export type OrderFilters = {
  status?: string[]
  userId?: bigint
  countryId?: number
  dateFrom?: Date
  dateTo?: Date
  search?: string
  type?: 'shipping' | 'purchase'
}

export type UserFilters = {
  isVip?: boolean
  isActive?: boolean
  isBlocked?: boolean
  cityId?: number
  registrationDateFrom?: Date
  registrationDateTo?: Date
  balanceMin?: number
  balanceMax?: number
  search?: string
}

export type TransactionFilters = {
  type?: string[]
  status?: string[]
  userId?: bigint
  amountMin?: number
  amountMax?: number
  dateFrom?: Date
  dateTo?: Date
  paymentMethod?: string[]
}

// Pagination type
export type PaginationOptions = {
  page: number
  limit: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// Result types for paginated queries
export type PaginatedResult<T> = {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}