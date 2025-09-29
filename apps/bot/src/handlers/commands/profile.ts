import { CommandContext } from 'grammy'
import { BotContext } from '../../bot'
import { ErrorUtils } from '../../middleware'

export async function handleProfileCommand(ctx: CommandContext<BotContext>) {
  try {
    const userId = await ErrorUtils.validateUser(ctx)
    const user = await ctx.services.user.getByTelegramId(BigInt(ctx.from!.id))
    
    if (!user) {
      await ctx.reply('Профиль не найден. Начните с команды /start')
      return
    }

    // Получаем статистику пользователя
    const [stats, activeOrders] = await Promise.all([
      ctx.services.user.getUserStats(user.telegramId),
      ctx.services.order.getActiveUserOrders(user.id)
    ])

    const vipStatus = user.isVip && user.vipExpiresAt
      ? ` | VIP до ${user.vipExpiresAt.toLocaleDateString('ru-RU')}`
      : ''

    const profileText = `
👤 <b>${user.firstName || 'Пользователь'} ${user.lastName || ''}</b>
🆔 ID: #${user.id} | 💰 Баланс: ${user.balance.toLocaleString('ru-RU')}₽

📊 <b>Ваша статистика:</b>
├ Заказов всего: ${stats.totalOrders}
├ Активных: ${activeOrders.count}  
├ Потрачено: ${stats.totalSpent.toLocaleString('ru-RU')}₽
├ Средний чек: ${stats.averageOrderValue.toLocaleString('ru-RU')}₽
└ Дней с нами: ${stats.registrationDays}${vipStatus}

📱 <b>Контакты:</b>
${user.phone ? `├ Телефон: ${user.phone}` : '├ Телефон: не указан'}
${user.email ? `├ Email: ${user.email}` : '├ Email: не указан'}
${user.city ? `└ Город: ${(user as any).city?.name || 'не указан'}` : '└ Город: не указан'}`

    await ctx.reply(profileText, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📦 Мои заказы', callback_data: 'my_orders' },
            { text: '💰 Пополнить баланс', callback_data: 'top_up_balance' }
          ],
          [
            { text: '📍 Отследить посылку', callback_data: 'track_package' },
            { text: '💬 Поддержка', callback_data: 'contact_support' }
          ],
          [
            { text: '✏️ Редактировать профиль', callback_data: 'edit_profile' },
            { text: '⚙️ Настройки', callback_data: 'profile_settings' }
          ],
          [
            { text: '🎁 Реферальная программа', callback_data: 'referral_program' }
          ],
          [
            { text: '🏠 Главное меню', callback_data: 'main_menu' }
          ]
        ]
      }
    })

  } catch (error) {
    console.error('Profile command error:', error)
    await ctx.reply('Ошибка при загрузке профиля.')
  }
}