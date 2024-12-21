const UserManager = require('../services/userManager');
const { STAR_PRICES } = require('../config');
const RateLimiter = require('../utils/rateLimiter');
const MessageUpdater = require('../utils/messageUpdater');
const MessageUtils = require('../utils/messageUtils');
const Logger = require('../utils/logger');

class MessageHandler {
  static lastStartTime = new Map();
  static rateLimiter = new RateLimiter(2000);

  static async handleStart(bot, msg) {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    
    // Prevent duplicate messages within 2 seconds
    const lastTime = this.lastStartTime.get(chatId);
    const now = Date.now();
    if (lastTime && now - lastTime < 2000) {
      return;
    }
    this.lastStartTime.set(chatId, now);
    
    await UserManager.initUser(userId);
    const balance = await UserManager.getBalance(userId);
    
    const keyboard = {
      inline_keyboard: [[
        { text: "Начать приключение ⚔️", callback_data: "start_adventure" }
      ]]
    };

    const welcomeMessage = `Приветствуем в мире Рунтерры! 🌌

Вас ждёт увлекательная ролевая игра в стиле «Аркейн» — с интригами, загадками и выбором, который меняет всё.

Готов начать нашу ролевую игру в мире Рунтерры?

Ваш баланс: ${balance} ⭐

Команды:
/topup - Пополнить баланс`;
    
    await bot.sendMessage(msg.chat.id, welcomeMessage, { reply_markup: keyboard });
  }

  static async handleStartAdventure(bot, openai, msg) {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    Logger.info('Starting adventure handler', { userId, chatId });
    
    const balance = await UserManager.getBalance(userId);
    Logger.debug('Current balance', { userId, balance });

    // Check balance before starting
    if (balance < 1) {
      Logger.info('Insufficient balance for adventure', { userId, balance });
      const keyboard = {
        inline_keyboard: Object.entries(STAR_PRICES).map(([stars]) => [{
          text: `⭐ Пополнить на ${stars} Звезд`,
          callback_data: `buy_${stars}`
        }])
      };
      await bot.sendMessage(msg.chat.id, 
        `🌌 О нет! Ваша магическая энергия иссякла в потоках времени Зауна.\n\n` +
        `Для продолжения путешествия понадобится восстановить силы через /topup ⚡`,
        { reply_markup: keyboard });
      return;
    }

    let sentMessage = null;
    let loadingMessage = null;
    try {
      loadingMessage = await bot.sendMessage(chatId, 'Начинаем приключение...');
      Logger.debug('Sent loading message', { messageId: loadingMessage.message_id });
    } catch (error) {
      Logger.error('Failed to send initial message', error);
      return;
    }

    let fullResponse = '';

    const conversationHistory = [
      { role: "system", content: process.env.SYSTEM_PROMPT },
      { role: "system", content: process.env.DEFAULT_PROMPT || 'Продолжайте разговор в ролевой игре естественно, сохраняя характер и согласованность сюжета.' },
      { role: "user", content: "Start a new adventure for me, describing the initial scene and asking what I want to do." }
    ];

    Logger.info('Preparing OpenAI conversation', { userId });

    try {
      Logger.info('Sending request to OpenAI', { userId });
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: conversationHistory,
        temperature: 0.8,
        max_tokens: 7000,
        presence_penalty: 0.7,
        frequency_penalty: 0.7
      });

      fullResponse = completion.choices[0].message.content;
      Logger.info('Received OpenAI response', { userId, length: fullResponse.length });

      // Delete loading message
      try {
        await bot.deleteMessage(chatId, loadingMessage.message_id);
      } catch (error) {
        Logger.error('Failed to delete loading message', error);
      }

      // Send complete response
      try {
        const messageParts = MessageUtils.splitMessage(fullResponse);
        for (const part of messageParts) {
          sentMessage = await bot.sendMessage(chatId, part);
          Logger.info('Sent message part', { 
            messageId: sentMessage.message_id,
            length: part.length 
          });
        }
      } catch (error) {
        Logger.error('Failed to send complete response', error);
        return;
      }

      // Only deduct stars if message was successfully delivered
      if (sentMessage && fullResponse) {
        Logger.info('Adventure message delivered', { userId, messageId: sentMessage.message_id });
        Logger.debug('Attempting to deduct stars', { userId, balance });
        try {
          await UserManager.deductStars(userId);
          Logger.info('Stars deducted successfully', { userId });
        } catch (error) {
          Logger.error('Failed to deduct stars', error);
          if (error.message === 'Insufficient balance') {
            await bot.sendMessage(chatId, 
              '🌌 Недостаточно звёзд для продолжения приключения.\n' +
              'Используйте /topup для пополнения баланса ⭐');
          }
        }
      }

    } catch (error) {
      Logger.error('OpenAI API Error', error);
      await bot.sendMessage(msg.chat.id, 
        'Таинственная сила препятствует началу вашего приключения. Попробуйте позже.');
    }
  }

  static async handleMessage(bot, openai, msg) {
    // Skip commands and their responses
    if (!msg.text || msg.text.startsWith('/') || msg.via_bot) return;
    
    // Skip if this is a response to a command
    if (msg.reply_to_message?.text?.startsWith('/')) return;

    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!this.rateLimiter.canExecute(chatId)) {
      return;
    }

    const balance = await UserManager.getBalance(userId);
    
    if (balance < 1) {
      const keyboard = {
        inline_keyboard: Object.entries(STAR_PRICES).map(([stars, price]) => [{
          text: `⭐ Пополнить на ${stars} Звезд`,
          callback_data: `buy_${stars}`
        }])
      };

      await bot.sendMessage(msg.chat.id, 
        `🌌 Магическая энергия иссякла! Для продолжения путешествия нужны звёзды силы.\n\n` +
        `Используйте /topup чтобы восполнить запас энергии ⭐`,
        { reply_markup: keyboard });
      return;
    }

    let loadingMessage = await bot.sendMessage(msg.chat.id, 'Обдумываю ваши слова...');
    let sentMessage = null;

    try {
      let conversationHistory = [];

      // Add system prompts to conversation history
      conversationHistory.push(
        { role: "system", content: process.env.SYSTEM_PROMPT },
        { role: "system", content: process.env.DEFAULT_PROMPT }
      );

      // Add user message
      conversationHistory.push({
        role: "user",
        content: msg.text
      });

      Logger.info('Sending request to OpenAI', { userId, messageLength: msg.text.length });

      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: conversationHistory,
        temperature: 0.8,
        max_tokens: 7000,
        presence_penalty: 0.7,
        frequency_penalty: 0.7
      });

      const fullResponse = completion.choices[0].message.content;
      
      // Проверяем валидность ответа
      if (!fullResponse || fullResponse.length < 10) {
        throw new Error('Invalid response from OpenAI');
      }
      
      // Удаляем сообщение о загрузке перед отправкой ответа
      try {
        await bot.deleteMessage(msg.chat.id, loadingMessage.message_id);
      } catch (error) {
        Logger.error('Failed to delete loading message', error);
      }

      // Отправляем ответ по частям
      Logger.info('Received response from OpenAI', { 
        userId, 
        responseLength: fullResponse.length 
      });
      
      // Delete loading message
      try {
        await bot.deleteMessage(msg.chat.id, loadingMessage.message_id);
        Logger.debug('Deleted loading message', { messageId: loadingMessage.message_id });
      } catch (error) {
        Logger.error('Failed to delete loading message', error);
      }

      // Split and send the response
      const messageParts = MessageUtils.splitMessage(fullResponse);
      
      if (messageParts.length === 0) {
        throw new Error('Empty response from OpenAI');
      }

      for (const part of messageParts) {
        if (!part.trim()) continue;
        await new Promise(resolve => setTimeout(resolve, 100)); // Небольшая задержка между сообщениями
        sentMessage = await bot.sendMessage(msg.chat.id, part);
        Logger.info('Sent message part', { 
          messageId: sentMessage.message_id,
          length: part.length 
        });
      }

      // Only deduct stars if message was successfully delivered
      if (sentMessage) {
        Logger.info('Message delivered successfully', { 
          userId,
          messageId: sentMessage.message_id 
        });
        try {
          await UserManager.deductStars(userId);
          Logger.info('Stars deducted successfully', { userId });
        } catch (error) {
          Logger.error('Failed to deduct stars', error);
          await bot.sendMessage(msg.chat.id, 
            '🌌 Недостаточно звёзд для продолжения приключения.\n' +
            'Используйте /topup для пополнения баланса ⭐');
        }
      }

    } catch (error) {
      Logger.error('Error in message handling', error);
      
      // Try to delete loading message if it exists
      try {
        if (loadingMessage) {
          await bot.deleteMessage(msg.chat.id, loadingMessage.message_id);
        }
      } catch (deleteError) {
        Logger.error('Failed to delete loading message after error', deleteError);
      }

      await bot.sendMessage(msg.chat.id, 
        'Таинственная сила препятствует продолжению вашего приключения. Попробуйте позже.');
    }
  }
}

module.exports = MessageHandler;