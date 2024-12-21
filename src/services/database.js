const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { INITIAL_BALANCE } = require('../config');
const Logger = require('../utils/logger');

class Database {
  static db;

  static async init() {
    // Create data directory if it doesn't exist
    const fs = require('fs');
    const path = require('path');
    const dataDir = path.join(__dirname, '../data');
    
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    Logger.info('Opening database connection', { path: path.join(dataDir, 'bot.db') });
    
    Database.db = await open({
      filename: path.join(dataDir, 'bot.db'),
      driver: sqlite3.Database
    }).catch(err => {
      Logger.error('Failed to open database', err);
      throw err;
    });

    Logger.info('Creating users table if not exists');
    await Database.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY,
        balance INTEGER DEFAULT ${INITIAL_BALANCE},
        messages_received INTEGER DEFAULT 0,
        stars_purchased INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  static async getUser(userId) {
    if (!Database.db) {
      throw new Error('Database not initialized');
    }
    Logger.info('Getting user from database', { userId });
    return await Database.db.get(
      'SELECT * FROM users WHERE user_id = ?',
      userId
    );
  }

  static async createUser(userId) {
    if (!Database.db) {
      throw new Error('Database not initialized');
    }
    Logger.info('Creating new user', { userId });
    
    // First check if user exists
    const existingUser = await this.getUser(userId);
    if (existingUser) {
      Logger.info('User already exists', { userId, balance: existingUser.balance });
      return; // User already exists, don't modify their balance
    }

    await Database.db.run(
      `INSERT OR IGNORE INTO users (user_id, balance) VALUES (?, ${INITIAL_BALANCE})`,
      userId
    );
    Logger.info('New user created', { userId, initialBalance: INITIAL_BALANCE });
  }

  static async updateBalance(userId, newBalance) {
    if (!Database.db) {
      throw new Error('Database not initialized');
    }
    Logger.info(`Updating balance for user ${userId}`, { newBalance });
    await Database.db.run(
      'UPDATE users SET balance = ? WHERE user_id = ?',
      newBalance, userId
    );
  }

  static async addMessageReceived(userId) {
    if (!Database.db) {
      throw new Error('Database not initialized');
    }
    await Database.db.run(
      'UPDATE users SET messages_received = messages_received + 1 WHERE user_id = ?',
      userId
    );
  }

  static async addStarsPurchased(userId, amount) {
    if (!Database.db) {
      throw new Error('Database not initialized');
    }
    await Database.db.run(
      'UPDATE users SET stars_purchased = stars_purchased + ? WHERE user_id = ?',
      amount, userId
    );
  }
}

module.exports = Database;