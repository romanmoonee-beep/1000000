import { env } from './env'

export const TELEGRAM_CONFIG = {
  // API конфигурация
  token: env.TELEGRAM_BOT_TOKEN,
  apiUrl: 'https://api.telegram.org',
  
  // Webhook конфигурация
  webhook: {
    url: env.TELEGRAM_WEBHOOK_URL,
    secret: env.TELEGRAM_WEBHOOK_SECRET,
    maxConnections: 100,
    allowedUpdates: [
      'message',
      'callback_query',
      'inline_query',
      'chosen_inline_result',
      'pre_checkout_query',
      'shipping_query'
    ]
  },
  
  // Polling конфигурация (для development)
  polling: {
    limit: 100,
    timeout: 30,
    allowedUpdates: [
      'message',
      'callback_query',
      'inline_query',
      'chosen_inline_result'
    ]
  },
  
  // Лимиты Telegram API
  limits: {
    messageLength: 4096,
    captionLength: 1024,
    inlineKeyboardButtons: 100,
    buttonsPerRow: 8,
    fileSize: 50 * 1024 * 1024, // 50MB
    photoSize: 10 * 1024 * 1024, // 10MB
    videoSize: 50 * 1024 * 1024, // 50MB
    audioSize: 50 * 1024 * 1024, // 50MB
    documentSize: 50 * 1024 * 1024, // 50MB
    stickerSize: 512, // 512KB
    thumbnailSize: 320, // 320x320 px
  },
  
  // Rate limiting
  rateLimits: {
    globalPerSecond: 30,
    perChatPerSecond: 1,
    perChatPerMinute: 20,
    bulkMessagesPerSecond: 30
  },
  
  // Команды бота
  commands: [
    {
      command: 'start',
      description: 'Начать работу с ботом'
    },
    {
      command: 'help',
      description: 'Помощь и инструкции'
    },
    {
      command: 'profile',
      description: 'Мой профиль'
    },
    {
      command: 'orders',
      description: 'Мои заказы'
    },
    {
      command: 'balance',
      description: 'Баланс и пополнение'
    },
    {
      command: 'support',
      description: 'Связаться с поддержкой'
    }
  ],
  
  // Админ команды
  adminCommands: [
    {
      command: 'admin',
      description: 'Админ панель'
    },
    {
      command: 'stats',
      description: 'Статистика'
    }
  ]
} as const

// Типы для Telegram объектов
export interface TelegramUser {
  id: number
  is_bot: boolean
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
}

export interface TelegramChat {
  id: number
  type: 'private' | 'group' | 'supergroup' | 'channel'
  title?: string
  username?: string
  first_name?: string
  last_name?: string
}

export interface TelegramMessage {
  message_id: number
  from?: TelegramUser
  chat: TelegramChat
  date: number
  text?: string
  entities?: any[]
  photo?: any[]
  document?: any
  video?: any
  audio?: any
  voice?: any
  video_note?: any
  contact?: any
  location?: any
  reply_to_message?: TelegramMessage
}

export interface TelegramCallbackQuery {
  id: string
  from: TelegramUser
  message?: TelegramMessage
  inline_message_id?: string
  chat_instance: string
  data?: string
  game_short_name?: string
}

export interface TelegramInlineQuery {
  id: string
  from: TelegramUser
  query: string
  offset: string
  chat_type?: string
  location?: any
}

export interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  edited_message?: TelegramMessage
  channel_post?: TelegramMessage
  edited_channel_post?: TelegramMessage
  inline_query?: TelegramInlineQuery
  chosen_inline_result?: any
  callback_query?: TelegramCallbackQuery
  shipping_query?: any
  pre_checkout_query?: any
  poll?: any
  poll_answer?: any
  my_chat_member?: any
  chat_member?: any
  chat_join_request?: any
}

// Типы для клавиатур
export interface InlineKeyboardButton {
  text: string
  url?: string
  callback_data?: string
  web_app?: any
  login_url?: any
  switch_inline_query?: string
  switch_inline_query_current_chat?: string
  copy_text?: any
  pay?: boolean
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][]
}

export interface ReplyKeyboardButton {
  text: string
  request_contact?: boolean
  request_location?: boolean
  request_poll?: any
  web_app?: any
}

export interface ReplyKeyboardMarkup {
  keyboard: ReplyKeyboardButton[][]
  is_persistent?: boolean
  resize_keyboard?: boolean
  one_time_keyboard?: boolean
  input_field_placeholder?: string
  selective?: boolean
}

// Утилиты для создания клавиатур
export class KeyboardBuilder {
  private buttons: InlineKeyboardButton[][] = []
  
  // Добавить кнопку в новый ряд
  button(text: string, callbackData?: string, url?: string): KeyboardBuilder {
    const button: InlineKeyboardButton = { text }
    
    if (callbackData) button.callback_data = callbackData
    if (url) button.url = url
    
    this.buttons.push([button])
    return this
  }
  
  // Добавить кнопки в один ряд
  row(...buttons: { text: string, callbackData?: string, url?: string }[]): KeyboardBuilder {
    const row: InlineKeyboardButton[] = buttons.map(btn => {
      const button: InlineKeyboardButton = { text: btn.text }
      if (btn.callbackData) button.callback_data = btn.callbackData
      if (btn.url) button.url = btn.url
      return button
    })
    
    this.buttons.push(row)
    return this
  }
  
  // Создать клавиатуру
  build(): InlineKeyboardMarkup {
    return { inline_keyboard: this.buttons }
  }
  
  // Статический метод для быстрого создания
  static create(): KeyboardBuilder {
    return new KeyboardBuilder()
  }
}

// Утилиты для форматирования текста
export class TextFormatter {
  // Экранирование специальных символов для MarkdownV2
  static escapeMarkdownV2(text: string): string {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&')
  }
  
  // Экранирование для HTML
  static escapeHTML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }
  
  // Жирный текст
  static bold(text: string): string {
    return `<b>${this.escapeHTML(text)}</b>`
  }
  
  // Курсив
  static italic(text: string): string {
    return `<i>${this.escapeHTML(text)}</i>`
  }
  
  // Подчеркнутый текст
  static underline(text: string): string {
    return `<u>${this.escapeHTML(text)}</u>`
  }
  
  // Зачеркнутый текст
  static strikethrough(text: string): string {
    return `<s>${this.escapeHTML(text)}</s>`
  }
  
  // Моноширинный текст
  static code(text: string): string {
    return `<code>${this.escapeHTML(text)}</code>`
  }
  
  // Блок кода
  static pre(text: string, language?: string): string {
    const escaped = this.escapeHTML(text)
    return language ? `<pre><code class="language-${language}">${escaped}</code></pre>` : `<pre>${escaped}</pre>`
  }
  
  // Ссылка
  static link(text: string, url: string): string {
    return `<a href="${url}">${this.escapeHTML(text)}</a>`
  }
  
  // Упоминание пользователя
  static mention(text: string, userId: number): string {
    return `<a href="tg://user?id=${userId}">${this.escapeHTML(text)}</a>`
  }
}

// Валидация Telegram данных
export class TelegramValidator {
  // Проверка валидности Telegram ID
  static isValidTelegramId(id: number): boolean {
    return Number.isInteger(id) && id > 0 && id < 2147483647
  }
  
  // Проверка валидности username
  static isValidUsername(username: string): boolean {
    return /^[a-zA-Z0-9_]{5,32}$/.test(username)
  }
  
  // Проверка длины сообщения
  static isValidMessageLength(text: string): boolean {
    return text.length <= TELEGRAM_CONFIG.limits.messageLength
  }
  
  // Проверка размера файла
  static isValidFileSize(size: number, type: 'photo' | 'video' | 'audio' | 'document'): boolean {
    const limits = TELEGRAM_CONFIG.limits
    switch (type) {
      case 'photo': return size <= limits.photoSize
      case 'video': return size <= limits.videoSize
      case 'audio': return size <= limits.audioSize
      case 'document': return size <= limits.documentSize
      default: return false
    }
  }
}

// Deep linking утилиты
export class DeepLinkBuilder {
  private botUsername: string
  
  constructor(botUsername: string) {
    this.botUsername = botUsername
  }
  
  // Создать deep link
  create(payload?: string): string {
    const baseUrl = `https://t.me/${this.botUsername}`
    return payload ? `${baseUrl}?start=${payload}` : baseUrl
  }
  
  // Deep link для заказа
  order(orderId: string): string {
    return this.create(`order_${orderId}`)
  }
  
  // Deep link для реферальной программы
  referral(userId: string): string {
    return this.create(`ref_${userId}`)
  }
  
  // Deep link для поддержки
  support(ticketId?: string): string {
    return ticketId ? this.create(`support_${ticketId}`) : this.create('support')
  }
}

// Экспорт конфигурации и утилит
export { 
  TelegramUser,
  TelegramChat,
  TelegramMessage,
  TelegramCallbackQuery,
  TelegramUpdate,
  InlineKeyboardMarkup,
  ReplyKeyboardMarkup
}