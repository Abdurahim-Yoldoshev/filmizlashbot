const cron = require('node-cron');
const bot = require('../../bot');
const { createPromocode } = require('../../../base/models/promocode.model');

// Hazilomuz xabarlar ro'yxati
const funnyMessages = [
    "🔥 Tezkor! Yana bitta tekin pul uchib keldi. Kim birinchi bo'lsa o'sha yutadi!",
    "🏃‍♂️ Yuguring, promokod keldi! Sekin qimirlaganlar quruq qoladi.",
    "💸 Osmonidan pul yog'yaptimi deysiz? Yo'q, bu navbatdagi promokod!",
    "🎁 Admin saxiylik qilyapti. Oling-u qoching!",
    "🚀 Diqqat! Buni faqat epchil barmoq egalari ushlab qoladi.",
    "😎 Pul topishning eng oson yo'li — shu promokodni kiritish. Omad!",
    "⚡️ Kim uxlab qoldi? O'yg'oning, promokod keldi!",
    "🤫 Hech kimga aytmang, bu kodni faqat o'zingiz kiriting (yoki ulgursangiz).",
    "🎯 Aniq nishonga uring! Kim birinchi kiritsa o'sha boyiydi.",
    "🤑 Chuntagingizni tayyorlang, summa kelyapti!"
];

const channelId = process.env.PROMO_CHANNEL_ID;

// Tasodifiy son yaratish funksiyasi
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const getSetting = async (name, defaultVal) => {
    try {
        const db = require('../../../base/db');
        const res = await db.execute({ sql: "SELECT price FROM finance_plans WHERE type = 'auto_promo_setting' AND name = ?", args: [name] });
        if (res.rows.length > 0) return parseInt(res.rows[0].price);
    } catch(e) {}
    return defaultVal;
};

let promoState = {
    messageId: null,
    target: 5,
    timeoutId: null
};

const sendRandomPromo = async (isReactionTriggered = false) => {
    try {
        if (promoState.timeoutId) {
            clearTimeout(promoState.timeoutId);
            promoState.timeoutId = null;
        }

    const startHour = await getSetting('auto_promo_start_hour', 8);
    const startMin = await getSetting('auto_promo_start_minute', 0);
    const endHour = await getSetting('auto_promo_end_hour', 23);
    const endMin = await getSetting('auto_promo_end_minute', 0);

    const now = new Date();
    // O'zbekiston vaqti (UTC+5)
    const tzOffsetMs = 5 * 60 * 60 * 1000;
    const localTime = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + tzOffsetMs);
    const currentHour = localTime.getHours();
    const currentMin = localTime.getMinutes();
    
    const currentTotalMin = currentHour * 60 + currentMin;
    const startTotalMin = startHour * 60 + startMin;
    let endTotalMin = endHour * 60 + endMin;
    
    let isWorkingHour = false;
    if (endTotalMin >= startTotalMin) {
        if (currentTotalMin >= startTotalMin && currentTotalMin < endTotalMin) isWorkingHour = true;
    } else {
        if (currentTotalMin >= startTotalMin || currentTotalMin < endTotalMin) isWorkingHour = true;
        endTotalMin += 24 * 60; // Tungi smena uchun matematik to'g'rilash
    }

    // Agar ish vaqti bo'lmasa, kutib turamiz (keyingi ish soatigacha)
    if (!isWorkingHour && !isReactionTriggered) {
        let waitMins = 0;
        if (currentTotalMin < startTotalMin) {
            waitMins = startTotalMin - currentTotalMin;
        } else {
            waitMins = (24 * 60 - currentTotalMin) + startTotalMin;
        }
        console.log(`[AutoPromo] Ish vaqtidan tashqari. ${waitMins} daqiqadan so'ng (soat ${startHour}:${startMin}) uyg'onadi.`);
        promoState.timeoutId = setTimeout(() => { sendRandomPromo(false); }, waitMins * 60 * 1000);
        return;
    }

    // --- PROMOKOD YARATISH ---
    const minCount = await getSetting('auto_promo_count_min', 1);
    const maxCount = await getSetting('auto_promo_count_max', 5);
    const minAmount = await getSetting('auto_promo_amount_min', 100);
    const maxAmount = await getSetting('auto_promo_amount_max', 5000);

    const count = getRandomInt(minCount, maxCount);
    let amount = getRandomInt(Math.floor(minAmount/100), Math.floor(maxAmount/100)) * 100; 
    if (amount < 100) amount = 100;
    
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    await createPromocode(code, amount, count, 'auto_admin');
    
    const randomMsg = funnyMessages[getRandomInt(0, funnyMessages.length - 1)];
    const formattedAmount = amount.toLocaleString('ru-RU');
    
    let headerMsg = isReactionTriggered ? "🔥 <b>Sizlar so'radingiz, biz beramiz!</b>" : "🎉 <b>KUNLIK PROMOKOD!</b>";

    const text = `${headerMsg}\n\n${randomMsg}\n\n👥 <b>Kishilar soni:</b> ${count} ta\n💵 <b>Har biriga:</b> ${formattedAmount} so'm\n\n<i>Pulni olish uchun quyidagi tugmani bosing! (Faqat kanal a'zolari ola oladi)</i>`;
    
    const sentMsg = await bot.sendMessage(channelId, text, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: "🎁 Pulni olish", callback_data: `getpromo_${code}` }]
            ]
        }
    });

    let membersCount = 100;
    try { membersCount = await bot.getChatMemberCount(channelId); } catch(e) {}
    
    let minTarget = Math.max(5, Math.floor(membersCount * 0.005)); 
    let maxTarget = Math.max(10, Math.floor(membersCount * 0.02)); 
    
    promoState.messageId = sentMsg.message_id;
    promoState.target = getRandomInt(minTarget, maxTarget);

    // --- KEYINGI PROMO UCHUN VAQTNI HISOBLASH ---
    const dailyMin = await getSetting('auto_promo_daily_min', 2);
    const dailyMax = await getSetting('auto_promo_daily_max', 5);
    const dailyPromoCount = getRandomInt(dailyMin, dailyMax);

    let totalWorkingMinutes = endTotalMin - startTotalMin;
    if (totalWorkingMinutes <= 0) totalWorkingMinutes = 24 * 60; 

    // Bitta promo uchun o'rtacha vaqt
    const avgIntervalMinutes = Math.floor(totalWorkingMinutes / dailyPromoCount) || 1;
    const minDelayMin = Math.max(1, Math.floor(avgIntervalMinutes * 0.5));
    const maxDelayMin = Math.max(2, Math.floor(avgIntervalMinutes * 1.5));
    
    const randomDelayMs = getRandomInt(minDelayMin, maxDelayMin) * 60 * 1000;

    await bot.sendMessage(channelId, `👇 <b>Keyingi promokod chiqishi uchun yuqoridagi postga ${promoState.target} ta reaksiya bildiring!</b>`, {
        parse_mode: 'HTML'
    });

    promoState.timeoutId = setTimeout(() => {
        sendRandomPromo(false);
    }, randomDelayMs);

    console.log(`Auto promo sent: ${code}. Next target: ${promoState.target} reactions, or in ${Math.floor(randomDelayMs/60000)} minutes.`);
    } catch (e) {
        console.error("Auto promo error:", e);
    }
};

const handleReactionCount = (update) => {
    // update: { chat, message_id, date, reactions }
    if (!promoState.messageId) return;
    if (update.message_id !== promoState.messageId) return;
    if (String(update.chat.id) !== String(channelId)) return;

    let totalReactions = 0;
    if (update.reactions && Array.isArray(update.reactions)) {
        for (const reaction of update.reactions) {
            totalReactions += reaction.total_count;
        }
    }

    if (totalReactions >= promoState.target) {
        promoState.messageId = null; // Lock to prevent multiple triggers
        sendRandomPromo(true);
    }
};

const reloadAutoPromoSchedule = async () => {
    console.log(`Auto promo reaction-based tizimi ishga tushirildi.`);
};

const startAutoPromo = () => {
    // Dastlabki promoni tashlab tsiklni boshlaymiz, yoki admin panel orqali qo'lda ishga tushirish ham mumkin
    // Bot yoqilganda bitta promo tashlash uchun:
    sendRandomPromo(false);
};

module.exports = { startAutoPromo, sendRandomPromo, reloadAutoPromoSchedule, handleReactionCount };
