import { CommandContext } from 'grammy'
import { BotContext } from '../../bot'
import { requireAdmin } from '../../middleware'

export async function handleAdminCommand(ctx: CommandContext<BotContext>) {
  try {
    const user = ctx.from
    if (!user) return

    // Проверяем является ли пользователь админом
    const adminCheck = await ctx.services.adminMiddleware.checkAdminAccess(
      BigInt(user.id)
    )

    if (!adminCheck.isAdmin) {
      await ctx.reply(
        'У вас нет прав администратора для доступа к этой панели.',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
            ]
          }
        }
      )
      return
    }

    const admin = adminCheck.admin

    // Получаем статистику для админ панели
    const [orderStats, paymentStats, supportStats] = await Promise.all([
      ctx.services.order.getOrderStats(),
      ctx.services.payment.getPaymentStats(),
      ctx.services.support.getSupportStats()
    ])

    const dashboardText = `
🔧 <b>AdminPanel CargoExpress</b>
👨‍💼 ${admin.firstName || admin.username} | ${admin.role}

📊 <b>DASHBOARD (${new Date().toLocaleDateString('ru-RU')})</b>

💰 <b>ФИНАНСЫ ЗА СЕГОДНЯ:</b>
├ Выручка: ${paymentStats.today.amount.toLocaleString('ru-RU')}₽
├ Платежей: ${paymentStats.today.count} шт
└ Ожидают: ${paymentStats.pending.count} (${paymentStats.pending.amount.toLocaleString('ru-RU')}₽)

📦 <b>ЗАКАЗЫ ЗА СЕГОДНЯ:</b>
├ Создано: ${orderStats.today.total} заказов
├ Активных: ${orderStats.active.total} заказов
└ Проблемных: ${orderStats.problems.total} заказов

💬 <b>ПОДДЕРЖКА:</b>
├ Открытых чатов: ${supportStats.active.openChats}
├ В очереди: ${supportStats.queue.pending} обращений
└ Средняя оценка: ⭐ ${supportStats.today.averageResponseTime || 'N/A'}`

    const keyboard = []

    // Кнопки в зависимости от роли
    if (admin.role === 'SUPER_ADMIN' || admin.role === 'ORDER_MANAGER') {
      keyboard.push([
        { text: `📦 Заказы${orderStats.problems.total > 0 ? ` (${orderStats.problems.total}⚠️)` : ''}`, callback_data: 'admin_orders' },
        { text: '👥 Пользователи', callback_data: 'admin_users' }
      ])
    }

    if (admin.role === 'SUPER_ADMIN' || admin.role === 'FINANCE_MANAGER') {
      keyboard.push([
        { text: `💰 Финансы${paymentStats.pending.count > 0 ? ` (${paymentStats.pending.count}⚠️)` : ''}`, callback_data: 'admin_finance' },
        { text: '📊 Аналитика', callback_data: 'admin_analytics' }
      ])
    }

    if (admin.role === 'SUPER_ADMIN' || admin.role === 'SUPPORT_OPERATOR') {
      keyboard.push([
        { text: `💬 Поддержка${supportStats.queue.pending > 0 ? ` (${supportStats.queue.pending}🔥)` : ''}`, callback_data: 'admin_support' }
      ])
    }

    if (admin.role === 'SUPER_ADMIN' || admin.role === 'CONTENT_MANAGER') {
      keyboard.push([
        { text: '🌍 Страны и склады', callback_data: 'admin_countries' }
      ])
    }

    if (admin.role === 'SUPER_ADMIN') {
      keyboard.push([
        { text: '⚙️ Настройки', callback_data: 'admin_settings' },
        { text: '👨‍💼 Администраторы', callback_data: 'admin_admins' }
      ])
    }

    // Общие кнопки
    keyboard.push([
      { text: '🌐 Веб админка', callback_data: 'web_dashboard' },
      { text: '🔄 Обновить', callback_data: 'refresh_admin' }
    ])

    await ctx.reply(dashboardText, {
      reply_markup: { inline_keyboard: keyboard }
    })

  } catch (error) {
    console.error('Admin command error:', error)
    await ctx.reply(
      'Произошла ошибка при загрузке админ панели. Попробуйте позже.',
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