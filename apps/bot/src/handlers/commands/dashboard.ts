import { CommandContext } from 'grammy'
import { BotContext } from '../../bot'
import { requireAdmin } from '../../middleware'
import { AdminBotMessages } from '@cargo/shared'

export async function handleDashboardCommand(ctx: CommandContext<BotContext>) {
  try {
    const user = ctx.from
    if (!user) return

    // Проверяем является ли пользователь админом
    const adminCheck = await ctx.services.adminMiddleware.checkAdminAccess(
      BigInt(user.id)
    )

    if (!adminCheck.isAdmin) {
      await ctx.reply(AdminBotMessages.accessDenied())
      return
    }

    const admin = adminCheck.admin

    // Проверяем права доступа к админ панели
    const hasAccess = ctx.services.adminMiddleware.checkPermission(
      admin,
      'dashboard_access'
    )

    if (!hasAccess) {
      await ctx.reply(AdminBotMessages.accessDenied(admin.role))
      return
    }

    // Генерируем токен доступа к админ панели
    const access = await ctx.services.adminAuth.generateDashboardAccess(
      admin.id,
      ctx.from?.id?.toString() // IP адрес заменяем на Telegram ID
    )

    // Отправляем ссылку для доступа
    await ctx.reply(AdminBotMessages.dashboardAccess(access), {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { 
              text: '🔗 Открыть админ панель', 
              url: access.dashboardUrl 
            }
          ],
          [
            { 
              text: '📋 Скопировать ключ', 
              callback_data: `copy_access_key_${access.accessKey}` 
            }
          ],
          [
            { text: '🔄 Новый токен', callback_data: 'generate_new_dashboard_token' },
            { text: '❌ Отменить', callback_data: 'cancel_dashboard_access' }
          ]
        ]
      }
    })

    // Логируем генерацию токена
    console.log(`🔐 Dashboard token generated for admin ${admin.firstName || admin.username} (${admin.id})`)

  } catch (error) {
    console.error('Dashboard command error:', error)
    await ctx.reply(
      'Произошла ошибка при генерации доступа к админ панели. Попробуйте позже.',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '💬 Поддержка', callback_data: 'contact_support' }]
          ]
        }
      }
    )
  }
}

// Обработчик для генерации нового токена
export async function handleNewDashboardToken(ctx: any) {
  try {
    await ctx.answerCallbackQuery('Генерирую новый токен...')

    const user = ctx.from
    if (!user) return

    // Проверяем админа
    const adminCheck = await ctx.services.adminMiddleware.checkAdminAccess(
      BigInt(user.id)
    )

    if (!adminCheck.isAdmin) {
      await ctx.editMessageText(AdminBotMessages.accessDenied())
      return
    }

    const admin = adminCheck.admin

    // Отзываем старые токены
    await ctx.services.adminAuth.revokeAdminTokens(admin.id)

    // Генерируем новый токен
    const access = await ctx.services.adminAuth.generateDashboardAccess(
      admin.id,
      user.id.toString()
    )

    // Обновляем сообщение
    await ctx.editMessageText(AdminBotMessages.dashboardAccess(access), {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { 
              text: '🔗 Открыть админ панель', 
              url: access.dashboardUrl 
            }
          ],
          [
            { 
              text: '📋 Скопировать ключ', 
              callback_data: `copy_access_key_${access.accessKey}` 
            }
          ],
          [
            { text: '🔄 Новый токен', callback_data: 'generate_new_dashboard_token' },
            { text: '❌ Отменить', callback_data: 'cancel_dashboard_access' }
          ]
        ]
      }
    })

  } catch (error) {
    console.error('New dashboard token error:', error)
    await ctx.answerCallbackQuery('Ошибка при генерации нового токена')
  }
}

// Обработчик для копирования ключа доступа
export async function handleCopyAccessKey(ctx: any, accessKey: string) {
  try {
    await ctx.answerCallbackQuery('Ключ скопирован!')

    // Отправляем ключ отдельным сообщением для удобного копирования
    await ctx.reply(
      `🔑 <b>Ключ доступа:</b>\n<code>${accessKey}</code>`,
      { parse_mode: 'HTML' }
    )

  } catch (error) {
    console.error('Copy access key error:', error)
    await ctx.answerCallbackQuery('Ошибка при копировании ключа')
  }
}

// Обработчик для отмены доступа
export async function handleCancelDashboardAccess(ctx: any) {
  try {
    await ctx.answerCallbackQuery('Доступ отменен')

    const user = ctx.from
    if (!user) return

    // Проверяем админа
    const adminCheck = await ctx.services.adminMiddleware.checkAdminAccess(
      BigInt(user.id)
    )

    if (adminCheck.isAdmin) {
      // Отзываем все токены админа
      await ctx.services.adminAuth.revokeAdminTokens(adminCheck.admin.id)
    }

    await ctx.editMessageText(
      '❌ Доступ к админ панели отменен.\n\nВсе активные токены были отозваны.',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Новый доступ', callback_data: 'generate_new_dashboard_token' }]
          ]
        }
      }
    )

  } catch (error) {
    console.error('Cancel dashboard access error:', error)
    await ctx.answerCallbackQuery('Ошибка при отмене доступа')
  }
}