const fs = require('fs');
const path = require('path');

class Logger {
  static logDir = path.join(__dirname, '../logs');
  
  static init() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  static log(type, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      type,
      message,
      ...data
    };

    console.log(`[${timestamp}] ${type}: ${message}`, data);

    const logFile = path.join(this.logDir, `${type}.log`);
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
  }

  static error(message, error) {
    this.log('ERROR', message, { 
      error: error.message,
      stack: error.stack 
    });
  }

  static info(message, data) {
    this.log('INFO', message, data);
  }

  static debug(message, data) {
    this.log('DEBUG', message, data);
  }
}

module.exports = Logger;