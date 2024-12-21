// Track paid users and their payment IDs
const paidUsers = new Map();

class UserManager {
  static hasEnoughBalance(userId) {
    return paidUsers.has(userId);
  }

  static addPayment(userId, paymentId) {
    paidUsers.set(userId, paymentId);
  }

  static getPaymentId(userId) {
    return paidUsers.get(userId);
  }
}
