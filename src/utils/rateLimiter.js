class RateLimiter {
  constructor(interval = 2000) {
    this.lastExecutions = new Map();
    this.interval = interval;
  }

  canExecute(key) {
    const now = Date.now();
    const lastTime = this.lastExecutions.get(key);
    
    if (lastTime && now - lastTime < this.interval) {
      return false;
    }
    
    this.lastExecutions.set(key, now);
    return true;
  }
}

module.exports = RateLimiter;