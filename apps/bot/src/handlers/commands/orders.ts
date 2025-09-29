import { CommandContext } from 'grammy'
import { BotContext } from '../../bot'
import { ErrorUtils } from '../../middleware'
import { formatCurrency, getStatusText, getStatusColor } from '@cargo/shared'

export async function handleOrdersCommand(ctx: CommandContext<BotContext>) {
  try {
    const userId = await ErrorUtils.validateUser(ctx)
    const user = await ctx.services.user.getByTelegramId(BigInt(ctx.from!.id))
    
    if (!user) {
      await ctx.reply('Профиль не найден. Начните с команды /start')
      return
    }

    // Получаем заказы пользователя
    const ordersData = await ctx.services.order.getUserOrders(user.id, {
      limit: 10,
      type: 'all'
    })

    const { shipping, purchase } = ordersData
    const allOrders = [...shipping, ...purchase].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    if (allOrders.length === 0) {
      await sendEmptyOrdersMessage(ctx)
      return
    }

    // Разделяем на активные и завершенные
    const activeOrders = allOrders.filter(order => 
      !['DELIVERED', 'CANCELLED', 'REFUNDED'].includes(order.status)
    )
    
    const completedOrders = allOrders.filter(order => 
      ['DELIVERED', 'CANCELLED', 'REFUNDED'].includes(order.status)
    )

    await sendOrdersList(ctx, activeOrders, completedOrders)

  } catch (error) {
    console.error('Orders command error:', error)
    await ctx.reply('Ошибка при загрузке заказов.')
  }
}

async function sendEmptyOrdersMessage(ctx: CommandContext<BotContext>) {
  const emptyText = `
📦 У вас пока нет заказов

Создайте свой первый заказ:
• 📦 Отправьте посылку с любого склада
• 🛒 Закажите выкуп товара

Мы поможем доставить ваши покупки быстро и надежно!`

  await ctx.reply(emptyText, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📦 Отправить посылку', callback_data: 'send_package' },
          { text: '🛒 Выкуп товара', callback_data: 'buy_product' }
        ],
        [
          { text: '🏢 Адреса складов', callback_data: 'view_warehouses' },
          { text: '💰 Тарифы', callback_data: 'shipping_rates' }
        ],
        [
          { text: '🏠 Главное меню', callback_data: 'main_menu' }
        ]
      ]
    }
  })
}

async function sendOrdersList(
  ctx: CommandContext<BotContext>, 
  activeOrders: any[], 
  completedOrders: any[]
) {
  let ordersText = '📦 <b>Мои заказы</b>\n\n'

  // Активные заказы
  if (activeOrders.length > 0) {
    ordersText += '🔄 <b>Активные заказы:</b>\n'
    
    for (const order of activeOrders.slice(0, 5)) {
      const orderType = 'countryFrom' in order ? 'SP' : 'PU'
      const orderNumber = `#${orderType}${order.id}`
      const statusText = getStatusText(order.status)
      const country = order.countryFrom || order.country
      
      ordersText += `${country.flagEmoji} ${orderNumber} | ${statusText}\n`
      ordersText += `💰 ${formatCurrency(order.totalCost)}\n\n`
    }
    
    if (activeOrders.length > 5) {
      ordersText += `... и еще ${activeOrders.length - 5} заказов\n\n`
    }
  }

  // Последние завершенные заказы
  if (completedOrders.length > 0) {
    ordersText += '✅ <b>Завершенные заказы:</b>\n'
    
    for (const order of completedOrders.slice(0, 3)) {
      const orderType = 'countryFrom' in order ? 'SP' : 'PU'
      const orderNumber = `#${orderType}${order.id}`
      const statusText = getStatusText(order.status)
      const country = order.countryFrom || order.country
      
      ordersText += `${country.flagEmoji} ${orderNumber} | ${statusText}\n`
    }
    
    if (completedOrders.length > 3) {
      ordersText += `\n📋 Всего завершенных: ${completedOrders.length}`
    }
  }

  // Кнопки для управления заказами
  const keyboard = []
  
  // Кнопки активных заказов
  if (activeOrders.length > 0) {
    const activeButtons = activeOrders.slice(0, 2).map(order => {
      const orderType = 'countryFrom' in order ? 'SP' : 'PU'
      const orderNumber = `${orderType}${order.id}`
      return {
        text: `📦 ${orderNumber}`,
        callback_data: `view_order_${orderType}_${order.id}`
      }
    })
    keyboard.push(activeButtons)
  }

  // Основные действия
  keyboard.push([
    { text: '📍 Отследить по номеру', callback_data: 'track_by_number' },
    { text: '📊 Показать все', callback_data: 'show_all_orders' }
  ])

  keyboard.push([
    { text: '📦 Новый заказ', callback_data: 'send_package' },
    { text: '🛒 Выкуп товара', callback_data: 'buy_product' }
  ])

  keyboard.push([
    { text: '🏠 Главное меню', callback_data: 'main_menu' }
  ])

  await ctx.reply(ordersText, {
    reply_markup: { inline_keyboard: keyboard }
  })
}