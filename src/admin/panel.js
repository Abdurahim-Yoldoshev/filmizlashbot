const bot = require('../bot');
const { updateUser } = require('../../base/models/user.model');
const db = require('../../base/db');

const ADMIN_ID = Number(process.env.ADMIN_ID);

const openAdminPanel = async (chatId, messageId = null) => {
    if (chatId !== ADMIN_ID) return;

    // Kichik statistika olish
    const usersCount = (await db.execute('SELECT COUNT(chatId) as cnt FROM users')).rows[0].cnt;
    const moviesCount = (await db.execute('SELECT COUNT(code) as cnt FROM movies')).rows[0].cnt;
    const channelsCount = (await db.execute('SELECT COUNT(id) as cnt FROM channels')).rows[0].cnt;
    const serialsCount = (await db.execute('SELECT COUNT(code) as cnt FROM series')).rows[0].cnt;
    const cloudCount = (await db.execute('SELECT COUNT(expire_at) as cnt FROM subscriptions')).rows[0].cnt;

    const text = `👨‍💻 <b>Admin Panelga xush kelibsiz!</b>\n\n<blockquote>📊 <b>Statistika:</b>\n\n   <b>👥 Muxlislar:</b> ${usersCount}\n   <b>🎬 Kinolar:</b> ${moviesCount}\n   <b>🎞 Seriallar:</b> ${serialsCount}\n   <b>📢 Kanallar:</b> ${channelsCount}\n   <b>☁️ Obunalar:</b> ${cloudCount}</blockquote>\n\n Quyidagi menyudan kerakli bo'limni tanlang:`;

    if (messageId) {
        await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "HTML"
        }).catch(()=>{});
    } else {
        const keyboard = [
            ["🎞 Filmlar", "💰 Moliya"],
            ["📢 Kanallar", "✉️ Xabar"],
            ["🔙 Asosiy menyu"]
        ];

        await bot.sendMessage(chatId, text, {
            parse_mode: "HTML",
            reply_markup: {
                keyboard: keyboard,
                resize_keyboard: true,
                one_time_keyboard: true
            }
        });
    }
    
    await updateUser(chatId, { action: "" });
};

module.exports = {
    ADMIN_ID,
    openAdminPanel
};
