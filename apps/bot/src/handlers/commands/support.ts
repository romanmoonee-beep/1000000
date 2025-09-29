import { CommandContext } from 'grammy'
import { BotContext } from '../../bot'
import { ErrorUtils } from '../../middleware'

export async function handleSupportCommand(ctx: CommandContext<BotContext>) {
  try {
    const supportText = `
💬 <b>Поддержка CargoExpress</b>
🟢 Онлайн 24/7 | Средний ответ: 3 минуты

<b>Как можем помочь?</b>`

    await ctx.reply(supportText, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '❓ Частые вопросы', callback_data: 'faq' },
            { text: '📍 Где моя посылка?', callback_data: 'track_package' }
          ],
          [
            { text: '💰 Вопросы по оплате', callback_data: 'payment_support' },
            { text: '📦 Проблема с заказом', callback_data: 'order_support' }
          ],
          [
            { text: '🛒 Помощь с выкупом', callback_data: 'purchase_support' },
            { text: '🏢 Вопрос по складу', callback_data: 'warehouse_support' }
          ],
          [
            { text: '💬 Чат с оператором', callback_data: 'contact_support' }
          ],
          [
            { text: '🏠 Главное меню', callback_data: 'main_menu' }
          ]
        ]
      }
    })

  } catch (error) {
    console.error('Support command error:', error)
    await ctx.reply('Ошибка при загрузке поддержки.')
  }
}