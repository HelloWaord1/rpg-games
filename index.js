require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const OpenAI = require('openai');
const UserManager = require('./userManager');
const { MESSAGE_COST, STAR_PRICES, SYSTEM_PROMPT } = require('./config');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Command handlers
bot.onText(/\/start/, async (msg) => {
  const welcomeMessage = `🌟 Welcome to the Arcane RPG Chat! 🌟
    
Each message costs 1 Telegram Star ⭐
You'll need Telegram Stars to continue chatting.

Commands:
/refill - Get Telegram Stars
/help - Show this help message

Let's begin your magical journey through Piltover and Zaun!`;
  
  bot.sendMessage(msg.chat.id, welcomeMessage);
});

bot.onText(/\/refill/, (msg) => {
  const keyboard = {
    inline_keyboard: Object.entries(STAR_PRICES).map(([stars, price]) => [{
      text: `⭐ Top up with ${stars} Stars ($${price})`,
      callback_data: `buy_${stars}`
    }])
  };

  bot.sendMessage(msg.chat.id, 
    '💫 Choose how many Stars you want to purchase:',
    { reply_markup: keyboard }
  );
});

// Handle callback queries for star purchases
bot.on('callback_query', async (query) => {
  if (query.data.startsWith('buy_')) {
    const stars = parseInt(query.data.split('_')[1]);
    const price = STAR_PRICES[stars];
    if (price) {
      try {
        const priceInCents = Math.round(price * 100);
        const prices = [{
          label: `${stars} Stars`,
          amount: priceInCents
        }];

        await bot.sendInvoice(
          query.message.chat.id,
          `${stars} Stars`,
          `Top up your balance with ${stars} Stars to continue chatting with the Arcane RPG Bot`,
          `stars_${stars}`,
          "", // Empty provider token for Stars payments
          'stars',
          'XTR',
          prices
        );
      } catch (error) {
        console.error('Invoice creation error:', error);
        bot.sendMessage(query.message.chat.id, 
          'Sorry, there was an error creating the payment. Please try again.');
      }
    }
  }
});

// Handle pre-checkout queries
bot.on('pre_checkout_query', (query) => {
  bot.answerPreCheckoutQuery(query.id, true).catch(() => {
    console.error('Failed to answer pre-checkout query');
  });
});

// Handle successful payments
bot.on('successful_payment', (msg) => {
  const stars = parseInt(msg.successful_payment.invoice_payload.split('_')[1]);
  const paymentId = msg.successful_payment.telegram_payment_charge_id;
  
  UserManager.addPayment(msg.from.id, paymentId);
  
  bot.sendMessage(msg.chat.id, 
    `✨ Thank you! ${stars} Stars have been added to your balance.\n` +
    `You can now continue chatting!`);
});

// Add refund command
bot.onText(/\/refund/, async (msg) => {
  const userId = msg.from.id;
  const paymentId = UserManager.getPaymentId(userId);

  if (!paymentId) {
    bot.sendMessage(msg.chat.id, "You have not made any payments yet.");
    return;
  }

  try {
    await bot.refundStarPayment(userId, paymentId);
    bot.sendMessage(msg.chat.id, "✅ Your Stars have been refunded successfully.");
  } catch (error) {
    console.error('Refund error:', error);
    bot.sendMessage(msg.chat.id, 
      "❌ Sorry, there was an error processing your refund. Please try again later.");
  }
});

// Handle regular messages
bot.on('message', async (msg) => {
  if (!msg.text || msg.text.startsWith('/')) return; // Skip commands and non-text messages

  const userId = msg.from.id;
  
  if (!UserManager.hasEnoughBalance(userId)) {
    bot.sendMessage(msg.chat.id, 
      `⚠️ You need Telegram Stars to continue chatting.\n` +
      `Use /refill to learn how to get Stars ⭐`);
    return;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: msg.text }
      ],
    });

    const response = completion.choices[0].message.content;
    
    bot.sendMessage(msg.chat.id, response);
  } catch (error) {
    console.error('OpenAI API Error:', error);
    bot.sendMessage(msg.chat.id, 
      'A mysterious force prevents me from responding. Please try again later.');
  }
});

console.log('Arcane RPG Bot is running...');