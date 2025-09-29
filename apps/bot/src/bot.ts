import { Bot, Context, session, SessionFlavor } from 'grammy'
import { conversations, ConversationFlavor, createConversation } from '@grammyjs/conversations'
import { hydrate, HydrateFlavor } from '@grammyjs/hydrate'
import { parseMode, ParseModeFlavor } from '@grammyjs/parse-mode'

// Импорты конфигурации
import { env, getTelegramConfig, RuntimeUrls, getApiUrl, getFrontendUrl, getAdminDashboardUrl } from '@cargo/config'
import { prisma } from '@cargo/database'
import { redisHelper } from '@cargo/config'
import { BotCommand } from '@cargo/shared'

// Импорты обработчиков
import { setupCommands } from './handlers/commands'
import { setupCallbacks } from './handlers/callbacks'
import { setupMessages } from './handlers/messages'
import { setupScenes } from './handlers/scenes'

// Импорты middleware
import { setupAuth } from './middleware/auth'
import { setupLogging } from './middleware/logging'
import { setupSession } from './middleware/session'
import { setupErrorHandler } from './middleware/errorHandler'

// Импорты сервисов
import { BotServices } from './services'

// Типы сессии
interface SessionData {
  scene?: string
  data?: Record<string, any>
  userId?: bigint
  adminId?: number
  lastActivity?: Date
}

// Контекст бота
type BotContext = Context & 
  SessionFlavor<SessionData> & 
  ConversationFlavor & 
  HydrateFlavor<Context> & 
  ParseModeFlavor<Context> & {
    services: BotServices
  }

class CargoExpressBot {
  private bot: Bot<BotContext>
  private services: BotServices

  constructor() {
    // Инициализируем URL конфигурацию
    RuntimeUrls.init({
      apiUrl: getApiUrl(),
      frontendUrl: getFrontendUrl(),
      adminDashboardUrl: getAdminDashboardUrl()
    })

    // Создаем бота
    const telegramConfig = getTelegramConfig()
    this.bot = new Bot<BotContext>(telegramConfig.token)

    // Инициализируем сервисы
    this.services = new BotServices(prisma, redisHelper)

    console.log('🤖 CargoExpress Bot initializing...')
    console.log('📍 URLs:', RuntimeUrls.getConfig())
  }

  async initialize(): Promise<void> {
    try {
      // Настраиваем middleware
      this.setupMiddleware()

      // Настраиваем обработчики
      this.setupHandlers()

      // Устанавливаем команды бота
      await this.setupBotCommands()

      console.log('✅ Bot initialized successfully')
    } catch (error) {
      console.error('❌ Bot initialization failed:', error)
      throw error
    }
  }

  private setupMiddleware(): void {
    // Hydration для автообновления сообщений
    this.bot.use(hydrate())

    // Parse mode для HTML форматирования
    this.bot.use(parseMode('HTML'))

    // Логирование
    this.bot.use(setupLogging())

    // Сессии
    this.bot.use(session({
      initial: (): SessionData => ({}),
      storage: setupSession(redisHelper)
    }))

    // Conversations для диалогов
    this.bot.use(conversations())

    // Аутентификация и авторизация
    this.bot.use(setupAuth(this.services))

    // Добавляем сервисы в контекст
    this.bot.use((ctx, next) => {
      ctx.services = this.services
      return next()
    })

    // Обработка ошибок
    this.bot.catch(setupErrorHandler())
  }

  private setupHandlers(): void {
    // Команды (/start, /admin, /dashboard и т.д.)
    setupCommands(this.bot, this.services)

    // Callback queries (inline кнопки)
    setupCallbacks(this.bot, this.services)

    // Текстовые сообщения
    setupMessages(this.bot, this.services)

    // Сцены разговоров
    setupScenes(this.bot, this.services)
  }

  private async setupBotCommands(): Promise<void> {
    const commands = [
      { command: 'start', description: 'Начать работу с ботом' },
      { command: 'help', description: 'Помощь и инструкции' },
      { command: 'profile', description: 'Мой профиль' },
      { command: 'orders', description: 'Мои заказы' },
      { command: 'balance', description: 'Баланс и пополнение' },
      { command: 'support', description: 'Связаться с поддержкой' }
    ]

    await this.bot.api.setMyCommands(commands)
    console.log('📝 Bot commands set')
  }

  async start(): Promise<void> {
    if (env.NODE_ENV === 'production' && env.TELEGRAM_WEBHOOK_URL) {
      // Production: используем webhook
      await this.setupWebhook()
    } else {
      // Development: используем polling
      await this.startPolling()
    }
  }

  private async setupWebhook(): Promise<void> {
    const webhookUrl = env.TELEGRAM_WEBHOOK_URL!
    const webhookSecret = env.TELEGRAM_WEBHOOK_SECRET

    await this.bot.api.setWebhook(webhookUrl, {
      secret_token: webhookSecret,
      max_connections: 100,
      allowed_updates: ['message', 'callback_query', 'inline_query']
    })

    console.log(`🕸️ Webhook set: ${webhookUrl}`)
  }

  private async startPolling(): Promise<void> {
    console.log('🔄 Starting polling...')
    
    // Graceful shutdown
    const handleShutdown = async (signal: string) => {
      console.log(`\n📴 Received ${signal}, shutting down gracefully...`)
      await this.bot.stop()
      await prisma.$disconnect()
      await redisHelper.redis.quit()
      process.exit(0)
    }

    process.on('SIGINT', () => handleShutdown('SIGINT'))
    process.on('SIGTERM', () => handleShutdown('SIGTERM'))

    // Запускаем бота
    await this.bot.start({
      onStart: (botInfo) => {
        console.log(`🚀 Bot @${botInfo.username} started successfully!`)
        console.log(`🆔 Bot ID: ${botInfo.id}`)
        console.log(`👤 Bot Name: ${botInfo.first_name}`)
      }
    })
  }

  async stop(): Promise<void> {
    console.log('⏹️ Stopping bot...')
    await this.bot.stop()
    console.log('✅ Bot stopped')
  }

  // Getter для использования в Express (для webhook)
  get webhookCallback() {
    return this.bot.webhookCallback
  }
}

// Запуск бота
async function main() {
  try {
    const bot = new CargoExpressBot()
    await bot.initialize()
    await bot.start()
  } catch (error) {
    console.error('💥 Fatal error:', error)
    process.exit(1)
  }
}

// Запускаем если файл вызван напрямую
if (require.main === module) {
  main()
}

export { CargoExpressBot, BotContext }
export default CargoExpressBot