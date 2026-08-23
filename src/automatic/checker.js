const bot = require('../bot');
const { getWaitingUsers, updateUser } = require('../../base/models/user.model');
const { getSubscription, upsertSubscription, getExpiredSubscriptions, removeSubscription } = require('../../base/models/subscription.model');

let isChecking = false;

const startChecker = () => {
    // Har 5 soniyada tekshirish uchun setInterval
    setInterval(async () => {
        if (isChecking) return; // Oldingi jarayon tugamagan bo'lsa kutamiz
        isChecking = true;

        try {
            // 1-QISM: Yangi qo'shilganlarni tekshirish (faqat waitjoin holatidagilar)
            const users = await getWaitingUsers();
            
            for (const user of users) {
                if (user.action && user.action.startsWith('waitjoin_')) {
                    const parts = user.action.split('_');
                    // waitjoin_${targetChannel}_${messageId}_${duration}_${type}
                    const targetChannel = parts[1];
                    const messageId = parts[2];
                    const durationStr = parts[3];
                    const type = parts[4]; 
                    
                    try {
                        const chatMember = await bot.getChatMember(targetChannel, user.chatId);
                        const status = chatMember.status;
                        
                        // Agar qo'shilgan bo'lsa
                        if (['member', 'administrator', 'creator'].includes(status)) {
                            
                            bot.deleteMessage(user.chatId, messageId).catch(() => {});
                            bot.sendMessage(user.chatId, "🎉 Obunangiz faollashdi! Endi yopiq kanaldan to'liq foydalanishingiz mumkin.").catch(() => {});
                            
                            // Obuna vaqtini hisoblash
                            const existingSub = await getSubscription(user.chatId, targetChannel);
                            const existingExpireAt = existingSub ? existingSub.expire_at : null;
                            
                            const { calculateExpiration } = require('../payments/time');
                            const expire_at = calculateExpiration(existingExpireAt, durationStr, type);

                            // Jadvalga saqlash yoki yangilash
                            await upsertSubscription(user.chatId, targetChannel, expire_at);

                            // User holatini yana bo'sh qilib qo'yamiz
                            await updateUser(user.chatId, { action: '' });
                        }
                    } catch (err) {
                        // Kirmagan bo'lishi mumkin, e'tibor bermaymiz
                    }
                }
            }

            // 2-QISM: Vaqti tugagan obunalarni tekshirish va kanaldan chiqarish
            const expiredSubs = await getExpiredSubscriptions();
            for (const sub of expiredSubs) {
                try {
                    // Foydalanuvchini kanaldan chiqarish (ban qilib darhol unban qilish kick qilish hisoblanadi)
                    await bot.banChatMember(sub.channel_id, sub.chat_id);
                    await bot.unbanChatMember(sub.channel_id, sub.chat_id);

                    // Xabar berish
                    await bot.sendMessage(sub.chat_id, "⚠️ Sizning obuna vaqtingiz tugadi va siz yopiq kanaldan chiqarib yuborildingiz.\nQayta qo'shilish uchun /start ni bosib yangi tarif sotib oling.");
                } catch (err) {
                    console.error(`Foydalanuvchini ${sub.channel_id} dan chiqarishda xato:`, err.message || err);
                }

                try {
                    // Bazadan o'chirish (xatolik bo'lsa ham yana takrorlanmasligi uchun o'chiriladi)
                    await removeSubscription(sub.id);
                } catch (dbErr) {
                    console.error(`Obunani o'chirishda xato:`, dbErr.message || dbErr);
                }
            }

        } catch (error) {
            console.error("Checker ishida umumiy xatolik:", error);
        } finally {
            isChecking = false;
        }

        // KANALLAR SHARTINI TEKSHIRISH (Alohida try-catch bilan bloklanmasligi uchun)
        try {
            const { checkChannelsCondition } = require('./channels');
            await checkChannelsCondition();
        } catch (e) {
            console.error("Kanal shartlarini tekshirishda xatolik:", e);
        }

    }, 5000); // 5 soniya
};

module.exports = { startChecker };
