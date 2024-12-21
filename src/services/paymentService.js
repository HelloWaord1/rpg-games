class PaymentService {
  static createInvoice(stars, price) {
    const priceInCents = Math.round(price * 100);
    return {
      title: `${stars} Звезд`,
      description: `Пополнение магической энергии на ${stars} Звезд`,
      payload: `stars_${stars}`,
      provider_token: "", // Empty for Stars payments
      currency: "XTR",
      prices: [{
        label: `${stars} Звезд`,
        amount: priceInCents
      }]
    };
  }
}

module.exports = PaymentService;