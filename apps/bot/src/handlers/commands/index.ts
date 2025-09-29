import { Bot } from 'grammy'
import { BotContext } from '../../bot'
import { BotServices } from '../../services'
import { requireAdmin, requireAuth } from '../../middleware'

// Импорты обработчиков команд
import { handleStartCommand } from './start'
import { handleHelpCommand } from './help'
import { handleProfileCommand } from './profile'
import { handleOrdersCommand } from './orders'
import { handleBalanceCommand } from './balance'
import { handleSupportCommand } from './support'
import { handleAdminCommand } from './admin'
import { 
  handleDashboardCommand, 
  handleNewDashboardToken, 
  handleCopyAccessKey, 
  handleCancelDashboardAccess 
} from './dashboard'

export function setupCommands(bot: Bot<BotContext>, services: BotServices) {
  // Основные команды пользователя
  bot.command('start', handleStartCommand)
  bot.command('help', handleHelpCommand)
  
  // Команды требующие авторизации
  bot.command('profile', requireAuth(), handleProfileCommand)
  bot.command('orders', requireAuth(), handleOrdersCommand)
  bot.command('balance', requireAuth(), handleBalanceCommand)
  bot.command('support', requireAuth(), handleSupportCommand)
  
  // Админские команды
  bot.command('admin', requireAdmin(), handleAdminCommand)
  bot.command('dashboard', requireAdmin(), handleDashboardCommand)
  
  // Callback для dashboard команды
  bot.callbackQuery('generate_new_dashboard_token', requireAdmin(), handleNewDashboardToken)
  bot.callbackQuery(/^copy_access_key_(.+)$/, requireAdmin(), async (ctx) => {
    const accessKey = ctx.match[1]
    await handleCopyAccessKey(ctx, accessKey)
  })
  bot.callbackQuery('cancel_dashboard_access', requireAdmin(), handleCancelDashboardAccess)
  
  console.log('✅ Commands handlers registered')
}