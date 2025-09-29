import { CommandContext } from 'grammy'
import { BotContext } from '../../bot'
import { ErrorUtils } from '../../middleware'

export async function handleStartCommand(ctx: CommandContext<BotContext>) {
  try {
    const user = ctx.from
    if (!user) return

    // Проверяем есть ли payload в команде
    const payload = ctx.match

    // Получаем пользователя из БД
    const dbUser = await ctx.services.user.getByTelegramId(BigInt(user.id))

    if (!dbUser) {
      // Новый пользователь - показываем приветствие и начинаем регистрацию
      await sendWelcomeMessage(ctx)
    } else {
      // Существующий пользователь
      if (payload) {
        // Обрабатываем deep link payload
        await handleDeepLink(ctx, payload, dbUser)
      } else {
        // Обычный запуск - показываем главное меню
        await sendMainMenu(ctx, dbUser)
      }
    }
  } catch (error) {
    console.error('Start command error:', error)
    await ctx.reply('Произошла ошибка при запуске бота. Попробуйте позже.')
  }
}

async function sendWelcomeMessage(ctx: CommandContext<BotContext>) {
  const welcomeText = `
🚀 <b>Добро пожаловать в CargoExpress!</b>
Доставка товаров из-за рубежа в Россию 🇷🇺

🌍 Работаем со складами по всему миру
📦 Доставляем посылки и выкупаем товары
⚡ Быстро, надежно, выгодно

Изучите наши возможности:`

  await ctx.reply(welcomeText, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🏢 Адреса складов', callback_data: 'view_warehouses' },
          { text: '📋 Как это работает', callback_data: 'how_it_works' }
        ],
        [
          { text: '💰 Тарифы доставки', callback_data: 'shipping_rates' },
          { text: '🛒 Примеры товаров', callback_data: 'sample_products' }
        ],
        [
          { text: '▶️ Начать регистрацию', callback_data: 'start_registration' }
        ]
      ]
    }
  })
}

async function sendMainMenu(ctx: CommandContext<BotContext>, user: any) {
  // Получаем статистику пользователя
  const [activeOrders, balance] = await Promise.all([
    ctx.services.order.getActiveUserOrders(user.id),
    ctx.services.user.getBalance(user.telegramId)
  ])

  const vipStatus = user.isVip ? ' | 🎁 VIP ⭐' : ''
  
  const welcomeText = `
👋 Добро пожаловать, ${user.firstName || 'друг'}!

🆔 ID: #${user.id} | 💰 Баланс: ${balance.toLocaleString('ru-RU')}₽
📦 Активных заказов: ${activeOrders.count}${vipStatus}`

  await ctx.reply(welcomeText, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📦 Отправить посылку', callback_data: 'send_package' },
          { text: '🛒 Выкуп товара', callback_data: 'buy_product' }
        ],
        [
          { text: '🏢 Адреса складов', callback_data: 'view_warehouses' },
          { text: '👤 Профиль', callback_data: 'view_profile' }
        ]
      ]
    }
  })
}

async function handleDeepLink(ctx: CommandContext<BotContext>, payload: string, user: any) {
  try {
    const [action, ...params] = payload.split('_')

    switch (action) {
      case 'order':
        // Ссылка на заказ: /start order_SP12345
        const orderId = params.join('_')
        await handleOrderDeepLink(ctx, orderId)
        break

      case 'ref':
        // Реферальная ссылка: /start ref_123456
        const referrerId = params[0]
        await handleReferralDeepLink(ctx, referrerId, user)
        break

      case 'support':
        // Ссылка на поддержку: /start support
        await handleSupportDeepLink(ctx, params[0])
        break

      case 'product':
        // Ссылка на товар: /start product_123
        const productId = params[0]
        await handleProductDeepLink(ctx, productId)
        break

      default:
        // Неизвестный payload - показываем главное меню
        await sendMainMenu(ctx, user)
    }
  } catch (error) {
    console.error('Deep link error:', error)
    await sendMainMenu(ctx, user)
  }
}

async function handleOrderDeepLink(ctx: CommandContext<BotContext>, orderId: string) {
  try {
    // Парсим ID заказа
    const match = orderId.match(/^(SP|PU)(\d+)$/)
    if (!match) {
      await ctx.reply('Некорректный номер заказа.')
      return
    }

    const [, type, id] = match
    const orderBigInt = BigInt(id)

    // Получаем заказ
    let order
    if (type === 'SP') {
      order = await ctx.services.order.getShippingOrder(orderBigInt)
    } else {
      order = await ctx.services.order.getPurchaseOrder(orderBigInt)
    }

    if (!order) {
      await ctx.reply('Заказ не найден.')
      return
    }

    // Проверяем принадлежит ли заказ пользователю
    if (order.userId !== ctx.session.userId) {
      await ctx.reply('У вас нет доступа к этому заказу.')
      return
    }

    // Показываем детали заказа
    await ctx.reply('🔍 Информация о заказе:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📦 Детали заказа', callback_data: `view_order_${type}_${id}` }],
          [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
        ]
      }
    })

  } catch (error) {
    console.error('Order deep link error:', error)
    await ctx.reply('Ошибка при получении информации о заказе.')
  }
}

async function handleReferralDeepLink(ctx: CommandContext<BotContext>, referrerId: string, user: any) {
  try {
    // Проверяем что пользователь новый (регистрируется впервые)
    if (user.registrationDate.getTime() > Date.now() - 5 * 60 * 1000) { // 5 минут
      // Находим реферера
      const referrer = await ctx.services.user.getByTelegramId(BigInt(referrerId))
      
      if (referrer && referrer.id !== user.id) {
        // Начисляем бонус рефереру
        await ctx.services.payment.createBonus(
          referrer.id,
          500, // 500 рублей бонус
          `Реферальный бонус за пользователя ${user.firstName || user.telegramId}`,
          { referredUserId: user.id.toString() }
        )

        // Начисляем бонус новому пользователю
        await ctx.services.payment.createBonus(
          user.id,
          200, // 200 рублей бонус
          'Бонус за регистрацию по реферальной ссылке'
        )

        await ctx.reply(
          '🎉 Вы зарегистрировались по реферальной ссылке!\n\n' +
          '💰 На ваш баланс начислено 200₽ в качестве приветственного бонуса.'
        )
      }
    }

    await sendMainMenu(ctx, user)
  } catch (error) {
    console.error('Referral deep link error:', error)
    await sendMainMenu(ctx, user)
  }
}

async function handleSupportDeepLink(ctx: CommandContext<BotContext>, ticketId?: string) {
  if (ticketId) {
    // Открываем конкретный тикет
    await ctx.reply('💬 Загружаем информацию о вашем обращении...', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💬 Связаться с поддержкой', callback_data: 'contact_support' }],
          [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
        ]
      }
    })
  } else {
    // Общая поддержка
    await ctx.reply('💬 Поддержка CargoExpress', {
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
            { text: '💬 Чат с оператором', callback_data: 'contact_support' }
          ],
          [
            { text: '🏠 Главное меню', callback_data: 'main_menu' }
          ]
        ]
      }
    })
  }
}

async function handleProductDeepLink(ctx: CommandContext<BotContext>, productId: string) {
  try {
    const product = await ctx.services.country.getFixedPriceProduct(parseInt(productId))
    
    if (!product) {
      await ctx.reply('Товар не найден или больше не доступен.')
      return
    }

    const productText = `
📱 <b>${product.name}</b>

💰 Фиксированная цена: $${product.price}
🎯 Финальная цена - никаких доплат за товар!

${product.description ? `📋 ${product.description}\n` : ''}
🌍 Страна: ${product.country.flagEmoji} ${product.country.name}
📂 Категория: ${product.category.icon} ${product.category.name}

⚖️ Примерный вес: ${product.estimatedWeight || 'уточняется'} кг`

    await ctx.reply(productText, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛒 Заказать товар', callback_data: `order_product_${productId}` }],
          [
            { text: '📱 Поделиться', callback_data: `share_product_${productId}` },
            { text: '⭐ В избранное', callback_data: `favorite_product_${productId}` }
          ],
          [{ text: '🏠 Главное меню', callback_data: 'main_menu' }]
        ]
      }
    })
  } catch (error) {
    console.error('Product deep link error:', error)
    await ctx.reply('Ошибка при загрузке информации о товаре.')
  }
}