import { Middleware } from 'grammy'
import { BotContext } from '../bot'
import { BotServices } from '../services'
import { ErrorUtils } from './errorHandler'

export function setupAuth(services: BotServices): Middleware<BotContext> {
  return async (ctx, next) => {
    // Проверяем что это личное сообщение
    if (ctx.chat?.type !== 'private') {
      return // Игнорируем сообщения из групп
    }

    // Получаем данные пользователя из Telegram
    const telegramUser = ctx.from
    if (!telegramUser) {
      return
    }

    try {
      // Получаем или создаем пользователя
      const user = await services.user.getOrCreate({
        telegramId: BigInt(telegramUser.id),
        username: telegramUser.username,
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name
      })

      // Проверяем не заблокирован ли пользователь
      if (user.isBlocked) {
        await ctx.reply(
          'Ваш аккаунт заблокирован. Обратитесь в поддержку для получения дополнительной информации.',
          {
            reply_markup: {
              inline_keyboard: [[
                { text: 'Поддержка', url: 'https://t.me/support' }
              ]]
            }
          }
        )
        return
      }

      // Добавляем пользователя в онлайн
      await services.user.addOnline(BigInt(telegramUser.id))

      // Проверяем не истек ли VIP
      if (user.isVip) {
        const vipExpired = await services.user.checkVipExpiration(BigInt(telegramUser.id))
        if (vipExpired) {
          // Уведомляем об истечении VIP
          await services.notification.sendVipExpired(user.id)
        }
      }

      // Сохраняем пользователя в сессии
      ctx.session.userId = user.id
      ctx.session.lastActivity = new Date()

      // Продолжаем обработку
      await next()

    } catch (error) {
      console.error('Auth middleware error:', error)
      
      await ctx.reply(
        'Произошла ошибка при авторизации. Попробуйте позже или обратитесь в поддержку.',
        {
          reply_markup: {
            inline_keyboard: [[
              { text: 'Поддержка', callback_data: 'contact_support' }
            ]]
          }
        }
      )
    }
  }
}

export function requireAuth(): Middleware<BotContext> {
  return async (ctx, next) => {
    if (!ctx.session.userId) {
      await ctx.reply(
        'Для использования бота необходимо авторизоваться. Напишите /start'
      )
      return
    }

    await next()
  }
}

export function requireAdmin(): Middleware<BotContext> {
  return async (ctx, next) => {
    if (!ctx.from) {
      return
    }

    try {
      const result = await ctx.services.adminMiddleware.checkAdminAccess(
        BigInt(ctx.from.id)
      )

      if (!result.isAdmin) {
        await ctx.reply(
          'У вас нет прав администратора для выполнения этой команды.'
        )
        return
      }

      // Проверяем права доступа к конкретному действию
      const hasAccess = ctx.services.adminMiddleware.checkPermission(
        result.admin,
        'dashboard_access'
      )

      if (!hasAccess) {
        await ctx.reply(
          `У вас недостаточно прав для выполнения этой команды. Ваша роль: ${result.admin.role}`
        )
        return
      }

      // Сохраняем админа в сессии
      ctx.session.adminId = result.admin.id

      await next()

    } catch (error) {
      console.error('Admin auth error:', error)
      await ctx.reply(
        'Ошибка проверки прав администратора. Попробуйте позже.'
      )
    }
  }
}

// Middleware для проверки VIP статуса
export function requireVip(): Middleware<BotContext> {
  return async (ctx, next) => {
    try {
      const userId = await ErrorUtils.validateUser(ctx)
      const user = await ctx.services.user.getByTelegramId(BigInt(ctx.from!.id))

      if (!user?.isVip) {
        await ctx.reply(
          'Эта функция доступна только VIP пользователям.',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Стать VIP', callback_data: 'become_vip' }]
              ]
            }
          }
        )
        return
      }

      await next()
    } catch (error) {
      // Ошибка уже обработана в validateUser
    }
  }
}

// Middleware для ограничения частоты запросов
export function rateLimit(maxRequests: number = 10, windowMs: number = 60000): Middleware<BotContext> {
  return async (ctx, next) => {
    if (!ctx.from) {
      return
    }

    const userId = ctx.from.id
    const key = `rate_limit:${userId}`
    
    try {
      const current = await ctx.services.redis?.get(key)
      const requests = current ? parseInt(current) : 0

      if (requests >= maxRequests) {
        await ctx.reply('Слишком много запросов. Попробуйте позже.')
        return
      }

      // Увеличиваем счетчик
      if (requests === 0) {
        await ctx.services.redis?.setWithTTL(key, '1', Math.floor(windowMs / 1000))
      } else {
        await ctx.services.redis?.incr(key)
      }

      await next()
    } catch (error) {
      console.error('Rate limit error:', error)
      // В случае ошибки пропускаем проверку
      await next()
    }
  }
}

// Middleware для проверки технического обслуживания
export function maintenanceMode(): Middleware<BotContext> {
  return async (ctx, next) => {
    // Проверяем флаг технического обслуживания
    const isMaintenanceMode = process.env.MAINTENANCE_MODE === 'true'
    
    if (isMaintenanceMode) {
      // Разрешаем админам пользоваться ботом во время техобслуживания
      const isAdmin = ctx.session.adminId !== undefined
      
      if (!isAdmin) {
        await ctx.reply(
          '🔧 Проводятся технические работы. Бот временно недоступен.\n\nПопробуйте позже.',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Поддержка', url: 'https://t.me/support' }]
              ]
            }
          }
        )
        return
      }
    }

    await next()
  }
}