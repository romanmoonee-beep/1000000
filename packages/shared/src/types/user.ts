export interface User {
  id: bigint
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
  createdAt: Date
  updatedAt: Date
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
  language?: string
}

export interface UserUpdateInput {
  firstName?: string
  lastName?: string
  phone?: string
  email?: string
  cityId?: number
  address?: string
  language?: string
}

export interface UserAddress {
  id: number
  userId: bigint
  alias: string
  cityId: number
  address: string
  isDefault: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface UserStats {
  totalOrders: number
  completedOrders: number
  totalSpent: number
  averageOrderValue: number
  favoriteCountry?: string
  registrationDays: number
}

export interface UserSession {
  userId: bigint
  scene?: string
  data?: Record<string, any>
  lastActivity: Date
}