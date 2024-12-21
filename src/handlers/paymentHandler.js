const PaymentService = require('../services/paymentService');
const UserManager = require('../services/userManager');
const { STAR_PRICES } = require('../config');

class PaymentHandler {
  static async handleRefillCommand(bot, msg) {
    const keyboard = {
      inline_keyboard: Object.entries(STAR_PRICES).map(([stars, price]) => [{
        text: `⭐ Пополнить на ${stars} Звезд за ${price}$`,
        callback_data: `buy_${stars}`
      }])
    };

    await bot.sendMessage(msg.chat.id, 
      '💫 Выберите количество Звезд для восполнения магической энергии:',
      { reply_markup: keyboard }
    );
  }

  static async handleCallbackQuery(bot, query) {
    if (!query.data.startsWith('buy_')) return;

    const stars = parseInt(query.data.split('_')[1]);
    const price = STAR_PRICES[stars];
    
    if (!price) return;

    try {
      const invoice = PaymentService.createInvoice(stars, price);
      await bot.sendInvoice(
        query.message.chat.id,
        invoice.title,
        invoice.description,
        invoice.payload,
        invoice.provider_token,
        invoice.currency,
        invoice.prices
      );
    } catch (error) {
      console.error('Invoice creation error:', error);
      await bot.sendMessage(query.message.chat.id, 
        'Sorry, there was an error creating the payment. Please try again.');
    }
  }

  static async handleSuccessfulPayment(bot, msg) {
    const stars = parseInt(msg.successful_payment.invoice_payload.split('_')[1]);
    const paymentId = msg.successful_payment.telegram_payment_charge_id;
    const userId = msg.from.id;
    
    await UserManager.addPayment(userId, stars);
    
    await bot.sendMessage(msg.chat.id, 
      `✨ Великолепно! ${stars} Звезд добавлено к вашей магической силе.\n` +
      `Теперь вы можете продолжить своё приключение!`);
  }

  static async handleRefundCommand(bot, msg) {
    const userId = msg.from.id;
    const paymentId = UserManager.getPaymentId(userId);

    if (!paymentId) {
      await bot.sendMessage(msg.chat.id, "У вас пока нет платежей для возврата.");
      return;
    }

    try {
      await bot.refundStarPayment(userId, paymentId);
      await bot.sendMessage(msg.chat.id, "✅ Ваши Звезды были успешно возвращены.");
    } catch (error) {
      console.error('Refund error:', error);
      await bot.sendMessage(msg.chat.id, 
        "❌ Извините, произошла ошибка при обработке возврата. Пожалуйста, попробуйте позже.");
    }
  }
}

module.exports = PaymentHandler;