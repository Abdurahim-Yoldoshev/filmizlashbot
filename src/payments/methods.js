const bot = require('../../src/bot');
const { updateUser } = require('../../base/models/user.model');

// --- TRANSFER ---
const handleTransferClick = async (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    const text = `<blockquote><b>💳 Hisob / O'tkazish</b></blockquote>\n\n💸 <b>O'tkazish turini tanlang:</b>`;

    bot.answerCallbackQuery(query.id).catch(()=>{});
    bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "👤 Hisobga", callback_data: "transfer_type_user" },
                    { text: "🎁 Promokodga", callback_data: "transfer_type_promo" }
                ],
                [{ text: "🔙 Orqaga", callback_data: "back_balance" }]
            ]
        }
    }).catch(()=>{});
};

const handleTransferIdInput = async (msg, user) => {
    const chatId = msg.chat.id;
    const recipientId = msg.text.trim();

    // ID o'ziga teng bo'lmasligi kerak va faqat raqam bo'lishi kerak
    if (recipientId == chatId) {
        await bot.sendMessage(chatId, "⚠️ O'z-o'zingizga pul o'tkaza olmaysiz! Boshqa ID kiriting:");
        return;
    }
    
    // Foydalanuvchini bazadan qidirish
    const { getUser } = require('../../base/models/user.model');
    const recipient = await getUser(recipientId);
    
    if (!recipient) {
        await bot.sendMessage(chatId, "❌ Bunday ID ga ega foydalanuvchi topilmadi! Qaytadan to'g'ri ID kiriting:");
        return;
    }

    await updateUser(chatId, { action: `transfer_amount_${recipientId}` });
    
    await bot.sendMessage(chatId, `Foydalanuvchi topildi: <b>${recipient.name || "Noma'lum"}</b>\n\nEndi o'tkazmoqchi bo'lgan summani kiriting (masalan, 5000):`, { parse_mode: "HTML" });
};

const handleTransferAmountInput = async (msg, user) => {
    const chatId = msg.chat.id;
    const text = msg.text.trim().replace(/\s+/g, '');
    const { getUser } = require('../../base/models/user.model');
    
    const parts = user.action.split('_');
    const recipientId = parts[2];

    const amount = parseInt(text);
    
    let transferFeePercent = 0;
    try {
        const db = require('../../base/db');
        const res = await db.execute({ sql: `SELECT price FROM finance_plans WHERE type = 'margin' AND name = 'transfer_fee_percent'` });
        if (res.rows.length > 0) transferFeePercent = res.rows[0].price;
    } catch(e) {}

    const fee = Math.floor(amount * (transferFeePercent / 100));
    const requiredBalance = amount + fee;

    if (isNaN(amount) || amount <= 0) {
        await bot.sendMessage(chatId, "⚠️ Iltimos, faqat raqamdan iborat va 0 dan katta summa kiriting:");
        return;
    }

    if (!user || (user.balance || 0) < requiredBalance) {
        const feeText = transferFeePercent > 0 ? `komissiya bilan birga ` : '';
        await bot.sendMessage(chatId, `❌ Hisobingizda yetarli mablag' yo'q!\n\nSiz <b>${amount} so'm</b> o'tkazmoqchisiz, buning uchun ${feeText}<b>${requiredBalance} so'm</b> kerak bo'ladi.`);
        await updateUser(chatId, { action: "" });
        return;
    }

    const recipient = await getUser(recipientId);
    if (!recipient) {
        await bot.sendMessage(chatId, "❌ Bunday ID raqamli foydalanuvchi topilmadi.");
        await updateUser(chatId, { action: "" });
        return;
    }

    const safeName = recipient.name ? String(recipient.name).replace(/[<>&]/g, '') : "Foydalanuvchi";
    
    // Tasdiqlash tugmasini yuboramiz
    await updateUser(chatId, { action: "" });
    const formattedAmount = amount.toLocaleString('ru-RU');
    const formattedFee = fee.toLocaleString('ru-RU');
    const formattedRequired = requiredBalance.toLocaleString('ru-RU');

    let confirmText = `Siz haqiqatdan ham pul o'tkazmoqchimisiz?\n\n👤 <b>Qabul qiluvchi:</b> <a href="tg://user?id=${recipient.chatId}">${safeName}</a>\n💵 <b>Summa:</b> ${formattedAmount} so'm`;
    if (transferFeePercent > 0) {
        confirmText += `\n\n➕ <b>Xizmat haqi (${transferFeePercent}%):</b> ${formattedFee} so'm`;
    }
    confirmText += `\n💳 <b>Jami yechib olinadi:</b> ${formattedRequired} so'm`;

    await bot.sendMessage(chatId, confirmText, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: "✅ Tasdiqlash", callback_data: `transfer_confirm_${recipientId}_${amount}` }],
                [{ text: "🔙 Orqaga", callback_data: "pay_transfer" }]
            ]
        }
    });

    await updateUser(chatId, { action: "" }); // kutishni tugatamiz, chunki endi inline button kutamiz
};

// --- REFERRAL ---
const handleReferral = async (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    try {
        const botInfo = await bot.getMe();
        const botUsername = botInfo.username;
        const refLink = `https://t.me/${botUsername}?start=ref_${chatId}`;

        let refInviteBonus = 0;
        let refPurchasePercent = 0;
        try {
            const db = require('../../base/db');
            const res = await db.execute({ sql: `SELECT name, price FROM finance_plans WHERE type = 'margin' AND name IN ('referral_invite_bonus', 'referral_purchase_percent')` });
            for (const r of res.rows) {
                if (r.name === 'referral_invite_bonus') refInviteBonus = r.price;
                if (r.name === 'referral_purchase_percent') refPurchasePercent = r.price;
            }
        } catch(e) {}

        let textParts = `<blockquote>Ushbu ssilkani do'stlaringizga yuboring. Ular botga kirishi bilan do'stlar orttirasiz!</blockquote>`;
        if (refInviteBonus > 0 || refPurchasePercent > 0) {
            textParts = `<blockquote>Ushbu ssilkani do'stlaringizga yuboring.`;
            if (refInviteBonus > 0) textParts += `\nUlar botga kirganida sizning hisobingizga avtomatik ravishda <b>${refInviteBonus} so'm</b> qo'shiladi!`;
            if (refPurchasePercent > 0) textParts += `\nHar bir xarid uchun sizga <b>${refPurchasePercent}%</b> qo'shiladi!`;
            textParts += `</blockquote>`;
        }

        const text = `<blockquote><b>💳 Hisob / To'ldirish / Referal</b></blockquote>\n\n🔗 <b>Referal tizimi</b>\n\nSizning maxsus ssilkangiz:\n<blockquote><code>${refLink}</code></blockquote>\n\n${textParts}`;

        bot.answerCallbackQuery(query.id).catch(()=>{});
        bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "back_balance" }]]
            }
        }).catch(()=>{});

    } catch (e) {
        console.error(e);
        bot.answerCallbackQuery(query.id, { text: "Xatolik yuz berdi" });
    }
};


const handleCreatePromoAmountInput = async (msg, user) => {
    const chatId = msg.chat.id;
    const text = msg.text.trim().replace(/\s+/g, '');
    const amount = parseInt(text);
    const actionParts = user.action.split('_');
    const count = parseInt(actionParts[2]); // e.g. "promo_amount_5" -> 5
    
    if (isNaN(amount) || amount <= 0) {
        await bot.sendMessage(chatId, "⚠️ Iltimos, bitta odam uchun mo'ljallangan summani to'g'ri raqamda kiriting:");
        return;
    }

    const totalAmount = amount * count;
    
    let promocodeFeePercent = 0;
    try {
        const db = require('../../base/db');
        const res = await db.execute({ sql: `SELECT price FROM finance_plans WHERE type = 'margin' AND name = 'promocode_fee_percent'` });
        if (res.rows.length > 0) promocodeFeePercent = res.rows[0].price;
    } catch(e) {}

    const fee = Math.floor(totalAmount * (promocodeFeePercent / 100));
    const requiredBalance = totalAmount + fee;

    if ((user.balance || 0) < requiredBalance) {
        const feeText = promocodeFeePercent > 0 ? ` (${promocodeFeePercent}% komissiya bilan)` : '';
        await bot.sendMessage(chatId, `❌ Hisobingizda yetarli mablag' yo'q!\n\nJami summa${feeText}: <b>${requiredBalance} so'm</b> kerak bo'ladi.`, { parse_mode: 'HTML' });
        await updateUser(chatId, { action: "" });
        return;
    }

    const confirmText = `Siz haqiqatdan ham promokod yaratmoqchimisiz?\n\n👥 <b>Kishilar soni:</b> ${count} ta\n💵 <b>Har biriga:</b> ${amount} so'm\n\n➕ <b>Ustama (${promocodeFeePercent}%):</b> ${fee} so'm\n💳 <b>Jami yechib olinadi:</b> ${requiredBalance} so'm\n💰 <b>Hozirgi balansingiz:</b> ${user.balance || 0} so'm`;

    await bot.sendMessage(chatId, confirmText, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: "✅ Tasdiqlash va Yaratish", callback_data: `confirm_promo_${amount}_${count}` }],
                [{ text: "🔙 Orqaga", callback_data: "transfer_type_promo" }]
            ]
        }
    });

    await updateUser(chatId, { action: "" });
};

// --- PROMOCODE ---
const handlePromocodeClick = async (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    await updateUser(chatId, { action: "enter_promocode" });

    const text = `<blockquote><b>💳 Hisob / To'ldirish / Promokod</b></blockquote>\n\n🎁 <b>Promokod</b>\n\nIltimos, promokodni yuboring:`;

    bot.answerCallbackQuery(query.id).catch(()=>{});
    bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "back_balance" }]]
        }
    }).catch(()=>{});
};

const handlePromocodeInput = async (msg, user) => {
    const chatId = msg.chat.id;
    const code = msg.text.trim();

    const { getPromocode, checkPromoUsage, incrementPromoUses, recordPromoUsage, deletePromocode } = require('../../base/models/promocode.model');
    
    const promo = await getPromocode(code);
    
    if (!promo) {
        await bot.sendMessage(chatId, "❌ Noto'g'ri, yaroqsiz yoki foydalanish imkoni tugagan promokod.");
        await updateUser(chatId, { action: "" });
        return;
    }

    if (promo.current_uses >= promo.max_uses) {
        // Aslida endi bu yerga kirmasligi kerak (chunki oxirgisida o'chiriladi)
        await bot.sendMessage(chatId, "⚠️ Ushbu promokoddan foydalanish imkoni tugagan.");
        await deletePromocode(code);
        await updateUser(chatId, { action: "" });
        return;
    }

    const hasUsed = await checkPromoUsage(code, chatId.toString());
    if (hasUsed) {
        await bot.sendMessage(chatId, "⚠️ Siz ushbu promokoddan allaqachon foydalangansiz!");
        await updateUser(chatId, { action: "" });
        return;
    }

    // Promokodni qo'llash
    await updateUser(chatId, { action: "", balance: (user.balance || 0) + promo.amount });

    // Agar shu bilan promokod to'lgan bo'lsa, uni bazadan butunlay o'chirib yuboramiz
    if (promo.current_uses + 1 >= promo.max_uses) {
        await deletePromocode(code);
        if (promo.created_by) {
            bot.sendMessage(promo.created_by, `⚠️ <b>Diqqat!</b>\n\nSiz yaratgan <code>${code}</code> promokodidan foydalanishlar soni to'liq tugadi va u yaroqsiz holatga kelib, bazadan o'chirildi.`, { parse_mode: 'HTML' }).catch(()=>{});
        }
    } else {
        await incrementPromoUses(code);
        await recordPromoUsage(code, chatId.toString());
    }

    await bot.sendMessage(chatId, `🎉 <b>Promokod muvaffaqiyatli faollashtirildi!</b>\n\nHisobingizga <b>${promo.amount} so'm</b> qo'shildi!`, { parse_mode: 'HTML' });
};


// --- CARD ---
const handleCardClick = async (query) => {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    let cashbackText = "";
    try {
        const db = require('../../base/db');
        const res = await db.execute({ sql: "SELECT price, duration_days FROM finance_plans WHERE type = 'cashback_tier' ORDER BY price ASC" });
        if (res.rows.length > 0) {
            cashbackText = "\n\n🎁 <b>Yirik to'lov keshbeklari:</b>\n";
            for (const r of res.rows) {
                const amountFormatted = parseInt(r.price).toLocaleString('ru-RU');
                cashbackText += `• ${amountFormatted} so'mdan boshlab: <b>${r.duration_days}%</b>\n`;
            }
            cashbackText = `<blockquote>${cashbackText.trim()}</blockquote>\n`;
        }
    } catch (e) {}

    const text = `<blockquote><b>💳 Hisob / To'ldirish / Karta</b></blockquote>\n\n💳 <b>Karta orqali to'ldirish</b>\n${cashbackText}\nHisobni to'ldirish summasini kiriting (masalan, 5000):`;

    await updateUser(chatId, { action: "card_amount" });

    bot.answerCallbackQuery(query.id).catch(()=>{});
    bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "back_balance" }]]
        }
    }).catch(()=>{});
};

const handleCardAmountInput = async (msg, user) => {
    const chatId = msg.chat.id;
    const text = msg.text ? msg.text.trim().replace(/[\s,]/g, '') : '';

    const amount = parseInt(text);
    if (isNaN(amount) || amount <= 0) {
        await bot.sendMessage(chatId, 
            "⚠️ <b>Summani to'g'ri kiriting!</b>\n\n" +
            "Miqdorni <b>aniq, tiyinigacha</b> yozing.\n" +
            "Bot shu summani bank xabarnomasidan topib tasdiqlanadi.\n\n" +
            "Masalan: <code>50000</code>",
            { parse_mode: 'HTML' }
        );
        return;
    }

    const formattedAmount = amount.toLocaleString('ru-RU');

    // Keshbek hisoblash
    let bonusText = "";
    try {
        const db = require('../../base/db');
        const res = await db.execute({ sql: `SELECT price, duration_days FROM finance_plans WHERE type = 'cashback_tier' ORDER BY price DESC` });
        let bonusPercent = 0;
        for (const r of res.rows) {
            if (amount >= parseInt(r.price)) { bonusPercent = parseFloat(r.duration_days); break; }
        }
        if (bonusPercent > 0) {
            const bonusAmount = Math.floor(amount * (bonusPercent / 100));
            bonusText = `\n\n🎁 <i>Keshbek: <b>+${bonusAmount.toLocaleString('ru-RU')} so'm (${bonusPercent}%)</b> — jami <b>${(amount+bonusAmount).toLocaleString('ru-RU')} so'm</b> tushadi.</i>`;
        }
    } catch(e) {}

    // Userbot ulanganligi tekshiruvi
    const { isUserbotConnected } = require('../userbot/client');
    if (!isUserbotConnected()) {
        // Userbot yo'q — eski chek usuli
        const { getSetting } = require('../../base/models/settings.model');
        const cardData = (await getSetting('payment_card')) || '8600 0000 0000 0000|Karta egasi';
        const [cardNumber, cardOwner] = cardData.split('|');
        await updateUser(chatId, { action: `card_receipt_${amount}` });
        await bot.sendMessage(chatId, 
            `Siz <b>${formattedAmount} so'm</b> kiritdingiz.${bonusText}\n\n` +
            `Quyidagi karta raqamiga to'lov qiling va chekni (skrinshotni) yuboring:\n\n` +
            `💳 Karta: <code>${cardNumber}</code>\n👤 F.I.O: ${cardOwner}\n\n` +
            `<i>Diqqat: Chek rasmini hozirning o'zida yuborishingiz kerak.</i>`,
            { 
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: [[{ text: "🔙 Orqaga / Bekor qilish", callback_data: "back_balance" }]]
                }
            }
        );
        return;
    }

    // Userbot bor — avtomatik tekshirish
    const { getSetting } = require('../../base/models/settings.model');
    const cardData = (await getSetting('payment_card')) || '8600 0000 0000 0000|Karta egasi';
    const [cardNumber, cardOwner] = cardData.split('|');

    await updateUser(chatId, { action: `card_auto_check_${amount}` });
    const waitMsg = await bot.sendMessage(chatId,
        `💳 <b>${formattedAmount} so'm</b> qabul qilish uchun kutilmoqda...${bonusText}\n\n` +
        `Iltimos, hozir quyidagi kartaga <b>aynan ${formattedAmount} so'm</b> o'tkazing:\n\n` +
        `💳 Karta: <code>${cardNumber}</code>\n👤 F.I.O: ${cardOwner}\n\n` +
        `⚠️ <b>Ogohlantirish:</b> Summani tiyinigacha aniq o'tkazing, bo'lmasa bot tasdiqlay olmaydi!\n\n` +
        `⏳ Pul o'tkazgach, <b>15 daqiqa</b> ichida avtomatik tasdiqlanadi.`,
        { 
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [[{ text: "🔙 Orqaga / Bekor qilish", callback_data: "back_balance" }]]
            }
        }
    );

    // 15 daqiqa davomida har 20 soniyada tekshirish
    const { findMatchingPayment, markPaymentUsed } = require('../userbot/listener');
    const maxWait = 15 * 60 * 1000; // 15 daqiqa
    const interval = 20 * 1000; // 20 soniya
    const startTime = Date.now();

    const checkLoop = setInterval(async () => {
        try {
            const currentUser = await getUser(chatId);
            // Agar user action ni o'zgartirgan bo'lsa (bekor qilgan) — to'xtat
            if (!currentUser || !currentUser.action || !currentUser.action.startsWith('card_auto_check_')) {
                clearInterval(checkLoop);
                return;
            }

            const payment = await findMatchingPayment(amount);
            if (payment) {
                clearInterval(checkLoop);
                await markPaymentUsed(payment.id);
                await updateUser(chatId, { action: "" });

                // Keshbek hisoblash
                let finalAmount = amount;
                let bonusMsg = "";
                try {
                    const db = require('../../base/db');
                    const res = await db.execute({ sql: `SELECT price, duration_days FROM finance_plans WHERE type = 'cashback_tier' ORDER BY price DESC` });
                    for (const r of res.rows) {
                        if (amount >= parseInt(r.price)) {
                            const bonusPercent = parseFloat(r.duration_days);
                            const bonus = Math.floor(amount * (bonusPercent / 100));
                            finalAmount = amount + bonus;
                            bonusMsg = ` (+ ${bonus.toLocaleString('ru-RU')} so'm keshbek)`;
                            break;
                        }
                    }
                } catch(e) {}

                // Balansga qo'shish
                const db = require('../../base/db');
                await db.execute({ sql: `UPDATE users SET balance = balance + ? WHERE chatId = ?`, args: [finalAmount, chatId] });

                bot.deleteMessage(chatId, waitMsg.message_id).catch(()=>{});
                await bot.sendMessage(chatId,
                    `✅ <b>To'lov tasdiqlandi!</b>\n\n` +
                    `💵 To'langan: <b>${formattedAmount} so'm</b>${bonusMsg}\n` +
                    `💰 Hisobingizga: <b>+${finalAmount.toLocaleString('ru-RU')} so'm</b> qo'shildi!\n\n` +
                    `📊 Manba: @${payment.bot_username}`,
                    { parse_mode: "HTML" }
                );
                return;
            }

            // Vaqt tugadimi?
            if (Date.now() - startTime > maxWait) {
                clearInterval(checkLoop);
                const stillUser = await getUser(chatId);
                if (stillUser && stillUser.action && stillUser.action.startsWith('card_auto_check_')) {
                    await updateUser(chatId, { action: `card_receipt_${amount}` });
                    bot.deleteMessage(chatId, waitMsg.message_id).catch(()=>{});
                    await bot.sendMessage(chatId,
                        `⚠️ <b>Xatolik!</b>\n\n` +
                        `15 daqiqa ichida <b>${formattedAmount} so'm</b> li to'lov @HUMOcardbot yoki @CardXabarbot da avtomatik topilmadi.\n\n` +
                        `Agar to'lov qilgan bo'lsangiz, <b>to'lov chekining skrinshotini (rasmini)</b> shu yerga yuboring — adminga yuboramiz va u tasdiqlasa balansingiz to'ldiriladi.`,
                        { parse_mode: "HTML" }
                    );
                }
            }
        } catch(e) {
            console.error('[AutoCheck] Xato:', e.message);
        }
    }, interval);
};

const handleCardReceipt = async (msg, user) => {
    const chatId = msg.chat.id;
    
    const rawAmount = user.action.split('_')[2]; 
    const amount = parseInt(rawAmount);
    const formattedAmount = amount.toLocaleString('ru-RU');

    if (msg.photo) {
        const adminId = Number(process.env.ADMIN_ID);
        const safeName = user.name ? String(user.name).replace(/[<>&]/g, '') : "Foydalanuvchi";
        const username = user.username ? String(user.username).replace(/[<>&]/g, '') : "Foydalanuvchi";
        
        const caption = `<b>Yangi hisob to'ldirish cheki!</b>\n\n👤 Foydalanuvchi: <a href="https://t.me/${username}">${safeName}</a> (<code>${chatId}</code>)\n💳 <b>Karta orqali pul o'tkazma</b>\n💵 Kiritilgan summa: <b>${formattedAmount} so'm</b>`;
        
        const adminKeyboard = {
            inline_keyboard: [
                [{ text: `✅ Tasdiqlash (${formattedAmount} so'm)`, callback_data: `card_confirm_${amount}_${chatId}` }],
                [{ text: "❌ Rad etish", callback_data: `card_reject_${chatId}` }]
            ]
        };

        try {
            const fileId = msg.photo[msg.photo.length - 1].file_id;
            await bot.sendPhoto(adminId, fileId, { caption: caption, parse_mode: "HTML", reply_markup: adminKeyboard });
            
            await bot.sendMessage(chatId, "✅ Chek adminga yuborildi. Iltimos, tasdiqlanishini kuting.");
            await updateUser(chatId, { action: '' });
        } catch (error) {
            console.error("Adminga chek yuborishda xato:", error);
        }
    } else {
        await bot.sendMessage(chatId, "⚠️ Iltimos, to'lov chekini <b>faqat rasm (skrinshot)</b> shaklida yuboring!", { parse_mode: "HTML" });
    }
};

module.exports = { 
    handleTransferClick,
    handleTransferIdInput,
    handleTransferAmountInput,
    handleCreatePromoAmountInput,
    handleReferral, 
    handlePromocodeClick, 
    handlePromocodeInput, 
    handleCardClick, 
    handleCardAmountInput, 
    handleCardReceipt 
};
