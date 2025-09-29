// Base API response interface
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  timestamp: string
}

// Paginated response
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// Query parameters for pagination
export interface PaginationQuery {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// Search and filter parameters
export interface SearchQuery {
  q?: string
  filters?: Record<string, any>
}

// API Error types
export interface ApiError {
  code: string
  message: string
  details?: Record<string, any>
  path?: string
  timestamp: string
}

export interface ValidationError extends ApiError {
  field: string
  value: any
  constraint: string
}

// File upload types
export interface FileUpload {
  filename: string
  mimetype: string
  encoding: string
  size: number
  buffer: Buffer
}

export interface UploadedFile {
  id: string
  originalName: string
  filename: string
  mimetype: string
  size: number
  url: string
  uploadedAt: Date
}

// WebSocket event types
export enum SocketEvent {
  // Connection events
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  
  // Order events
  ORDER_CREATED = 'order_created',
  ORDER_UPDATED = 'order_updated',
  ORDER_STATUS_CHANGED = 'order_status_changed',
  
  // Payment events
  PAYMENT_RECEIVED = 'payment_received',
  PAYMENT_FAILED = 'payment_failed',
  
  // User events
  USER_REGISTERED = 'user_registered',
  USER_UPDATED = 'user_updated',
  USER_BLOCKED = 'user_blocked',
  
  // Support events
  SUPPORT_MESSAGE = 'support_message',
  SUPPORT_CHAT_CREATED = 'support_chat_created',
  SUPPORT_CHAT_ASSIGNED = 'support_chat_assigned',
  SUPPORT_CHAT_CLOSED = 'support_chat_closed',
  
  // Admin events
  ADMIN_ACTION = 'admin_action',
  ADMIN_LOGIN = 'admin_login',
  ADMIN_LOGOUT = 'admin_logout',
  
  // System events
  SYSTEM_NOTIFICATION = 'system_notification',
  MAINTENANCE_MODE = 'maintenance_mode'
}

export interface SocketEventData<T = any> {
  event: SocketEvent
  data: T
  userId?: bigint
  adminId?: number
  timestamp: Date
  metadata?: Record<string, any>
}

// Authentication types
export interface LoginRequest {
  telegramId: bigint
  authData: TelegramAuthData
}

export interface TelegramAuthData {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

export interface AuthResponse {
  token: string
  refreshToken: string
  user: {
    id: bigint
    telegramId: bigint
    firstName?: string
    lastName?: string
    username?: string
    role?: string
    isVip: boolean
  }
  expiresAt: Date
}

export interface RefreshTokenRequest {
  refreshToken: string
}

// Rate limiting
export interface RateLimitInfo {
  limit: number
  remaining: number
  reset: Date
  retryAfter?: number
}

// Health check
export interface HealthCheck {
  status: 'ok' | 'error'
  timestamp: string
  uptime: number
  version: string
  services: {
    database: 'ok' | 'error'
    redis: 'ok' | 'error'
    telegram: 'ok' | 'error'
  }
  memory: {
    used: number
    total: number
    percentage: number
  }
}