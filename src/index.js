require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const OpenAI = require('openai');
const PaymentHandler = require('./handlers/paymentHandler');
const MessageHandler = require('./handlers/messageHandler');
const Database = require('./services/database');
const Logger = require('./utils/logger');

const RECONNECT_DELAY = 5000; // 5 seconds delay before reconnecting
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
  polling: {
    interval: 1000,
    autoStart: false,
    params: {
      timeout: 60
    }
  }
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Start the bot
async function startBot() {
  Logger.init(); // Initialize logger first

  Logger.info('Initializing database...');
  await Database.init();
  Logger.info('Database initialized successfully');

  // Handle connection errors
  bot.on('error', async (error) => {
    Logger.error('Bot error', error);
    if (error.code === 'EFATAL') {
      Logger.info('Fatal error occurred, attempting to reconnect...');
      await bot.stopPolling();
      setTimeout(() => startBot(), RECONNECT_DELAY);
    }
  });

  // Add error handler for bot
  bot.on('polling_error', (error) => {
    Logger.error('Polling error', error);
    if (error.code === 'ETELEGRAM') {
      if (error.response?.statusCode === 409) {
        Logger.info('Conflict detected, restarting bot...');
        setTimeout(() => startBot(), RECONNECT_DELAY);
      } else if (error.response?.statusCode === 429) {
        const retryAfter = error.response.parameters?.retry_after || 60;
        Logger.info('Rate limited', { retryAfter });
        setTimeout(() => {
          if (!bot.isPolling()) {
            bot.startPolling();
          }
        }, retryAfter * 1000);
      }
    }
  });
  
  // Start polling only after all handlers are set up
  process.nextTick(() => {
    bot.startPolling();
  });

  // Command handlers
  bot.onText(/\/start/, async (msg) => await MessageHandler.handleStart(bot, msg));
  bot.onText(/\/topup/, async (msg) => await PaymentHandler.handleRefillCommand(bot, msg));
  bot.onText(/\/refund/, async (msg) => await PaymentHandler.handleRefundCommand(bot, msg));

  // Payment handlers
  bot.on('callback_query', async (query) => {
    try {
      Logger.info('Received callback query', { 
        userId: query.from.id, 
        data: query.data 
      });

      if (query.data === 'start_adventure') {
        const userId = query.from.id;
        const message = { 
          from: query.from,
          chat: query.message.chat
        };
        
        await bot.answerCallbackQuery(query.id);
        Logger.info('Starting adventure from callback', { userId });
        await MessageHandler.handleStartAdventure(bot, openai, message);
      } else {
        await PaymentHandler.handleCallbackQuery(bot, query);
      }
    } catch (error) {
      Logger.error('Error handling callback query', error);
      await bot.sendMessage(
        query.message.chat.id,
        'Произошла ошибка при запуске приключения. Попробуйте еще раз.'
      );
    }
  });

  bot.on('pre_checkout_query', async (query) => {
    await bot.answerPreCheckoutQuery(query.id, true).catch(() => {
      console.error('Failed to answer pre-checkout query');
    });
  });

  bot.on('successful_payment', async (msg) => 
    await PaymentHandler.handleSuccessfulPayment(bot, msg));

  // Message handler
  bot.on('message', async (msg) => 
    await MessageHandler.handleMessage(bot, openai, msg));

  console.log('Arcane RPG Bot is running...');
}

// Start the bot with error handling and automatic restart
async function run() {
  try {
    await startBot();
  } catch (error) {
    console.error('Critical error:', error);
    // Wait before attempting restart
    setTimeout(run, 5000);
  }
}

// Handle any errors during startup
run().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});