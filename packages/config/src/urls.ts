import { getApiUrl, getFrontendUrl, getAdminDashboardUrl, getCorsOrigin } from './env'

/**
 * Централизованная конфигурация всех URL в системе
 */
export class UrlConfig {
  // Базовые URL
  static get api() {
    return getApiUrl()
  }
  
  static get frontend() {
    return getFrontendUrl()
  }
  
  static get adminDashboard() {
    return getAdminDashboardUrl()
  }
  
  // API endpoints
  static get apiEndpoints() {
    return {
      base: this.api,
      auth: `${this.api}/api/auth`,
      admin: `${this.api}/api/admin`,
      public: `${this.api}/api`,
      webhook: `${this.api}/webhook`,
      health: `${this.api}/health`,
      docs: `${this.api}/docs`,
      
      // Специфичные endpoints
      login: `${this.api}/api/auth/login`,
      refresh: `${this.api}/api/auth/refresh`,
      
      // Админ endpoints
      adminDashboard: `${this.api}/api/admin/dashboard`,
      adminOrders: `${this.api}/api/admin/orders`,
      adminUsers: `${this.api}/api/admin/users`,
      adminAnalytics: `${this.api}/api/admin/analytics`,
      
      // WebSocket
      socket: this.api.replace('http', 'ws'),
      
      // Telegram webhook
      telegramWebhook: `${this.api}/webhook/telegram`
    }
  }
  
  // Frontend routes
  static get frontendRoutes() {
    return {
      base: this.frontend,
      login: `${this.frontend}/login`,
      dashboard: `${this.frontend}/dashboard`,
      orders: `${this.frontend}/orders`,
      users: `${this.frontend}/users`,
      countries: `${this.frontend}/countries`,
      analytics: `${this.frontend}/analytics`,
      settings: `${this.frontend}/settings`,
      
      // Админ панель
      adminLogin: `${this.frontend}/admin/login`,
      adminDashboard: `${this.frontend}/admin/dashboard`,
      adminDashboardWithToken: (token: string) => `${this.adminDashboard}/${token}`
    }
  }
  
  // Методы для генерации динамических URL
  static getAdminDashboardUrl(token: string): string {
    return `${this.adminDashboard}/${token}`
  }
  
  static getOrderUrl(orderId: string): string {
    return `${this.frontend}/orders/${orderId}`
  }
  
  static getUserUrl(userId: string): string {
    return `${this.frontend}/users/${userId}`
  }
  
  // Telegram deep links
  static telegramDeepLinks(botUsername: string) {
    const baseUrl = `https://t.me/${botUsername}`
    
    return {
      start: baseUrl,
      startWithPayload: (payload: string) => `${baseUrl}?start=${payload}`,
      order: (orderId: string) => `${baseUrl}?start=order_${orderId}`,
      support: `${baseUrl}?start=support`,
      referral: (userId: string) => `${baseUrl}?start=ref_${userId}`
    }
  }
  
  // Webhook URLs для внешних сервисов
  static get webhookUrls() {
    return {
      telegram: `${this.api}/webhook/telegram`,
      yookassa: `${this.api}/webhook/yookassa`,
      sber: `${this.api}/webhook/sber`,
      crypto: `${this.api}/webhook/crypto`
    }
  }
  
  // CORS origins
  static get corsOrigins(): string[] {
    return getCorsOrigin()
  }
  
  // Проверка URL на валидность
  static isValidUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }
  
  // Получение домена из URL
  static getDomain(url: string): string {
    try {
      return new URL(url).hostname
    } catch {
      return ''
    }
  }
  
  // Проверка является ли URL локальным
  static isLocalUrl(url: string): boolean {
    const domain = this.getDomain(url)
    return domain === 'localhost' || domain === '127.0.0.1' || domain.includes('local')
  }
}

// Экспорт для удобства
export const urls = UrlConfig