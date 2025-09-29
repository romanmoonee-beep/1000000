// Date and time utilities
export const formatDate = (date: Date, locale = 'ru-RU'): string => {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

export const formatDateShort = (date: Date, locale = 'ru-RU'): string => {
  return new Intl.DateTimeFormat(locale, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

export const isToday = (date: Date): boolean => {
  const today = new Date()
  return date.toDateString() === today.toDateString()
}

export const isYesterday = (date: Date): boolean => {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return date.toDateString() === yesterday.toDateString()
}

export const getRelativeTime = (date: Date, locale = 'ru-RU'): string => {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 60) return 'только что'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} мин назад`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} ч назад`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} дн назад`
  
  return formatDate(date, locale)
}

// Number and currency formatting
export const formatCurrency = (amount: number, currency = 'RUB', locale = 'ru-RU'): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount)
}

export const formatNumber = (num: number, locale = 'ru-RU'): string => {
  return new Intl.NumberFormat(locale).format(num)
}

export const formatWeight = (weight: number): string => {
  return `${weight.toFixed(1)} кг`
}

export const formatBytes = (bytes: number): string => {
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ']
  if (bytes === 0) return '0 Б'
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`
}

// String utilities
export const truncateText = (text: string, maxLength: number, suffix = '...'): string => {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - suffix.length) + suffix
}

export const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

export const generateId = (length = 8): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export const sanitizeFilename = (filename: string): string => {
  return filename
    .replace(/[^a-z0-9.-]/gi, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '')
}

// Phone number utilities
export const formatPhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '')
  
  if (cleaned.startsWith('7') && cleaned.length === 11) {
    return `+7(${cleaned.slice(1, 4)})${cleaned.slice(4, 7)}-${cleaned.slice(7, 9)}-${cleaned.slice(9)}`
  }
  
  return phone
}

export const isValidPhoneNumber = (phone: string): boolean => {
  const cleaned = phone.replace(/\D/g, '')
  return /^7\d{10}$/.test(cleaned)
}

// Validation utilities
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const isValidTelegramId = (id: string | number): boolean => {
  const numId = typeof id === 'string' ? parseInt(id, 10) : id
  return Number.isInteger(numId) && numId > 0
}

// Array utilities
export const chunk = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

export const unique = <T>(array: T[]): T[] => {
  return [...new Set(array)]
}

export const groupBy = <T, K extends keyof any>(
  array: T[],
  key: (item: T) => K
): Record<K, T[]> => {
  return array.reduce((groups, item) => {
    const group = key(item)
    groups[group] = groups[group] || []
    groups[group].push(item)
    return groups
  }, {} as Record<K, T[]>)
}

// Object utilities
export const omit = <T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> => {
  const result = { ...obj }
  keys.forEach(key => delete result[key])
  return result
}

export const pick = <T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> => {
  const result = {} as Pick<T, K>
  keys.forEach(key => {
    if (key in obj) {
      result[key] = obj[key]
    }
  })
  return result
}

// Status utilities
export const getStatusColor = (status: string): string => {
  const statusColors: Record<string, string> = {
    CREATED: '#6B7280',
    PAID: '#10B981',
    WAREHOUSE_RECEIVED: '#3B82F6',
    PROCESSING: '#F59E0B',
    SHIPPED: '#8B5CF6',
    CUSTOMS: '#EF4444',
    IN_TRANSIT: '#06B6D4',
    READY_PICKUP: '#84CC16',
    DELIVERED: '#22C55E',
    PROBLEM: '#EF4444',
    CANCELLED: '#6B7280'
  }
  
  return statusColors[status] || '#6B7280'
}

export const getStatusText = (status: string): string => {
  const statusTexts: Record<string, string> = {
    CREATED: 'Создан',
    PAID: 'Оплачен',
    WAREHOUSE_RECEIVED: 'На складе',
    PROCESSING: 'Обрабатывается',
    SHIPPED: 'Отправлен',
    CUSTOMS: 'Таможня',
    IN_TRANSIT: 'В пути',
    READY_PICKUP: 'Готов к получению',
    DELIVERED: 'Доставлен',
    PROBLEM: 'Проблема',
    CANCELLED: 'Отменен'
  }
  
  return statusTexts[status] || status
}

// Telegram utilities
export const escapeMarkdown = (text: string): string => {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&')
}

export const createDeepLink = (botUsername: string, payload?: string): string => {
  const baseUrl = `https://t.me/${botUsername}`
  return payload ? `${baseUrl}?start=${payload}` : baseUrl
}

// Calculation utilities
export const calculateShippingCost = (weight: number, pricePerKg: number, minPrice: number): number => {
  const baseCost = weight * pricePerKg
  return Math.max(baseCost, minPrice)
}

export const calculateCommission = (price: number, commissionRate: number): number => {
  return (price * commissionRate) / 100
}

export const calculateVipDiscount = (amount: number, discountRate: number): number => {
  return (amount * discountRate) / 100
}

// Error handling utilities
export const isError = (error: unknown): error is Error => {
  return error instanceof Error
}

export const getErrorMessage = (error: unknown): string => {
  if (isError(error)) return error.message
  if (typeof error === 'string') return error
  return 'Неизвестная ошибка'
}

// Constants
export const CONSTANTS = {
  MAX_MESSAGE_LENGTH: 4096,
  MAX_INLINE_KEYBOARD_BUTTONS: 100,
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  MIN_PASSWORD_LENGTH: 8,
  SESSION_TIMEOUT: 30 * 24 * 60 * 60 * 1000, // 30 days
  RATE_LIMIT_WINDOW: 60 * 1000, // 1 minute
  RATE_LIMIT_MAX_REQUESTS: 100
} as const