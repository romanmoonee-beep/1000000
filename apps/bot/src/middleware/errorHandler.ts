import { ErrorHandler } from 'grammy'
import { BotContext } from '../bot'
import { GrammyError, HttpError } from 'grammy'

export function setupErrorHandler(): ErrorHandler<BotContext> {
  return async (error) => {
    const ctx = error.ctx
    const e = error.error

    console.error(`Error while handling update ${ctx.update.update_id}:`)

    // Получаем информацию о пользователе для логов
    const user = ctx.from
    const userInfo = user ? `@${user.username || user.first_name || user.id}` : 'Unknown'

    if (e instanceof GrammyError) {
      // Ошибки Telegram API
      console.error('Error in request:', e.description)
      
      switch (e.error_code) {
        case 400:
          // Bad Request - некорректный запрос
          if (e.description.includes('message is not modified')) {
            // Игнорируем ошибки когда сообщение не изменилось
            return
          }
          if (e.description.includes('query is too old')) {
            // Игнорируем старые callback запросы
            return
          }
          break

        case 403:
          // Forbidden - бот заблокирован пользователем
          console.log(`Bot blocked by user ${userInfo}`)
          
          if (ctx.services && user) {
            try {
              await ctx.services.user.removeOnline(BigInt(user.id))
            } catch (err) {
              console.error('Error removing user from online:', err)
            }
          }
          return

        case 429:
          // Too Many Requests - rate limit
          console.warn(`Rate limit exceeded for user ${userInfo}`)
          return

        case 500:
        case 502:
        case 503:
          // Проблемы на стороне Telegram
          console.error('Telegram server error:', e.description)
          break
      }

      // Отправляем пользователю сообщение об ошибке
      await sendErrorMessage(ctx, 'Произошла техническая ошибка. Попробуйте позже.')

    } else if (e instanceof HttpError) {
      // Ошибки сети
      console.error('Could not contact Telegram:', e)
      
    } else {
      // Все остальные ошибки
      console.error('Unknown error:', e)

      // Определяем тип ошибки и отправляем соответствующее сообщение
      let userMessage = 'Произошла неожиданная ошибка. Наша команда уже работает над исправлением.'

      if (e instanceof Error) {
        // Проверяем известные типы ошибок
        if (e.message.includes('User not found')) {
          userMessage = 'Пользователь не найден. Попробуйте начать заново с команды /start'
        } else if (e.message.includes('Insufficient balance')) {
          userMessage = 'Недостаточно средств на балансе. Пополните баланс для продолжения.'
        } else if (e.message.includes('Order not found')) {
          userMessage = 'Заказ не найден. Проверьте номер заказа и попробуйте снова.'
        } else if (e.message.includes('Invalid')) {
          userMessage = 'Некорректные данные. Проверьте введенную информацию.'
        } else if (e.message.includes('timeout') || e.message.includes('ETIMEDOUT')) {
          userMessage = 'Превышено время ожидания. Попробуйте позже.'
        } else if (e.message.includes('Database') || e.message.includes('connection')) {
          userMessage = 'Временные проблемы с базой данных. Попробуйте через несколько минут.'
        }
      }

      await sendErrorMessage(ctx, userMessage)

      // Сохраняем детальную информацию об ошибке для анализа
      await logErrorForAnalysis(ctx, e, userInfo)
    }
  }
}

async function sendErrorMessage(ctx: BotContext, message: string): Promise<void> {
  try {
    await ctx.reply(message, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🏠 Главное меню', callback_data: 'main_menu' },
            { text: '💬 Поддержка', callback_data: 'contact_support' }
          ]
        ]
      }
    })
  } catch (error) {
    // Если не можем отправить сообщение, просто логируем
    console.error('Failed to send error message to user:', error)
  }
}

async function logErrorForAnalysis(ctx: BotContext, error: any, userInfo: string): Promise<void> {
  try {
    const errorData = {
      timestamp: new Date().toISOString(),
      updateId: ctx.update.update_id,
      user: userInfo,
      userId: ctx.from?.id,
      chatId: ctx.chat?.id,
      messageType: getMessageType(ctx),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      session: ctx.session,
      environment: process.env.NODE_ENV
    }

    // Сохраняем в Redis для последующего анализа
    if (ctx.services) {
      const errorKey = `error_log:${Date.now()}:${ctx.update.update_id}`
      await ctx.services.redis?.setWithTTL(errorKey, errorData, 7 * 24 * 60 * 60) // 7 дней
    }

    // В production также отправляем в мониторинг (Sentry, LogRocket и т.д.)
    if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
      // TODO: Интеграция с Sentry
      console.log('Error logged for analysis:', errorData)
    }

  } catch (logError) {
    console.error('Failed to log error for analysis:', logError)
  }
}

function getMessageType(ctx: BotContext): string {
  if (ctx.message) {
    if (ctx.message.text) return 'text'
    if (ctx.message.photo) return 'photo'
    if (ctx.message.document) return 'document'
    if (ctx.message.voice) return 'voice'
    if (ctx.message.video) return 'video'
    if (ctx.message.contact) return 'contact'
    if (ctx.message.location) return 'location'
    return 'message'
  }
  
  if (ctx.callbackQuery) return 'callback_query'
  if (ctx.inlineQuery) return 'inline_query'
  if (ctx.chosenInlineResult) return 'chosen_inline_result'
  
  return 'unknown'
}

// Middleware для отлова необработанных промисов
export function setupGlobalErrorHandlers(): void {
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason)
    
    // В production отправляем в мониторинг
    if (process.env.NODE_ENV === 'production') {
      // TODO: Интеграция с системой мониторинга
    }
  })

  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error)
    
    // В production отправляем в мониторинг и перезапускаем процесс
    if (process.env.NODE_ENV === 'production') {
      // TODO: Интеграция с системой мониторинга
      process.exit(1)
    }
  })
}

// Утилиты для обработки ошибок в хендлерах
export class ErrorUtils {
  static async handleAsync<T>(
    promise: Promise<T>,
    ctx?: BotContext,
    fallbackMessage?: string
  ): Promise<[T | null, Error | null]> {
    try {
      const result = await promise
      return [result, null]
    } catch (error) {
      console.error('Async operation failed:', error)
      
      if (ctx && fallbackMessage) {
        await sendErrorMessage(ctx, fallbackMessage)
      }
      
      return [null, error instanceof Error ? error : new Error(String(error))]
    }
  }

  static wrapHandler(handler: (ctx: BotContext) => Promise<void>) {
    return async (ctx: BotContext) => {
      try {
        await handler(ctx)
      } catch (error) {
        console.error('Handler error:', error)
        await sendErrorMessage(
          ctx, 
          'Произошла ошибка при обработке вашего запроса. Попробуйте позже.'
        )
      }
    }
  }

  static async validateRequired<T>(
    value: T | undefined | null,
    ctx: BotContext,
    errorMessage: string
  ): Promise<T> {
    if (value === undefined || value === null) {
      await sendErrorMessage(ctx, errorMessage)
      throw new Error(errorMessage)
    }
    return value
  }

  static async validateUser(ctx: BotContext): Promise<bigint> {
    const userId = ctx.session.userId
    if (!userId) {
      await sendErrorMessage(ctx, 'Сессия истекла. Начните заново с команды /start')
      throw new Error('User session not found')
    }
    return userId
  }

  static async validateAdmin(ctx: BotContext): Promise<number> {
    const adminId = ctx.session.adminId
    if (!adminId) {
      await sendErrorMessage(ctx, 'У вас нет прав администратора')
      throw new Error('Admin session not found')
    }
    return adminId
  }
}

// Декоратор для автоматической обработки ошибок
export function handleErrors(target: any, propertyName: string, descriptor: PropertyDescriptor) {
  const method = descriptor.value

  descriptor.value = async function (...args: any[]) {
    try {
      return await method.apply(this, args)
    } catch (error) {
      console.error(`Error in ${target.constructor.name}.${propertyName}:`, error)
      
      // Если первый аргумент это контекст бота
      const ctx = args[0]
      if (ctx && typeof ctx.reply === 'function') {
        await sendErrorMessage(ctx, 'Произошла ошибка при выполнении операции.')
      }
      
      throw error
    }
  }

  return descriptor
}