const express = require('express');
const app = express();
require('dotenv').config();

// Global xatoliklarni ushlab qolish (Bot qotib qolmasligi uchun)
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err.message);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

require('./src/bot');

const { initUserTable } = require('./base/models/user.model');
const { initMoviesTable } = require('./base/models/movies.model');
const { initChannelTable } = require('./base/models/channel.model');
const { initSubscriptionTable } = require('./base/models/subscription.model');
const { initSeriesTable } = require('./base/models/series.model');
const { startChecker } = require('./src/automatic/checker');
const { initSettingsTable } = require('./base/models/settings.model.js');

app.use(express.json());
const dev = async () => {
    await initSettingsTable();
    await initUserTable();
    await initMoviesTable();
    await initChannelTable();
    await initSubscriptionTable();
    await initSeriesTable();
    
    startChecker(); // 30 soniyalik tekshirgichni ishga tushiramiz
    const { startAutoPromo } = require('./src/automatic/channels/promo');
    startAutoPromo(); // Har kungi random promokod tarqatish tizimi
    const { startUserbot } = require('./src/userbot/client');
    startUserbot(); // Saqlangan session bilan userbotni ishga tushirish
    
    app.listen(process.env.PORT, () => {
        console.log(`Server is running on port ${process.env.PORT}`);
    });
};

dev();