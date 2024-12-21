require('dotenv').config();
const UserManager = require('./services/userManager');
const Database = require('./services/database');
const Logger = require('./utils/logger');

async function addStars() {
  try {
    Logger.init();
    await Database.init();
    const userId = 8107957309;
    const stars = 100;
    const newBalance = await UserManager.addStarsManually(userId, stars);
    console.log(`Successfully added ${stars} stars to user ${userId}. New balance: ${newBalance}`);
    process.exit(0);
  } catch (error) {
    console.error('Error adding stars:', error);
    process.exit(1);
  }
}

// Execute the function
addStars();