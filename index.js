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
const { initPromocodesTable } = require('./base/models/promocode.model');
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
    await initPromocodesTable();
    
    startChecker(); // 30 soniyalik tekshirgichni ishga tushiramiz
    const { startAutoPromo } = require('./src/automatic/channels/promo');
    startAutoPromo(); // Har kungi random promokod tarqatish tizimi
    const { startUserbot } = require('./src/userbot/client');
    startUserbot(); // Saqlangan session bilan userbotni ishga tushirish
    
    app.get('/', (req, res) => {
        res.send('Bot is running!');
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server is running on port ${PORT}`);
        
        // Render bepul tarifida 15 daqiqadan so'ng uxlab qolmasligi uchun Self-Ping
        // Render avtomatik RENDER_EXTERNAL_URL beradi, shuni tekshiramiz:
        const renderUrl = process.env.RENDER_EXTERNAL_URL;
        if (renderUrl) {
            const axios = require('axios');
            setInterval(() => {
                axios.get(renderUrl).then(() => {
                    console.log(`[Uyg'otish] Bot uxlab qolmasligi uchun o'z-o'ziga so'rov yubordi: ${renderUrl}`);
                }).catch((err) => {
                    console.error(`[Uyg'otish] Xato:`, err.message);
                });
            }, 10 * 60 * 1000); // Har 10 daqiqada ping yuboriladi
        } else {
            console.log("RENDER_EXTERNAL_URL topilmadi. Agar Render'da bo'lsangiz, bu o'zgaruvchini URLingiz bilan qo'shing.");
        }
    });
}

dev();