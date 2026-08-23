const bot = require('../bot');
const { updateUser } = require('../../base/models/user.model');
const { getSubscription } = require('../../base/models/subscription.model');
const db = require('../../base/db');
const { getTariffEmoji } = require('../admin/finance');

const { formatTimeLeft } = require('../payments/time');

const getCloudMenuText = async (chatId) => {
    const watchSub = await getSubscription(chatId, process.env.CLOUD_WATCH_CHANNEL_ID);
    const downloadSub = await getSubscription(chatId, process.env.CLOUD_DOWNLOAD_CHANNEL_ID);
    
    let watchText = watchSub && watchSub.expire_at > Date.now() ? `✅ Faol (${formatTimeLeft(watchSub.expire_at)} qoldi)` : "❌ Faol emas";
    let downloadText = downloadSub && downloadSub.expire_at > Date.now() ? `✅ Faol (${formatTimeLeft(downloadSub.expire_at)} qoldi)` : "❌ Faol emas";

    return `<blockquote><b>☁️ Cloud</b></blockquote>\n\n☁️ <b>Cloud bo'limiga xush kelibsiz!</b>\n\n<b>Sizning obunalaringiz:</b>\n👁 Ko'rish: <b>${watchText}</b>\n📥 Yuklash: <b>${downloadText}</b>\n\nIltimos, pastdan harakatni tanlang:`;
};

const cloudMenu = {
    reply_markup:{
        inline_keyboard: [
            [
                { text: "👁 Ko'rish", callback_data: "cloud_watch" },
                { text: "📥 Yuklash", callback_data: "cloud_download" }
            ],
            [
                { text: "❌ Yopish", callback_data: "cloud_exit" }
            ]
        ]
    }
};

const openCloudMenu = async (msg) => {
    const text = await getCloudMenuText(msg.chat.id);
    await bot.sendMessage(msg.chat.id, text, { parse_mode: "HTML", ...cloudMenu });
};

const handleReceiptUpload = async (msg, user) => {
    await bot.sendMessage(msg.chat.id, "Cloud bo'limi uchun chek yuborish tizimi bekor qilingan. Endi barcha xaridlar hisobingizdagi balansdan avtomatik yechiladi!");
    await updateUser(msg.chat.id, { action: '' });
};

const handleCloudQuery = async (query) => {
    const data = query.data;
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    if (data === 'cloud_exit') {
        bot.deleteMessage(chatId, messageId).catch(()=>{});
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }
    
    if (data === 'cloud_watch' || data === 'cloud_download') {
        const type = data === 'cloud_watch' ? 'tariff_watch' : 'tariff_download';
        const title = data === 'cloud_watch' ? "👁 <b>Ko'rish</b>" : "📥 <b>Yuklash</b>";
        
        const res = await db.execute({ sql: `SELECT * FROM finance_plans WHERE type = ?`, args: [type] });
        const tariffs = res.rows;
        
        if (tariffs.length === 0) {
            bot.answerCallbackQuery(query.id, { text: "😅 Hali hech narsa qo'shilmagan", show_alert: true }).catch(()=>{});
            return true;
        }
        
        const inline_keyboard = [];
        for (const t of tariffs) {
            const emoji = getTariffEmoji(t.duration_days);
            inline_keyboard.push([{ text: `${emoji} ${t.name} (${t.price} so'm)`, callback_data: `buy_tariff_${t.id}` }]);
        }
        inline_keyboard.push([{ text: "🔙 Orqaga", callback_data: "cloud_back" }]);

        const routerTitle = data === 'cloud_watch' ? "Ko'rish" : "Yuklash";
        bot.editMessageText(`<blockquote><b>☁️ Cloud / ${routerTitle}</b></blockquote>\n\n${title} uchun tarifni tanlang:\n\nO'zingizga kerakli bo'lgan obuna vaqtini tanlang:`, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "HTML",
            reply_markup: { inline_keyboard }
        }).catch(()=>{});
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }

    if (data === 'cloud_back') {
        const text = await getCloudMenuText(chatId);
        bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "HTML",
            ...cloudMenu
        }).catch(()=>{});
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }

    if (data.startsWith('buy_tariff_')) {
        const id = parseInt(data.replace('buy_tariff_', ''));
        const res = await db.execute({ sql: `SELECT * FROM finance_plans WHERE id = ?`, args: [id] });
        if (res.rows.length === 0) return true;
        const tariff = res.rows[0];

        const routerTitle = tariff.type === 'tariff_watch' ? "Ko'rish" : "Yuklash";
        bot.editMessageText(`<blockquote><b>☁️ Cloud / ${routerTitle} / Xarid</b></blockquote>\n\nSiz <b>${tariff.name}</b> tarifini tanladingiz.\n\n💵 Tarif narxi: <b>${tariff.price} so'm</b>\n\nHisobingizdan yechib olinishiga rozimisiz?`, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [
                    [{ text: "✅ Ha, tasdiqlayman", callback_data: `pay_tariff_${tariff.id}` }],
                    [{ text: "🔙 Orqaga", callback_data: "cloud_back" }]
                ]
            }
        }).catch(()=>{});
        
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }

    if (data.startsWith('pay_tariff_')) {
        const id = parseInt(data.replace('pay_tariff_', ''));
        const res = await db.execute({ sql: `SELECT * FROM finance_plans WHERE id = ?`, args: [id] });
        if (res.rows.length === 0) return true;
        const tariff = res.rows[0];
        const price = tariff.price;
        
        const { getUser } = require('../../base/models/user.model');
        const user = await getUser(chatId);
        
        if ((user.balance || 0) < price) {
            bot.answerCallbackQuery(query.id, { text: `❌ Hisobingizda yetarli mablag' yo'q!\n\nKamida ${price} so'm bo'lishi kerak. Hozirgi hisobingiz: ${user.balance || 0} so'm.`, show_alert: true }).catch(()=>{});
            return true;
        }

        // Balansdan yechib olamiz
        await updateUser(chatId, { balance: (user.balance || 0) - price });
        bot.answerCallbackQuery(query.id, { text: "✅ Summa yechib olindi va obuna faollashdi!", show_alert: true }).catch(()=>{});
        
        // Referal bonus (dinamik foiz)
        if (price > 0 && user.referred_by) {
            const inviter = await getUser(user.referred_by);
            if (inviter) {
                let refPurchasePercent = 0;
                try {
                    const dbModule = require('../../base/db');
                    const refRes = await dbModule.execute({ sql: `SELECT price FROM finance_plans WHERE type = 'margin' AND name = 'referral_purchase_percent'` });
                    if (refRes.rows.length > 0) refPurchasePercent = refRes.rows[0].price;
                } catch(e) {}
                
                if (refPurchasePercent > 0) {
                    const bonus = Math.floor(price * (refPurchasePercent / 100));
                    await updateUser(user.referred_by, { balance: (inviter.balance || 0) + bonus });
                    bot.sendMessage(user.referred_by, `🎁 <b>Referal bonusi!</b>\n\nSiz taklif qilgan foydalanuvchi xarid qildi. Sizga xarid summasining ${refPurchasePercent}% qismi (<b>${bonus} so'm</b>) bonus sifatida berildi!`, { parse_mode: 'HTML' }).catch(()=>{});
                }
            }
        }
        
        // Linkni berish jarayoni
        const type = tariff.type === 'tariff_watch' ? 'watch' : 'download'; 
        const duration = tariff.duration_days.toString(); 
        
        let targetChannel = '';
        if (type === 'watch') targetChannel = process.env.CLOUD_WATCH_CHANNEL_ID;
        if (type === 'download') targetChannel = process.env.CLOUD_DOWNLOAD_CHANNEL_ID;

        try {
            const invite = await bot.createChatInviteLink(targetChannel, {
                member_limit: 1
            });

            const sentMsg = await bot.sendMessage(chatId, `✅ <b>${tariff.name}</b> muvaffaqiyatli xarid qilindi!\n\nQuyidagi tugma orqali maxsus kanalga qo'shilishingiz mumkin.\n<b>Diqqat: Ushbu link orqali faqat 1 marta kirish mumkin. Uni boshqalarga yubormang!</b>`, {
                parse_mode: "HTML",
                protect_content: true,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "🚀 Kanalga qo'shilish", url: invite.invite_link }]
                    ]
                }
            });

            await updateUser(chatId, { action: `waitjoin_${targetChannel}_${sentMsg.message_id}_${duration}_${type}` });
            bot.deleteMessage(chatId, messageId).catch(()=>{});

        } catch (error) {
            console.error("Link yaratishda xato:", error);
            bot.sendMessage(chatId, "⚠️ Xatolik! Kanal linkini yaratib bo'lmadi. Bot o'sha kanalga to'liq ADMIN qilinganini tekshiring.");
        }
        return true;
    }

    return false;
};

module.exports = {
    openCloudMenu,
    handleReceiptUpload,
    handleCloudQuery
};
