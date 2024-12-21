const Database = require('./database');
const { MESSAGE_COST } = require('../config');
const Logger = require('../utils/logger');

class UserManager {
  static async hasEnoughBalance(userId) {
    const balance = await this.getBalance(userId);
    const hasEnough = balance >= MESSAGE_COST;
    Logger.info('Checking balance', { userId, balance, required: MESSAGE_COST, hasEnough });
    return hasEnough;
  }

  static async addPayment(userId, stars) {
    const user = await Database.getUser(userId);
    const newBalance = user ? (user.balance + stars) : stars;
    Logger.info('Adding payment', { userId, stars, oldBalance: user?.balance, newBalance });
    if (!user) {
      await Database.createUser(userId);
    }
    await Database.updateBalance(userId, newBalance);
    await Database.addStarsPurchased(userId, stars);
  }

  static async initUser(userId) {
    Logger.info('Initializing user', { userId });
    await Database.createUser(userId);
    const user = await Database.getUser(userId);
    Logger.info('User initialized', { userId, balance: user.balance });
  }

  static async getBalance(userId) {
    const user = await Database.getUser(userId);
    const balance = user ? user.balance : 0;
    Logger.info('Getting balance', { userId, balance });
    return balance;
  }

  static async deductStars(userId, amount = MESSAGE_COST) {
    const user = await Database.getUser(userId);
    if (!user) {
      Logger.error('User not found', { userId });
      throw new Error('User not found');
    }

    if (user.balance < amount) {
      Logger.info('Insufficient balance', { userId, balance: user.balance, required: amount });
      throw new Error('Insufficient balance');
    }

    const newBalance = user.balance - amount;
    Logger.info('Deducting stars', { userId, amount, oldBalance: user.balance, newBalance });
    
    await Database.updateBalance(userId, newBalance);
    await Database.addMessageReceived(userId);
  }

  static async addStarsManually(userId, stars) {
    Logger.info('Adding stars manually', { userId, stars });
    await this.addPayment(userId, stars);
    return await this.getBalance(userId);
  }
}

module.exports = UserManager;