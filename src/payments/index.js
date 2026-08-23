const bot = require('../../src/bot');
const { 
    handleTransferClick, handleTransferIdInput, handleTransferAmountInput,
    handleReferral, handlePromocodeClick, handlePromocodeInput, 
    handleCardClick, handleCardAmountInput, handleCardReceipt 
} = require('./methods');
const { sendBalance } = require('../helper/balance');
const { getUser, updateUser } = require('../../base/models/user.model');

const handlePaymentsQuery = async (query) => {
    const data = query.data;
    const chatId = query.message.chat.id;

    if (data === "menu_topup") {
        const text = `<blockquote><b>💳 Hisob / To'ldirish</b></blockquote>\n\n💳 <b>Hisobni to'ldirish turini tanlang:</b>`;
        bot.editMessageText(text, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "🔗 Referal", callback_data: "pay_referral" },
                        { text: "🎁 Promokod", callback_data: "pay_promocode" }
                    ],
                    [
                        { text: "💳 Karta", callback_data: "pay_card" }
                    ],
                    [
                        { text: "🔙 Orqaga", callback_data: "back_balance" }
                    ]
                ]
            }
        }).catch(()=>{});
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }

    if (data === "pay_transfer") {
        await handleTransferClick(query);
        return true;
    }
    if (data === "pay_referral") {
        await handleReferral(query);
        return true;
    }
    if (data === "pay_promocode") {
        await handlePromocodeClick(query);
        return true;
    }
    if (data === "pay_card") {
        await handleCardClick(query);
        return true;
    }

    if (data === "close_balance") {
        bot.deleteMessage(chatId, query.message.message_id).catch(()=>{});
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }
    if (data === "back_balance") {
        const user = await getUser(chatId);
        await updateUser(chatId, { action: "" });
        
        bot.deleteMessage(chatId, query.message.message_id).catch(()=>{});
        bot.answerCallbackQuery(query.id).catch(()=>{});
        await sendBalance(query.message, user);
        return true;
    }

    if (data === "transfer_type_user") {
        await updateUser(chatId, { action: "transfer_id_prompt" });
        const text = `<blockquote><b>💳 Hisob / O'tkazish / Hisobga</b></blockquote>\n\n💸 <b>Pul o'tkazish</b>\n\nIltimos, pul o'tkazmoqchi bo'lgan foydalanuvchining ID raqamini kiriting:`;
        bot.editMessageText(text, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "pay_transfer" }]]
            }
        }).catch(()=>{});
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }

    if (data === "transfer_type_promo") {
        bot.editMessageText(`<blockquote><b>💳 Hisob / O'tkazish / Promokodga</b></blockquote>\n\n🎁 Promokod necha kishilik bo'lishini tanlang:`, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [ { text: "1 kishilik", callback_data: "create_promo_1" }, { text: "5 kishilik", callback_data: "create_promo_5" }, { text: "10 kishilik", callback_data: "create_promo_10" } ],
                    [ { text: "🔙 Orqaga", callback_data: "pay_transfer" } ]
                ]
            }
        }).catch(()=>{});
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }

    if (data.startsWith("create_promo_")) {
        const count = parseInt(data.replace("create_promo_", ""));
        await updateUser(chatId, { action: `promo_amount_${count}` });
        
        let promocodeFeePercent = 0;
        try {
            const db = require('../../base/db');
            const res = await db.execute({ sql: `SELECT price FROM finance_plans WHERE type = 'margin' AND name = 'promocode_fee_percent'` });
            if (res.rows.length > 0) promocodeFeePercent = res.rows[0].price;
        } catch(e) {}

        bot.editMessageText(`<blockquote><b>💳 Hisob / O'tkazish / Promokodga</b></blockquote>\n\nSiz <b>${count} kishilik</b> promokod yaratishni tanladingiz.\n\nHar bir odamga beriladigan summani kiriting (masalan 1000):\n<i>(Eslatma: jami summadan +${promocodeFeePercent}% ustama komissiya yechib olinadi)</i>`, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "transfer_type_promo" }]]
            }
        }).catch(()=>{});
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }

    if (data.startsWith("confirm_promo_")) {
        const parts = data.split("_");
        const amount = parseInt(parts[2]);
        const count = parseInt(parts[3]);
        let promocodeFeePercent = 0;
        try {
            const db = require('../../base/db');
            const res = await db.execute({ sql: `SELECT price FROM finance_plans WHERE type = 'margin' AND name = 'promocode_fee_percent'` });
            if (res.rows.length > 0) promocodeFeePercent = res.rows[0].price;
        } catch(e) {}

        const totalAmount = amount * count;
        const fee = Math.floor(totalAmount * (promocodeFeePercent / 100));
        const requiredBalance = totalAmount + fee;

        const user = await getUser(chatId);
        
        if (!user || (user.balance || 0) < requiredBalance) {
            bot.answerCallbackQuery(query.id, { text: "❌ Hisobingizda yetarli mablag' yo'q!", show_alert: true }).catch(()=>{});
            return true;
        }

        const newBalance = (user.balance || 0) - requiredBalance;
        await updateUser(chatId, { balance: newBalance });

        const { createPromocode } = require('../../base/models/promocode.model');
        const code = Math.random().toString(36).substring(2, 10).toUpperCase();

        await createPromocode(code, amount, count, chatId.toString());

        bot.answerCallbackQuery(query.id, { text: `✅ Yechib olindi: ${requiredBalance} so'm.\nQoldiq: ${newBalance} so'm`, show_alert: true }).catch(()=>{});
        bot.deleteMessage(chatId, query.message.message_id).catch(()=>{});
        
        const feeMsg = promocodeFeePercent > 0 ? ` (shundan ${promocodeFeePercent}% komissiya: ${fee} so'm)` : ``;
        bot.sendMessage(chatId, `✅ <b>Promokod muvaffaqiyatli yaratildi!</b>\n\nJami yechib olindi: <b>${requiredBalance} so'm</b>${feeMsg}\n\n🎁 Promokod: <code>${code}</code>\n👥 Foydalanishlar soni: ${count} kishilik\n💵 Har bir kishiga: ${amount} so'm\n\n<i>Ushbu promokodni oluvchilarga yuborishingiz mumkin!</i>`, { parse_mode: 'HTML' });

        return true;
    }

    if (data.startsWith("transfer_confirm_")) {
        const parts = data.split('_');
        const recipientId = parts[2];
        const amount = parseInt(parts[3]);

        let transferFeePercent = 0;
        try {
            const db = require('../../base/db');
            const res = await db.execute({ sql: `SELECT price FROM finance_plans WHERE type = 'margin' AND name = 'transfer_fee_percent'` });
            if (res.rows.length > 0) transferFeePercent = parseFloat(res.rows[0].price);
        } catch(e) {}

        const fee = Math.floor(amount * (transferFeePercent / 100));
        const requiredBalance = amount + fee;

        const sender = await getUser(chatId);
        const recipient = await getUser(recipientId);

        if (!sender || !recipient) {
            bot.answerCallbackQuery(query.id, { text: "Xatolik: foydalanuvchi topilmadi!", show_alert: true }).catch(()=>{});
            return true;
        }

        if ((sender.balance || 0) < requiredBalance) {
            bot.answerCallbackQuery(query.id, { text: "❌ Hisobingizda yetarli mablag' yo'q!", show_alert: true }).catch(()=>{});
            return true;
        }

        // Yechish va qo'shish
        await updateUser(chatId, { balance: (sender.balance || 0) - requiredBalance });
        await updateUser(recipientId, { balance: (recipient.balance || 0) + amount });

        const formattedAmount = amount.toLocaleString('ru-RU');
        const formattedFee = fee.toLocaleString('ru-RU');
        const formattedRequired = requiredBalance.toLocaleString('ru-RU');

        // Senderga xabar
        bot.answerCallbackQuery(query.id, { text: `✅ Yechib olindi: ${formattedRequired} so'm!`, show_alert: true }).catch(()=>{});
        bot.deleteMessage(chatId, query.message.message_id).catch(()=>{});
        
        let successText = `✅ <b>${recipient.name || "Noma'lum"}</b> hisobiga <b>${formattedAmount} so'm</b> o'tkazildi.\n\n<i>Jami yechib olindi: ${formattedRequired} so'm`;
        if (transferFeePercent > 0) successText += ` (shundan ${formattedFee} so'm xizmat haqi)`;
        successText += `.</i>`;
        
        bot.sendMessage(chatId, successText, { parse_mode: "HTML" }).catch(()=>{});

        // Recipientga xabar
        bot.sendMessage(recipientId, `🎉 <b>Diqqat!</b>\n\nSizning hisobingizga <b>${sender.name || "Noma'lum"}</b> (<code>${chatId}</code>) tomonidan <b>${formattedAmount} so'm</b> o'tkazildi!`, { parse_mode: "HTML" }).catch(()=>{});

        return true;
    }

    if (data.startsWith("card_confirm_")) {
        const parts = data.split('_');
        const amount = parseInt(parts[2]);
        const formattedAmount = amount.toLocaleString('ru-RU');
        const userId = parts[3];
        
        let bonus = 0;
        let bonusPercent = 0;
        
        try {
            const db = require('../../base/db');
            const res = await db.execute({ sql: `SELECT price, duration_days FROM finance_plans WHERE type = 'cashback_tier' ORDER BY price DESC` });
            for (const r of res.rows) {
                const tierAmount = r.price;
                const tierPercent = parseFloat(r.duration_days);
                if (amount >= tierAmount) {
                    bonusPercent = tierPercent;
                    break;
                }
            }
        } catch(e) {}

        if (bonusPercent > 0) {
            bonus = Math.floor(amount * (bonusPercent / 100)); // cashback
        }
        const totalAdd = amount + bonus;
        
        const user = await getUser(userId);
        if (user) {
            await updateUser(userId, { balance: (user.balance || 0) + totalAdd });
            let msg = `🎉 Hisobingizga ${formattedAmount} so'm tushdi!`;
            if (bonus > 0) {
                msg += `\n\n🎁 <b>Yirik to'lov bonusi!</b>\nSizga tizim tomonidan <b>${bonus.toLocaleString('ru-RU')} so'm (${bonusPercent}%) keshbek</b> taqdim etildi!\n\nJami qo'shilgan summa: <b>${totalAdd.toLocaleString('ru-RU')} so'm</b>`;
            }
            bot.sendMessage(userId, msg, { parse_mode: 'HTML' }).catch(()=>{});
        }
        bot.editMessageCaption(`✅ Tasdiqlandi. Kiritilgan summa: ${formattedAmount} so'm` + (bonus > 0 ? ` (+${bonus.toLocaleString('ru-RU')} keshbek)` : ''), {
            chat_id: chatId,
            message_id: query.message.message_id
        }).catch(()=>{});
        bot.answerCallbackQuery(query.id, { text: "Tasdiqlandi!" });
        return true;
    }

    if (data.startsWith("card_reject_")) {
        const userId = data.split('_')[2];
        bot.sendMessage(userId, "❌ Kechirasiz, sizning karta orqali to'ldirgan chekingiz admin tomonidan rad etildi.").catch(()=>{});
        bot.editMessageCaption(`❌ Rad etildi.`, {
            chat_id: chatId,
            message_id: query.message.message_id
        }).catch(()=>{});
        bot.answerCallbackQuery(query.id, { text: "Rad etildi!" });
        return true;
    }

    if (data === "lucky_spin") {
        const text = `<blockquote><b>🎰 Omad Charxi</b></blockquote>\n\n🎰 <b>Omad Charxi</b>\n\nIshtirok etish narxi: <b>2 000 so'm</b>\n\nYutuqlar:\n🔹 10 000 so'm\n🔹 5 000 so'm\n🔹 2 500 so'm\n🔹 1 000 so'm\n🔹 0 so'm\n\nOmadingizni sinab ko'rasizmi?`;
        
        bot.editMessageText(text, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🔄 Aylantirish (2 000 so'm)", callback_data: "lucky_spin_start" }],
                    [{ text: "🔙 Orqaga", callback_data: "back_balance" }]
                ]
            }
        }).catch(()=>{});
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }

    if (data === "lucky_spin_start") {
        const cost = 2000;
        const user = await getUser(chatId);
        
        if (!user || (user.balance || 0) < cost) {
            bot.answerCallbackQuery(query.id, { text: "❌ Hisobingizda yetarli mablag' yo'q!", show_alert: true }).catch(()=>{});
            return true;
        }

        // Generate prize based on probability
        const rand = Math.random();
        let prize = 0;
        if (rand < 0.02) prize = 10000;         // 2% chance
        else if (rand < 0.10) prize = 5000;     // 8% chance
        else if (rand < 0.25) prize = 2500;     // 15% chance
        else if (rand < 0.50) prize = 1000;     // 25% chance
        else prize = 0;                         // 50% chance

        const newBalance = (user.balance || 0) - cost + prize;
        await updateUser(chatId, { balance: newBalance });

        let resultText = '';
        if (prize === 0) {
            resultText = `😔 <b>Afsuski, hech narsa yutmadingiz!</b>\n\nOmadingizni yana sinab ko'ring!`;
        } else {
            resultText = `🎉 <b>Tabriklaymiz! Siz ${prize.toLocaleString('ru-RU')} so'm yutib oldingiz!</b>`;
        }

        const text = `<blockquote><b>🎰 Omad Charxi / Natija</b></blockquote>\n\n🎰 <b>Omad Charxi Natijasi:</b>\n\n${resultText}\n\n💰 Hozirgi balansingiz: <b>${newBalance.toLocaleString('ru-RU')} so'm</b>`;
        
        bot.editMessageText(text, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🔄 Yana aylantirish", callback_data: "lucky_spin_start" }],
                    [{ text: "❌ Yopish", callback_data: "close_balance" }]
                ]
            }
        }).catch(()=>{});
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }

    return false;
};

module.exports = { 
    handlePaymentsQuery, 
    handlePromocodeInput, 
    handleCardAmountInput, 
    handleCardReceipt,
    handleTransferIdInput,
    handleTransferAmountInput
};
