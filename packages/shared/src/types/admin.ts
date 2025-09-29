export enum AdminRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ORDER_MANAGER = 'ORDER_MANAGER',
  FINANCE_MANAGER = 'FINANCE_MANAGER',
  SUPPORT_OPERATOR = 'SUPPORT_OPERATOR',
  CONTENT_MANAGER = 'CONTENT_MANAGER'
}

export interface Admin {
  id: number
  telegramId: bigint
  username?: string
  firstName?: string
  lastName?: string
  email?: string
  role: AdminRole
  permissions?: AdminPermissions
  isActive: boolean
  createdAt: Date
  lastLogin?: Date
  updatedAt: Date
}

export interface AdminPermissions {
  orders?: {
    view: boolean
    manage: boolean
    delete: boolean
  }
  users?: {
    view: boolean
    manage: boolean
    block: boolean
  }
  finance?: {
    view: boolean
    manage: boolean
    refunds: boolean
  }
  countries?: {
    view: boolean
    manage: boolean
    tariffs: boolean
  }
  support?: {
    basic: boolean
    advanced: boolean
    assign: boolean
  }
  analytics?: {
    view: boolean
    export: boolean
  }
  settings?: {
    view: boolean
    manage: boolean
  }
}

export interface AdminCreateInput {
  telegramId: bigint
  username?: string
  firstName?: string
  lastName?: string
  email?: string
  role: AdminRole
  permissions?: AdminPermissions
}

export interface AdminLog {
  id: bigint
  adminId: number
  action: string
  targetType?: string
  targetId?: bigint
  oldValues?: Record<string, any>
  newValues?: Record<string, any>
  ipAddress?: string
  createdAt: Date
}

export interface DashboardStats {
  today: {
    revenue: number
    orders: number
    newUsers: number
    avgOrderValue: number
  }
  month: {
    revenue: number
    orders: number
    newUsers: number
    growth: number
  }
  active: {
    orders: number
    users: number
    vipUsers: number
    onlineUsers: number
  }
  alerts: {
    pendingPayments: number
    problemOrders: number
    supportQueue: number
    expiredVip: number
  }
}

export interface AdminSession {
  adminId: number
  telegramId: bigint
  role: AdminRole
  permissions: AdminPermissions
  loginTime: Date
  lastActivity: Date
}

export interface AdminDashboardToken {
  id: string
  adminId: number
  token: string
  accessKey: string
  expiresAt: Date
  isUsed: boolean
  createdAt: Date
  usedAt?: Date
  ipAddress?: string
}

export interface AdminDashboardAccess {
  dashboardUrl: string
  accessKey: string
  expiresAt: Date
  instructions: string
}

export interface AdminWebSession {
  sessionId: string
  adminId: number
  accessToken: string
  refreshToken: string
  expiresAt: Date
  createdAt: Date
  lastActivity: Date
  ipAddress?: string
  userAgent?: string
}