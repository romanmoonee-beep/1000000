import { Middleware } from 'grammy'
import { BotContext } from '../bot'

export function setupLogging(): Middleware<BotContext> {
  return async (ctx, next) => {
    const start = Date.now()
    
    // Логируем входящее сообщение
    const user = ctx.from
    const chat = ctx.chat
    
    let logMessage = ''
    
    if (ctx.message) {
      logMessage = `Message from @${user?.username || user?.first_name || user?.id}: ${ctx.message.text || '[media]'}`
    } else if (ctx.callbackQuery) {
      logMessage = `Callback from @${user?.username || user?.first_name || user?.id}: ${ctx.callbackQuery.data}`
    } else if (ctx.inlineQuery) {
      logMessage = `Inline query from @${user?.username || user?.first_name || user?.id}: ${ctx.inlineQuery.query}`
    } else {
      logMessage = `Update from @${user?.username || user?.first_name || user?.id}: ${ctx.update.update_id}`
    }

    console.log(`📨 ${logMessage}`)

    try {
      await next()
      
      const duration = Date.now() - start
      console.log(`✅ Processed in ${duration}ms`)
      
    } catch (error) {
      const duration = Date.now() - start
      console.error(`❌ Error after ${duration}ms:`, error)
      throw error
    }
  }
}