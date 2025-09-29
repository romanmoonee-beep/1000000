import { CommandContext } from 'grammy'
import { BotContext } from '../../bot'
import { ErrorUtils } from '../../middleware'
import { TransactionType, formatCurrency } from '@cargo/shared'

export async function handleBalanceCommand(ctx: CommandContext<BotContext>) {
  try {
    const userId = await ErrorUtils.validateUser(ctx)
    const user = await ctx.services.user.getByTelegramId(BigInt(ctx.from!.id))
    
    if (!user) {
      await ctx.reply('Профиль не найден. Начните с команды /start')
      return
    }

    // Получаем последние транзакции
    const transactions = await ctx.services.payment.getUserTransactions(user.id, {
      limit: 5
    })

    const balanceText = `
💰 <b>Баланс: ${formatCurrency(user.balance)}</b>

${user.isVip ? '🎁 VIP статус: кэшбэк 2%\n' : ''}
${await getBalanceInfo(ctx, user)}

📊 <b>Последние операции:</b>
${await formatTransactions(transactions)}`

    await ctx.reply(balanceText, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '💳 Пополнить', callback_data: 'top_up_balance' },
            { text: '📊 Все операции', callback_data: 'all_transactions' }
          ],
          [
            { text: '🎁 Бонусы', callback_data: 'bonus_info' },
            { text: '⭐ VIP статус', callback_data: 'vip_info' }
          ],
          [
            { text: '🏠 Главное меню', callback_data: 'main_menu' }
          ]
        ]
      }
    })

  } catch (error) {
    console.error('Balance command error:', error)
    await ctx.reply('Ошибка при загрузке информации о балансе.')
  }
}

async function getBalanceInfo(ctx: CommandContext<BotContext>, user: any): Promise<string> {
  let info = ''
  
  if (user.balance < 1000) {
    info += '⚠️ Низкий баланс. Рекомендуем пополнить для оплаты заказов.\n'
  }
  
  if (user.isVip && user.vipExpiresAt) {
    const daysLeft = Math.ceil((user.vipExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (daysLeft <= 7) {
      info += `⏰ VIP статус истекает через ${daysLeft} дн.\n`
    }
  }
  
  return info
}

async function formatTransactions(transactions: any[]): Promise<string> {
  if (transactions.length === 0) {
    return 'Операций пока нет'
  }

  return transactions.slice(0, 5).map(tx => {
    const icon = getTransactionIcon(tx.type)
    const amount = tx.type === TransactionType.WITHDRAWAL ? `-${formatCurrency(tx.amount)}` : `+${formatCurrency(tx.amount)}`
    const date = new Date(tx.createdAt).toLocaleDateString('ru-RU')
    const status = tx.status === 'COMPLETED' ? '✅' : tx.status === 'PENDING' ? '⏳' : '❌'
    
    return `${icon} ${amount} ${status} ${date}`
  }).join('\n')
}

function getTransactionIcon(type: string): string {
  switch (type) {
    case TransactionType.PAYMENT:
      return '💳'
    case TransactionType.BONUS:
      return '🎁'
    case TransactionType.REFUND:
      return '💸'
    case TransactionType.WITHDRAWAL:
      return '📦'
    default:
      return '💰'
  }
}