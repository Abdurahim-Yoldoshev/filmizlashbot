const bot = require('../bot');
const db = require('../../base/db');
const { updateUser } = require('../../base/models/user.model');

const handleBroadcastMenu = async (msg) => {
    const chatId = msg.chat.id;
    await updateUser(chatId, { action: "admin_broadcast_wait" });
    
    await bot.sendMessage(chatId,
        `✉️ <b>Ommaviy xabar yuborish</b>\n\n` +
        `Yubormoqchi bo'lgan xabaringizni shu yerga yozing, rasm/video tashlang yoki boshqa kanaldan forward qiling.\n\n` +
        `<i>Siz yuborgan xabar botdagi barcha foydalanuvchilarga yetkaziladi.</i>`,
        {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[{ text: "🔙 Bekor qilish", callback_data: "admin_broadcast_cancel" }]]
            }
        }
    );
};

const handleBroadcastMessage = async (msg, user) => {
    const chatId = msg.chat.id;
    
    // Tasdiqlash menyusi
    await updateUser(chatId, { action: "" });
    
    // Vaqtinchalik xabarni saqlash uchun msg.message_id dan foydalanamiz
    const messageIdToBroadcast = msg.message_id;
    
    await bot.sendMessage(chatId,
        `⚠️ <b>Diqqat!</b> Ushbu xabar barcha foydalanuvchilarga yuboriladi. Tasdiqlaysizmi?`,
        {
            parse_mode: 'HTML',
            reply_to_message_id: messageIdToBroadcast,
            reply_markup: {
                inline_keyboard: [
                    [{ text: "✅ Ha, hammaga yuborish", callback_data: `admin_broadcast_confirm_${messageIdToBroadcast}` }],
                    [{ text: "❌ Yo'q, bekor qilish", callback_data: "admin_broadcast_cancel" }]
                ]
            }
        }
    );
    return true;
};

const startBroadcasting = async (chatId, fromChatId, messageIdToBroadcast) => {
    // 1. Foydalanuvchilarni olish
    let users = [];
    try {
        const res = await db.execute('SELECT chatId FROM users');
        users = res.rows.map(r => String(r.chatId));
    } catch(e) {
        console.error(e);
        return;
    }

    if (users.length === 0) {
        bot.sendMessage(chatId, "⚠️ Botda foydalanuvchilar yo'q.").catch(()=>{});
        return;
    }

    const progressMsg = await bot.sendMessage(chatId, `⏳ Xabar yuborilmoqda...\nJami foydalanuvchilar: ${users.length}\nKuting...`).catch(()=>{});

    let successCount = 0;
    let failCount = 0;

    // Background process for broadcasting
    (async () => {
        for (let i = 0; i < users.length; i++) {
            const targetChatId = users[i];
            
            // O'ziga yubormaydi (ixtiyoriy, lekin admin ko'rishi uchun qoldirish mumkin)
            
            try {
                await bot.copyMessage(targetChatId, fromChatId, messageIdToBroadcast);
                successCount++;
            } catch (err) {
                failCount++;
                // Agar botni bloklagan bo'lsa, xato beradi (403 Forbidden)
            }

            // Telegram API limitlariga tushmaslik uchun kutish (sekundiga ~30 ta xabar ruxsat etiladi)
            // Biz 35ms (sekundiga ~28 ta) kutamiz
            await new Promise(r => setTimeout(r, 35));

            // Har 100 ta xabarda progressni yangilash
            if (i > 0 && i % 100 === 0 && progressMsg) {
                bot.editMessageText(`⏳ Xabar yuborilmoqda...\nJami: ${users.length}\nYuborildi: ${i}\nMuvaffaqiyatli: ${successCount}\nXato: ${failCount}`, {
                    chat_id: chatId,
                    message_id: progressMsg.message_id
                }).catch(()=>{});
            }
        }

        // Tugagandan so'ng xisobot
        if (progressMsg) {
            bot.editMessageText(
                `✅ <b>Ommaviy xabar yakunlandi!</b>\n\n` +
                `📊 <b>Natija:</b>\n` +
                `Jami: ${users.length} ta\n` +
                `✅ Yetib bordi: ${successCount} ta\n` +
                `❌ Xato/Bloklaganlar: ${failCount} ta`,
                {
                    chat_id: chatId,
                    message_id: progressMsg.message_id,
                    parse_mode: 'HTML'
                }
            ).catch(()=>{});
        }
    })();
};

module.exports = {
    handleBroadcastMenu,
    handleBroadcastMessage,
    startBroadcasting
};
