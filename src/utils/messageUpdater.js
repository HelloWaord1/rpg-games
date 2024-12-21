const Logger = require('./logger');

class MessageUpdater {
  static MAX_RETRIES = 3;
  
  static async updateMessage(bot, chatId, messageId, text, currentText) {
    if (text === currentText) {
      return false;
    }

    return await this.updateMessageWithRetry(bot, chatId, messageId, text, currentText, 0);
  }

  static async updateMessageWithRetry(bot, chatId, messageId, text, currentText, retryCount) {
    try {
      await new Promise(resolve => setTimeout(resolve, 500)); // Increased delay between attempts
      
      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });
      return true;
    } catch (error) {
      if (error.response?.statusCode === 429) {
        const retryAfter = error.response.parameters?.retry_after || 1;
        Logger.info('Rate limit hit, waiting', { retryAfter, messageId });
        await new Promise(resolve => setTimeout(resolve, (retryAfter + 1) * 1000));
        return await this.updateMessageWithRetry(bot, chatId, messageId, text, currentText, retryCount);
      }
      
      if (retryCount < this.MAX_RETRIES) {
        Logger.info('Retrying message update', { messageId, retryCount: retryCount + 1 });
        return await this.updateMessageWithRetry(bot, chatId, messageId, text, currentText, retryCount + 1);
      }
      
      // Don't log "message not modified" errors as they're expected
      if (!error.message.includes('message is not modified')) {
        Logger.error('Message update error', { 
          error: error.message, 
          messageId,
          retryCount,
          textLength: text.length 
        });
      }
      return false;
    }
  }
}

module.exports = MessageUpdater;