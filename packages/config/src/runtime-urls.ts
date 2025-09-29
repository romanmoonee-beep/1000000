/**
 * Runtime URL helper для получения актуальных URL в любом месте приложения
 */
export class RuntimeUrls {
  private static _apiUrl: string | null = null
  private static _frontendUrl: string | null = null
  private static _adminDashboardUrl: string | null = null
  
  /**
   * Инициализация URL при запуске приложения
   */
  static init(config: {
    apiUrl: string
    frontendUrl: string
    adminDashboardUrl: string
  }) {
    this._apiUrl = config.apiUrl
    this._frontendUrl = config.frontendUrl
    this._adminDashboardUrl = config.adminDashboardUrl
    
    console.log('🌐 Runtime URLs initialized:', {
      api: this._apiUrl,
      frontend: this._frontendUrl,
      adminDashboard: this._adminDashboardUrl
    })
  }
  
  /**
   * Получить API URL
   */
  static get api(): string {
    if (!this._apiUrl) {
      throw new Error('RuntimeUrls not initialized! Call RuntimeUrls.init() first')
    }
    return this._apiUrl
  }
  
  /**
   * Получить Frontend URL
   */
  static get frontend(): string {
    if (!this._frontendUrl) {
      throw new Error('RuntimeUrls not initialized! Call RuntimeUrls.init() first')
    }
    return this._frontendUrl
  }
  
  /**
   * Получить Admin Dashboard URL
   */
  static get adminDashboard(): string {
    if (!this._adminDashboardUrl) {
      throw new Error('RuntimeUrls not initialized! Call RuntimeUrls.init() first')
    }
    return this._adminDashboardUrl
  }
  
  /**
   * Создать URL для админ токена
   */
  static getAdminTokenUrl(token: string): string {
    return `${this.adminDashboard}/${token}`
  }
  
  /**
   * Получить все API endpoints
   */
  static get endpoints() {
    const api = this.api
    
    return {
      // Auth
      login: `${api}/api/auth/login`,
      refresh: `${api}/api/auth/refresh`,
      adminDashboardAuth: `${api}/api/auth/admin-dashboard`,
      
      // Admin
      adminDashboard: `${api}/api/admin/dashboard`,
      adminOrders: `${api}/api/admin/orders`,
      adminUsers: `${api}/api/admin/users`,
      adminCountries: `${api}/api/admin/countries`,
      adminAnalytics: `${api}/api/admin/analytics`,
      adminSupport: `${api}/api/admin/support`,
      
      // Public
      countries: `${api}/api/countries`,
      warehouses: `${api}/api/warehouses`,
      tariffs: `${api}/api/tariffs`,
      
      // Webhooks
      telegramWebhook: `${api}/webhook/telegram`,
      yookassaWebhook: `${api}/webhook/yookassa`,
      sberWebhook: `${api}/webhook/sber`,
      cryptoWebhook: `${api}/webhook/crypto`,
      
      // System
      health: `${api}/health`,
      docs: `${api}/docs`,
      socket: api.replace('http', 'ws')
    }
  }
  
  /**
   * Проверка инициализации
   */
  static get isInitialized(): boolean {
    return this._apiUrl !== null && this._frontendUrl !== null && this._adminDashboardUrl !== null
  }
  
  /**
   * Вывод текущей конфигурации
   */
  static getConfig() {
    return {
      api: this._apiUrl,
      frontend: this._frontendUrl,
      adminDashboard: this._adminDashboardUrl,
      initialized: this.isInitialized
    }
  }
}