const bot = require('../bot');
const db = require('../../base/db');
const { updateUser } = require('../../base/models/user.model');

const formatDuration = (d) => {
    if (typeof d === 'string') {
        if (d.endsWith('m')) return parseInt(d) + " daqiqa";
        if (d.endsWith('h')) return parseInt(d) + " soat";
        if (d.endsWith('d')) return parseInt(d) + " kun";
    }
    return d + " kun/soat (Eski format)";
};

const getTariffEmoji = (d) => {
    if (typeof d !== 'string') return '🔹';
    if (d.endsWith('m')) return '🛠'; // Test yoki juda qisqa
    if (d.endsWith('h')) return '⌛'; // Soatlik
    if (d.endsWith('d')) {
        let val = parseInt(d);
        if (val >= 30) return '💎'; // Oy yoki undan katta
        if (val >= 7) return '🥇'; // Haftalik
        if (val > 1) return '🥈'; // Bir necha kun
        return '🥉'; // 1 kunlik
    }
    return '🔹';
};

// --- LIST TARIFFS ---
const showTariffList = async (chatId, messageId, category, queryId = null) => {
    // category is 'watch' or 'download'
    const type = category === 'watch' ? 'tariff_watch' : 'tariff_download';
    const res = await db.execute({ sql: `SELECT * FROM finance_plans WHERE type = ?`, args: [type] });
    const tariffs = res.rows;

    if (tariffs.length === 0 && queryId) {
        bot.answerCallbackQuery(queryId, { text: "😅 Hali hech narsa qo'shilmagan", show_alert: true }).catch(()=>{});
    }

    const inline_keyboard = [];
    for (const t of tariffs) {
        const emoji = getTariffEmoji(t.duration_days);
        inline_keyboard.push([{ text: `${emoji} ${t.name}`, callback_data: `admin_tariff_view_${t.id}` }]);
    }
    
    inline_keyboard.push([{ text: "➕ Tarif qo'shish", callback_data: `admin_add_tariff_${category}` }]);
    inline_keyboard.push([{ text: "🔙 Orqaga", callback_data: "admin_finance_tariffs" }]);

    const title = category === 'watch' ? "Ko'rish" : "Yuklash";
    const text = `<blockquote><b>👨‍💻 Admin Panel / Moliya / Tariflar / ${title}</b></blockquote>\n\n💎 <b>${title} tariflari</b>\n\nMavjud tariflar ro'yxati:`;
    
    await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard }
    }).catch(()=>{});
};

// --- ADD TARIFF ---
const startAddTariff = async (chatId, messageId, category) => {
    await updateUser(chatId, { action: `admin_add_tariff_name|${category}` });
    const text = "➕ <b>Yangi tarif qo'shish</b>\n\nTarif nomini kiriting (Masalan: 1 Oylik obuna):";
    if (messageId) {
        await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: `admin_tariff_list_${category}` }]] }
        }).catch(()=>{});
    } else {
        await bot.sendMessage(chatId, text, { parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: `admin_tariff_list_${category}` }]] } });
    }
};

const handleAddTariffName = async (msg, user) => {
    const chatId = msg.chat.id;
    const category = user.action.split('|')[1];
    const name = msg.text;
    if (!name) return bot.sendMessage(chatId, "Iltimos, matn yuboring.");

    await updateUser(chatId, { action: `admin_add_tariff_price|${category}|${name}` });
    await bot.sendMessage(chatId, `Tarif nomi: <b>${name}</b>\n\nEndi ushbu tarif narxini kiriting (faqat raqamlarda, masalan: 15000):`, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: `admin_tariff_list_${category}` }]] }
    });
};

const handleAddTariffPrice = async (msg, user) => {
    const chatId = msg.chat.id;
    const parts = user.action.split('|');
    const category = parts[1];
    const name = parts[2];
    const price = parseInt(msg.text.replace(/[^0-9]/g, ''));

    if (isNaN(price) || price < 0) {
        return bot.sendMessage(chatId, "Iltimos, to'g'ri narx (raqam) kiriting.");
    }

    await updateUser(chatId, { action: `admin_add_tariff_days|${category}|${name}|${price}` });
    await bot.sendMessage(chatId, `Tarif narxi: <b>${price} so'm</b>\n\nEndi ushbu tarif vaqtini kiriting.\n(Masalan: <b>1 oy, 15 kun, 3 soat, 10 daqiqa</b>):`, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: `admin_tariff_list_${category}` }]] }
    });
};

const handleAddTariffDays = async (msg, user) => {
    const chatId = msg.chat.id;
    const parts = user.action.split('|');
    const category = parts[1];
    const name = parts[2];
    const price = parseInt(parts[3]);
    
    let text = msg.text.toLowerCase();
    let num = parseInt(text.replace(/[^0-9]/g, ''));
    if (isNaN(num) || num <= 0) return bot.sendMessage(chatId, "Iltimos, to'g'ri vaqtni kiriting.");
    
    let suffix = 'd';
    if (text.includes('oy') || text.includes('oylik')) { num = num * 30; suffix = 'd'; }
    else if (text.includes('kun')) suffix = 'd';
    else if (text.includes('soat')) suffix = 'h';
    else if (text.includes('minut') || text.includes('daqiqa')) suffix = 'm';
    else {
        // default to days
        suffix = 'd';
    }
    const finalDuration = num + suffix;

    const type = category === 'watch' ? 'tariff_watch' : 'tariff_download';
    // Use column duration_days for string (SQLite allows this)
    await db.execute({
        sql: `INSERT INTO finance_plans (type, name, price, duration_days) VALUES (?, ?, ?, ?)`,
        args: [type, name, price, finalDuration]
    });

    await updateUser(chatId, { action: "" });
    await bot.sendMessage(chatId, `✅ <b>Yangi tarif muvaffaqiyatli qo'shildi!</b>\n\nNomi: ${name}\nNarxi: ${price} so'm\nMuddati: ${formatDuration(finalDuration)}`, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: `admin_tariff_list_${category}` }]] }
    });
};

// --- VIEW TARIFF ---
const viewTariff = async (chatId, messageId, id) => {
    const res = await db.execute({ sql: `SELECT * FROM finance_plans WHERE id = ?`, args: [id] });
    if (res.rows.length === 0) return;
    const t = res.rows[0];
    const category = t.type === 'tariff_watch' ? 'watch' : 'download';
    const title = category === 'watch' ? "Ko'rish" : "Yuklash";

    const text = `<blockquote><b>👨‍💻 Admin Panel / Moliya / Tariflar / ${title} / ${t.name}</b></blockquote>\n\n💎 <b>Tarif ma'lumoti</b>\n\n<b>Nomi:</b> ${t.name}\n<b>Narxi:</b> ${t.price} so'm\n<b>Muddati:</b> ${formatDuration(t.duration_days)}`;

    await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: [
                [{ text: "✏️ Tahrirlash", callback_data: `admin_tariff_edit_menu_${t.id}` }, { text: "🗑 O'chirish", callback_data: `admin_tariff_del_ask_${t.id}` }],
                [{ text: "🔙 Orqaga", callback_data: `admin_tariff_list_${category}` }]
            ]
        }
    }).catch(()=>{});
};

// --- DELETE TARIFF ---
const askDeleteTariff = async (chatId, messageId, id) => {
    const res = await db.execute({ sql: `SELECT * FROM finance_plans WHERE id = ?`, args: [id] });
    if (res.rows.length === 0) return;
    const t = res.rows[0];

    const text = `⚠️ <b>Haqiqatdan ham "${t.name}" tarifini o'chirmoqchimisiz?</b>\nBu amalni orqaga qaytarib bo'lmaydi!`;
    await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: [
                [{ text: "✅ Ha, o'chirish", callback_data: `admin_tariff_del_confirm_${t.id}` }],
                [{ text: "🔙 Orqaga", callback_data: `admin_tariff_view_${t.id}` }]
            ]
        }
    }).catch(()=>{});
};

const confirmDeleteTariff = async (chatId, messageId, queryId, id) => {
    const res = await db.execute({ sql: `SELECT type FROM finance_plans WHERE id = ?`, args: [id] });
    if (res.rows.length === 0) return;
    const type = res.rows[0].type;
    const category = type === 'tariff_watch' ? 'watch' : 'download';

    await db.execute({ sql: `DELETE FROM finance_plans WHERE id = ?`, args: [id] });
    
    bot.answerCallbackQuery(queryId, { text: "Tarif o'chirildi!", show_alert: true }).catch(()=>{});
    await showTariffList(chatId, messageId, category);
};

// --- EDIT TARIFF ---
const editTariffMenu = async (chatId, messageId, id) => {
    const res = await db.execute({ sql: `SELECT * FROM finance_plans WHERE id = ?`, args: [id] });
    if (res.rows.length === 0) return;
    const t = res.rows[0];

    const text = `✏️ <b>"${t.name}" tarifini tahrirlash</b>\n\nNimasini tahrirlamoqchisiz?`;
    await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: [
                [{ text: "Nomi", callback_data: `admin_tariff_edit_field_${id}_name` }, { text: "Narxi", callback_data: `admin_tariff_edit_field_${id}_price` }],
                [{ text: "Vaqti", callback_data: `admin_tariff_edit_field_${id}_days` }],
                [{ text: "🔙 Orqaga", callback_data: `admin_tariff_view_${id}` }]
            ]
        }
    }).catch(()=>{});
};

const promptEditTariffField = async (chatId, messageId, id, field) => {
    await updateUser(chatId, { action: `admin_edit_tariff_field|${id}|${field}` });
    
    let promptText = "";
    if (field === 'name') promptText = "Yangi nomini kiriting:";
    if (field === 'price') promptText = "Yangi narxini kiriting (faqat raqam):";
    if (field === 'days') promptText = "Yangi muddatini kiriting (Masalan: <b>1 oy, 15 kun, 3 soat, 10 daqiqa</b>):";

    const text = `✏️ <b>Tarifni tahrirlash</b>\n\n${promptText}`;
    await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: `admin_tariff_view_${id}` }]] }
    }).catch(()=>{});
};

const handleEditTariffField = async (msg, user) => {
    const chatId = msg.chat.id;
    const parts = user.action.split('|');
    const id = parseInt(parts[1]);
    const field = parts[2];
    const val = msg.text;

    let sql = "";
    let arg = null;

    if (field === 'name') {
        sql = `UPDATE finance_plans SET name = ? WHERE id = ?`;
        arg = val;
    } else if (field === 'price') {
        arg = parseInt(val.replace(/[^0-9]/g, ''));
        if (isNaN(arg) || arg < 0) return bot.sendMessage(chatId, "Noto'g'ri narx!");
        sql = `UPDATE finance_plans SET price = ? WHERE id = ?`;
    } else if (field === 'days') {
        let text = val.toLowerCase();
        let num = parseInt(text.replace(/[^0-9]/g, ''));
        if (isNaN(num) || num <= 0) return bot.sendMessage(chatId, "Iltimos, to'g'ri vaqtni kiriting.");
        
        let suffix = 'd';
        if (text.includes('oy') || text.includes('oylik')) { num = num * 30; suffix = 'd'; }
        else if (text.includes('kun')) suffix = 'd';
        else if (text.includes('soat')) suffix = 'h';
        else if (text.includes('minut') || text.includes('daqiqa')) suffix = 'm';
        else suffix = 'd';
        
        arg = num + suffix;
        sql = `UPDATE finance_plans SET duration_days = ? WHERE id = ?`;
    }

    await db.execute({ sql, args: [arg, id] });
    await updateUser(chatId, { action: "" });

    await bot.sendMessage(chatId, `✅ <b>Muvaffaqiyatli o'zgartirildi!</b>`, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: `admin_tariff_view_${id}` }]] }
    });
};

// --- MARGINS (USTAMALAR) ---
const showMarginList = async (chatId, messageId) => {
    const res = await db.execute({ sql: "SELECT * FROM finance_plans WHERE type = 'margin'" });
    const margins = res.rows;

    const inline_keyboard = [];
    for (const m of margins) {
        if (m.name === 'big_payment_bonus' || m.name === 'big_payment_threshold') continue;
        inline_keyboard.push([{ text: "✏️ " + m.duration_days + " (" + m.price + ")", callback_data: "admin_margin_edit_" + m.id }]);
    }
    
    inline_keyboard.push([{ text: "🎁 Yirik to'lov keshbeklari", callback_data: "admin_cashback_tiers" }]);
    inline_keyboard.push([{ text: "🔙 Orqaga", callback_data: "admin_back_finance" }]);

    const text = "<blockquote><b>👨‍💻 Admin Panel / Moliya / Ustamalar</b></blockquote>\n\n⚙️ <b>Ustama va Bonuslar boshqaruvi</b>\n\nQuyidagilardan birini tanlab tahrirlashingiz mumkin:";
    
    if (messageId) {
        await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: "HTML", reply_markup: { inline_keyboard } }).catch(()=>{});
    } else {
        await bot.sendMessage(chatId, text, { parse_mode: "HTML", reply_markup: { inline_keyboard } });
    }
};

const promptEditMargin = async (chatId, messageId, id) => {
    const res = await db.execute({ sql: "SELECT * FROM finance_plans WHERE id = ?", args: [id] });
    if (res.rows.length === 0) return;
    const m = res.rows[0];

    await updateUser(chatId, { action: "admin_edit_margin|" + id });
    const text = "✏️ <b>" + m.duration_days + "</b>ni tahrirlash\n\nHozirgi qiymat: <b>" + m.price + "</b>\n\nYangi qiymatni kiriting (faqat raqam, butun yoki nuqta bilan, masalan 1.5):";
    await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_finance_margins" }]] } }).catch(()=>{});
};

const handleEditMargin = async (msg, user) => {
    const chatId = msg.chat.id;
    const parts = user.action.split('|');
    const id = parseInt(parts[1]);
    const val = parseFloat(msg.text.replace(/[^0-9.]/g, ''));

    if (isNaN(val) || val < 0) return bot.sendMessage(chatId, "Noto'g'ri qiymat!");

    await db.execute({ sql: "UPDATE finance_plans SET price = ? WHERE id = ?", args: [val, id] });
    await updateUser(chatId, { action: "" });

    await bot.sendMessage(chatId, "✅ <b>Muvaffaqiyatli o'zgartirildi!</b>", {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "🔙 Ustamalarga qaytish", callback_data: "admin_finance_margins" }]] }
    });
};

// --- CASHBACK TIERS ---
const showCashbackTiers = async (chatId, messageId) => {
    const res = await db.execute({ sql: "SELECT * FROM finance_plans WHERE type = 'cashback_tier' ORDER BY price ASC" });
    const tiers = res.rows;

    const inline_keyboard = [];
    for (const t of tiers) {
        inline_keyboard.push([{ text: "💰 " + t.price + " so'm -> " + t.duration_days + "%", callback_data: "admin_cashback_del_ask_" + t.id }]);
    }
    
    inline_keyboard.push([{ text: "➕ Yirik to'lov qo'shish", callback_data: "admin_cashback_add" }]);
    inline_keyboard.push([{ text: "🔙 Orqaga", callback_data: "admin_finance_margins" }]);

    const text = "<blockquote><b>👨‍💻 Admin Panel / Moliya / Yirik to'lovlar</b></blockquote>\n\n🎁 <b>Yirik to'lov keshbeklari</b>\n\nRo'yhatdagi keshbeklardan birortasini o'chirish uchun ustiga bosing:";
    
    if (messageId) {
        await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: "HTML", reply_markup: { inline_keyboard } }).catch(()=>{});
    } else {
        await bot.sendMessage(chatId, text, { parse_mode: "HTML", reply_markup: { inline_keyboard } });
    }
};

const promptAddCashbackTierAmount = async (chatId, messageId) => {
    await updateUser(chatId, { action: "admin_add_cashback_amount" });
    const text = "➕ <b>Yirik to'lov qo'shish</b>\n\nQaysi summadan boshlab keshbek berilishini kiriting (faqat raqam, masalan: 100000):";
    await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_cashback_tiers" }]] } }).catch(()=>{});
};

const handleAddCashbackTierAmount = async (msg, user) => {
    const chatId = msg.chat.id;
    const amount = parseInt(msg.text.replace(/[^0-9]/g, ''));
    if (isNaN(amount) || amount <= 0) return bot.sendMessage(chatId, "Noto'g'ri summa!");

    await updateUser(chatId, { action: "admin_add_cashback_percent|" + amount });
    const text = "Summa: <b>" + amount + " so'm</b>\n\nEndi ushbu summa uchun necha foiz (%) keshbek berilishini kiriting (butun yoki nuqta bilan, masalan 12.5):";
    await bot.sendMessage(chatId, text, { parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_cashback_tiers" }]] } });
};

const handleAddCashbackTierPercent = async (msg, user) => {
    const chatId = msg.chat.id;
    const parts = user.action.split('|');
    const amount = parseInt(parts[1]);
    const percent = parseFloat(msg.text.replace(/[^0-9.]/g, ''));

    if (isNaN(percent) || percent < 0) return bot.sendMessage(chatId, "Noto'g'ri foiz!");

    await db.execute({ sql: "INSERT INTO finance_plans (type, name, price, duration_days) VALUES (?, ?, ?, ?)", args: ['cashback_tier', 'Yirik tolov', amount, percent] });
    await updateUser(chatId, { action: "" });

    await bot.sendMessage(chatId, "✅ <b>Muvaffaqiyatli qo'shildi!</b>\n\n" + amount + " so'm uchun " + percent + "% keshbek.", {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "🔙 Ro'yxatga qaytish", callback_data: "admin_cashback_tiers" }]] }
    });
};

const askDeleteCashbackTier = async (chatId, messageId, id) => {
    const res = await db.execute({ sql: "SELECT * FROM finance_plans WHERE id = ?", args: [id] });
    if (res.rows.length === 0) return;
    const t = res.rows[0];

    const text = "⚠️ <b>Haqiqatdan ham \"" + t.price + " so'm -> " + t.duration_days + "%\" keshbekni o'chirmoqchimisiz?</b>";
    await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: [
                [{ text: "✅ Ha, o'chirish", callback_data: "admin_cashback_del_confirm_" + t.id }],
                [{ text: "🔙 Orqaga", callback_data: "admin_cashback_tiers" }]
            ]
        }
    }).catch(()=>{});
};

const confirmDeleteCashbackTier = async (chatId, messageId, queryId, id) => {
    await db.execute({ sql: "DELETE FROM finance_plans WHERE id = ?", args: [id] });
    bot.answerCallbackQuery(queryId, { text: "O'chirildi!", show_alert: true }).catch(()=>{});
    await showCashbackTiers(chatId, messageId);
};

// --- AUTO PROMO SETTINGS ---
const showAutoPromoSettings = async (chatId, messageId) => {
    const inline_keyboard = [
        [{ text: "👥 Kishilar soni", callback_data: "admin_promo_cat_count" },
         { text: "💵 Summa", callback_data: "admin_promo_cat_amount" }],
        [{ text: "📅 Kunlik promo soni", callback_data: "admin_promo_cat_daily" },
         { text: "⌚️ Yuborish vaqti", callback_data: "admin_promo_cat_time" }],
        [{ text: "🚀 Bitta promo tashlab ko'rish (Test)", callback_data: "admin_promo_force_test" }],
        [{ text: "🔙 Orqaga", callback_data: "admin_back_finance" }]
    ];

    const text = `<blockquote><b>👨‍💻 Admin Panel / Moliya / Avto-Promo</b></blockquote>\n\n📣 <b>Avtomatik Promokodlar boshqaruvi</b>\n\nPromo kanalga yuboriladigan avto promokodlarning oraliq qiymatlarini belgilashingiz mumkin:`;
    
    if (messageId) {
        await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: "HTML", reply_markup: { inline_keyboard } }).catch(()=>{});
    } else {
        await bot.sendMessage(chatId, text, { parse_mode: "HTML", reply_markup: { inline_keyboard } });
    }
};

const showAutoPromoCategory = async (chatId, messageId, category) => {
    let title = "";
    let baseName = "";
    if (category === "count") { title = "Kishilar soni"; baseName = "auto_promo_count_"; }
    else if (category === "amount") { title = "Summa"; baseName = "auto_promo_amount_"; }
    else if (category === "daily") { title = "Kunlik promo soni"; baseName = "auto_promo_daily_"; }
    else if (category === "time") { title = "Yuborish vaqti"; baseName = "auto_promo_time_"; }

    let extraText = "";
    let inline_keyboard = [];
    if (category === "time") {
        const resStartHour = await db.execute({ sql: "SELECT price FROM finance_plans WHERE type = 'auto_promo_setting' AND name = 'auto_promo_start_hour'" });
        const resStartMin = await db.execute({ sql: "SELECT price FROM finance_plans WHERE type = 'auto_promo_setting' AND name = 'auto_promo_start_minute'" });
        const resEndHour = await db.execute({ sql: "SELECT price FROM finance_plans WHERE type = 'auto_promo_setting' AND name = 'auto_promo_end_hour'" });
        const resEndMin = await db.execute({ sql: "SELECT price FROM finance_plans WHERE type = 'auto_promo_setting' AND name = 'auto_promo_end_minute'" });
        
        const pad = (n) => n.toString().padStart(2, '0');
        const sh = pad(resStartHour.rows[0].price);
        const sm = pad(resStartMin.rows[0].price);
        const eh = pad(resEndHour.rows[0].price);
        const em = pad(resEndMin.rows[0].price);
        
        extraText = `\n\n📌 <b>Hozirgi vaqt oralig'i:</b>\n🟢 Boshlanish: <b>${sh}:${sm}</b>\n🔴 Tugashi: <b>${eh}:${em}</b>`;
        
        inline_keyboard = [
            [
                { text: `🕒 Soat`, callback_data: `admin_promo_cat_time_hour` },
                { text: `⏱ Daqiqa`, callback_data: `admin_promo_cat_time_minute` }
            ],
            [{ text: "🔙 Orqaga", callback_data: "admin_finance_promo" }]
        ];
    } else if (category === "time_hour") {
        const resStartHour = await db.execute({ sql: "SELECT * FROM finance_plans WHERE type = 'auto_promo_setting' AND name = ?", args: ['auto_promo_start_hour'] });
        const resEndHour = await db.execute({ sql: "SELECT * FROM finance_plans WHERE type = 'auto_promo_setting' AND name = ?", args: ['auto_promo_end_hour'] });
        const sh = resStartHour.rows[0];
        const eh = resEndHour.rows[0];
        inline_keyboard = [
            [
                { text: `🔵 Boshlanish: ${sh.price}`, callback_data: `admin_promo_edit_${sh.name}` },
                { text: `🔴 Tugashi: ${eh.price}`, callback_data: `admin_promo_edit_${eh.name}` }
            ],
            [{ text: "🔙 Orqaga", callback_data: "admin_promo_cat_time" }]
        ];
        title = "Yuborish vaqti / Soat";
    } else if (category === "time_minute") {
        const resStartMin = await db.execute({ sql: "SELECT * FROM finance_plans WHERE type = 'auto_promo_setting' AND name = ?", args: ['auto_promo_start_minute'] });
        const resEndMin = await db.execute({ sql: "SELECT * FROM finance_plans WHERE type = 'auto_promo_setting' AND name = ?", args: ['auto_promo_end_minute'] });
        const sm = resStartMin.rows[0];
        const em = resEndMin.rows[0];
        inline_keyboard = [
            [
                { text: `🔵 Boshlanish: ${sm.price}`, callback_data: `admin_promo_edit_${sm.name}` },
                { text: `🔴 Tugashi: ${em.price}`, callback_data: `admin_promo_edit_${em.name}` }
            ],
            [{ text: "🔙 Orqaga", callback_data: "admin_promo_cat_time" }]
        ];
        title = "Yuborish vaqti / Daqiqa";
    } else {
        const resMin = await db.execute({ sql: "SELECT * FROM finance_plans WHERE type = 'auto_promo_setting' AND name = ?", args: [baseName + 'min'] });
        const resMax = await db.execute({ sql: "SELECT * FROM finance_plans WHERE type = 'auto_promo_setting' AND name = ?", args: [baseName + 'max'] });

        const minSetting = resMin.rows[0];
        const maxSetting = resMax.rows[0];

        inline_keyboard = [
            [{ text: `📉 Min: ${minSetting.price}`, callback_data: `admin_promo_edit_${minSetting.name}` },
             { text: `📈 Max: ${maxSetting.price}`, callback_data: `admin_promo_edit_${maxSetting.name}` }],
            [{ text: "🔙 Orqaga", callback_data: "admin_finance_promo" }]
        ];
    }
    
    const text = `<blockquote><b>👨‍💻 Admin Panel / Moliya / Avto-Promo / ${title}</b></blockquote>\n\n📣 <b>${title} oraliqlarini sozlash</b>\n\nQuyidagilardan birini tanlab tahrirlashingiz mumkin:${extraText}`;
    
    await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: "HTML", reply_markup: { inline_keyboard } }).catch(()=>{});
};

const promptEditPromoSetting = async (chatId, messageId, fieldName) => {
    const res = await db.execute({ sql: "SELECT * FROM finance_plans WHERE type = 'auto_promo_setting' AND name = ?", args: [fieldName] });
    if (res.rows.length === 0) return;
    const s = res.rows[0];

    let category = fieldName.split('_')[2]; // count, amount or daily
    if (category === 'start' || category === 'end') {
        const timeType = fieldName.split('_')[3]; // hour or minute
        category = `time_${timeType}`;
    }

    await updateUser(chatId, { action: `admin_edit_promo|${fieldName}` });
    const text = `✏️ <b>${s.duration_days}</b>ni tahrirlash\n\nHozirgi qiymat: <b>${s.price}</b>\n\nYangi qiymatni kiriting (faqat butun raqam):`;
    await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: `admin_promo_cat_${category}` }]] } }).catch(()=>{});
};

const handleEditPromoSetting = async (msg, user) => {
    const chatId = msg.chat.id;
    const parts = user.action.split('|');
    const fieldName = parts[1];
    let category = fieldName.split('_')[2];
    if (category === 'start' || category === 'end') {
        const timeType = fieldName.split('_')[3]; // hour or minute
        category = `time_${timeType}`;
    }
    const val = parseInt(msg.text.replace(/[^0-9]/g, ''));

    if (isNaN(val) || val < 0) return bot.sendMessage(chatId, "Noto'g'ri qiymat!");

    if (category.startsWith("time")) {
        if (fieldName.includes('hour') && val > 23) return bot.sendMessage(chatId, "Soat 0 dan 23 gacha bo'lishi kerak!");
        if (fieldName.includes('minute') && val > 59) return bot.sendMessage(chatId, "Daqiqa 0 dan 59 gacha bo'lishi kerak!");

        const resStartHour = await db.execute({ sql: "SELECT price FROM finance_plans WHERE type = 'auto_promo_setting' AND name = 'auto_promo_start_hour'" });
        const resStartMin = await db.execute({ sql: "SELECT price FROM finance_plans WHERE type = 'auto_promo_setting' AND name = 'auto_promo_start_minute'" });
        const resEndHour = await db.execute({ sql: "SELECT price FROM finance_plans WHERE type = 'auto_promo_setting' AND name = 'auto_promo_end_hour'" });
        const resEndMin = await db.execute({ sql: "SELECT price FROM finance_plans WHERE type = 'auto_promo_setting' AND name = 'auto_promo_end_minute'" });
        
        let sh = parseInt(resStartHour.rows[0].price);
        let sm = parseInt(resStartMin.rows[0].price);
        let eh = parseInt(resEndHour.rows[0].price);
        let em = parseInt(resEndMin.rows[0].price);
        
        if (fieldName === 'auto_promo_start_hour') sh = val;
        if (fieldName === 'auto_promo_start_minute') sm = val;
        if (fieldName === 'auto_promo_end_hour') eh = val;
        if (fieldName === 'auto_promo_end_minute') em = val;
        
        if ((sh * 60 + sm) > (eh * 60 + em)) {
            return bot.sendMessage(chatId, "⚠️ <b>Xatolik:</b> Boshlanish vaqti tugash vaqtidan kichik yoki teng bo'lishi kerak!\n\nIltimos, qaytadan kiriting:", { parse_mode: "HTML" });
        }
    }

    await db.execute({ sql: "UPDATE finance_plans SET price = ? WHERE type = 'auto_promo_setting' AND name = ?", args: [val, fieldName] });
    await updateUser(chatId, { action: "" });
    
    // Reload schedule if time was updated
    if (category.startsWith("time")) {
        const { reloadAutoPromoSchedule } = require('../automatic/channels/promo');
        reloadAutoPromoSchedule().catch(console.error);
    }

    await bot.sendMessage(chatId, `✅ <b>Muvaffaqiyatli o'zgartirildi!</b>`, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "🔙 Sozlamalarga qaytish", callback_data: `admin_promo_cat_${category}` }]] }
    });
};

module.exports = {
    showTariffList,
    startAddTariff,
    handleAddTariffName,
    handleAddTariffPrice,
    handleAddTariffDays,
    viewTariff,
    askDeleteTariff,
    confirmDeleteTariff,
    editTariffMenu,
    promptEditTariffField,
    handleEditTariffField,
    getTariffEmoji,
    showMarginList,
    promptEditMargin,
    handleEditMargin,
    showCashbackTiers,
    promptAddCashbackTierAmount,
    handleAddCashbackTierAmount,
    handleAddCashbackTierPercent,
    askDeleteCashbackTier,
    confirmDeleteCashbackTier,
    showAutoPromoSettings,
    showAutoPromoCategory,
    promptEditPromoSetting,
    handleEditPromoSetting
};
