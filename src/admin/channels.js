const bot = require('../bot');
const db = require('../../base/db');
const { updateUser } = require('../../base/models/user.model');

const checkBotAdmin = async (chat_id) => {
    try {
        const botInfo = await bot.getMe();
        const member = await bot.getChatMember(chat_id, botInfo.id);
        if (member.status === 'administrator' || member.status === 'creator') {
            return true;
        }
        return false;
    } catch (e) {
        return false;
    }
};

const checkAdminAndProceed = async (chatId, chat_id, name, link, editing_id) => {
    const isAdmin = await checkBotAdmin(chat_id);
    if (isAdmin) {
        await askChannelOwner(chatId, chat_id, name, link, editing_id);
    } else {
        await updateUser(chatId, { action: "admin_channel_wait_admin", temp_data: JSON.stringify({ chat_id, name, link, editing_id }) });
        await bot.sendMessage(chatId, `⚠️ Bot hali <b>${name}</b> kanalida admin emas!\n\nIltimos, avval botni kanalga admin qiling va so'ngra pastdagi tugmani bosing:`, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[{ text: "🔄 Tekshirish", callback_data: "admin_channel_checkadmin" }]]
            }
        });
    }
};

// Helper to get all channels
const getAllChannelsAdmin = async () => {
    try {
        const result = await db.execute(`SELECT * FROM channels`);
        return result.rows;
    } catch (error) {
        return [];
    }
};

const handleAdminChannelsMenu = async (msg, editMessageId = null) => {
    const chatId = msg.chat.id;
    const channels = await getAllChannelsAdmin();
    
    let text = `<blockquote>🎛 <b>Admin panel</b> / 📢 <b>Kanallar</b></blockquote>\n\nQuyidagi kanallar botga ulangan. O'zgartirish yoki o'chirish uchun kanalni tanlang:\n`;
    
    const inline_keyboard = [];
    
    channels.forEach(ch => {
        inline_keyboard.push([{ text: `📢 ${ch.name}`, callback_data: `admin_channel_view_${ch.id}` }]);
    });
    
    inline_keyboard.push([{ text: "➕ Qo'shish", callback_data: "admin_channel_add" }]);
    inline_keyboard.push([{ text: "❌ Yopish", callback_data: "admin_back" }]);
    
    const opts = {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard }
    };

    if (editMessageId) {
        opts.chat_id = chatId;
        opts.message_id = editMessageId;
        await bot.editMessageText(text, opts).catch(()=>{});
    } else {
        await bot.sendMessage(chatId, text, opts);
    }
};

const handleAdminChannelsCallback = async (query, user) => {
    const data = query.data;
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    
    if (data === "admin_channel_add") {
        await updateUser(chatId, { action: "admin_channel_wait_link", temp_data: null });
        await bot.editMessageText(`<blockquote>🎛 <b>Admin panel</b> / 📢 <b>Kanallar</b> / ➕ <b>Kanal qo'shish</b></blockquote>\n\nIltimos, kanalning linkini (yoki username @kanal) yuboring.\n\n⚠️ <i>Agar yopiq kanal bo'lsa, avval botni kanalga admin qiling va keyin linkini yuboring. Osonroq bo'lishi uchun kanalning birorta xabarini forward (uzatish) qilsangiz avtomatik ulanadi.</i>`, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_channels_back" }]]
            }
        });
        return true;
    }
    
    if (data === "admin_channels_back") {
        await updateUser(chatId, { action: "", temp_data: null });
        await handleAdminChannelsMenu(query.message, messageId);
        return true;
    }
    
    if (data.startsWith("admin_channel_view_")) {
        const id = data.split('_')[3];
        const channels = await getAllChannelsAdmin();
        const ch = channels.find(c => c.id == id);
        
        if (!ch) {
            bot.answerCallbackQuery(query.id, { text: "Kanal topilmadi!" }).catch(()=>{});
            return true;
        }
        
        let conditionText = "Cheksiz";
        if (ch.condition_type === "time") {
            const added = ch.added_at || Date.now();
            const left = Math.max(0, ch.condition_value - (Date.now() - added));
            const hours = Math.floor(left / (1000 * 60 * 60));
            conditionText = `${hours} soat qoldi (Belgilangan: ${ch.condition_value / (1000*60*60)} soat)`;
        } else if (ch.condition_type === "members") {
            conditionText = `Odam soni ${ch.condition_value} ta bo'lguncha`;
        }
        
        let text = `<blockquote>🎛 <b>Admin panel</b> / 📢 <b>Kanallar</b> / <b>Kanal ma'lumotlari</b></blockquote>\n\n`;
        text += `<b>Nomi:</b> ${ch.name}\n`;
        text += `<b>Link:</b> ${ch.link}\n`;
        text += `<b>Chat ID:</b> ${ch.chat_id}\n`;
        text += `<b>Shart:</b> ${conditionText}\n`;
        
        await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🗑 O'chirish", callback_data: `admin_channel_del_${ch.id}` }],
                    [{ text: "🔙 Orqaga", callback_data: "admin_channels_back" }]
                ]
            }
        });
        return true;
    }
    
    if (data.startsWith("admin_channel_del_")) {
        const id = data.split('_')[3];
        const res = await db.execute({ sql: `SELECT * FROM channels WHERE id = ?`, args: [id] });
        if (res.rows.length > 0) {
            const ch = res.rows[0];
            if (ch.owner_id) {
                bot.sendMessage(ch.owner_id, `⚠️ Sizning <b>${ch.name}</b> kanalingiz admin tomonidan botimiz majburiy a'zoligidan olib tashlandi!`, { parse_mode: "HTML" }).catch(()=>{});
            }
        }
        await db.execute({ sql: `DELETE FROM channels WHERE id = ?`, args: [id] });
        bot.answerCallbackQuery(query.id, { text: "Kanal o'chirildi!", show_alert: true }).catch(()=>{});
        await handleAdminChannelsMenu(query.message, messageId);
        return true;
    }
    if (data === "admin_channel_checkadmin") {
        let tData = user.temp_data;
        if (typeof tData === 'string') {
            try { tData = JSON.parse(tData); } catch(e){}
        }
        
        if (tData && tData.chat_id) {
            const isAdmin = await checkBotAdmin(tData.chat_id);
            if (isAdmin) {
                bot.deleteMessage(chatId, messageId).catch(()=>{});
                await askChannelOwner(chatId, tData.chat_id, tData.name, tData.link, tData.editing_id);
            } else {
                bot.answerCallbackQuery(query.id, { text: "⚠️ Bot hali ham kanalga admin qilinmagan!", show_alert: true }).catch(()=>{});
            }
        }
        return true;
    }

    if (data.startsWith("admin_channel_cond_")) {
        const condType = data.split('_')[3];
        if (!user.temp_data) return true;
        let tData = user.temp_data;
        if (typeof tData === 'string') {
            try { tData = JSON.parse(tData); } catch(e){}
        }
        
        if (condType === "forever") {
            if (tData.editing_id) {
                await db.execute({ sql: `UPDATE channels SET chat_id = ?, name = ?, link = ?, condition_type = NULL, condition_value = NULL WHERE id = ?`, args: [tData.chat_id, tData.name, tData.link, tData.editing_id] });
            } else {
                await insertChannel(tData.chat_id, tData.name, tData.link, null, null, tData.owner_id);
                if (tData.owner_id) {
                    bot.sendMessage(tData.owner_id, `🎉 Sizning <b>${tData.name}</b> kanalingiz (Cheksiz shart bilan) botimiz majburiy a'zoligiga qo'shildi!`, { parse_mode: "HTML" }).catch(()=>{});
                }
            }
            await updateUser(chatId, { action: "", temp_data: null });
            await bot.editMessageText(tData.editing_id ? "✅ Kanal shartlari muvaffaqiyatli tahrirlandi!" : "✅ Kanal muvaffaqiyatli qo'shildi!", { chat_id: chatId, message_id: messageId });
            handleAdminChannelsMenu(query.message);
        } else if (condType === "time") {
            await updateUser(chatId, { action: "admin_channel_wait_cond_time" });
            await bot.editMessageText(`<blockquote>🎛 <b>Admin panel</b> / 📢 <b>Kanallar</b> / <b>Vaqt belgilash</b></blockquote>\n\nNecha soat turishini yozing (masalan: 24):`, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML' });
        } else if (condType === "members") {
            await updateUser(chatId, { action: "admin_channel_wait_cond_members" });
            await bot.editMessageText(`<blockquote>🎛 <b>Admin panel</b> / 📢 <b>Kanallar</b> / <b>Odam sonini belgilash</b></blockquote>\n\nQancha a'zoga yetguncha turishini yozing (masalan: 10000):`, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML' });
        }
        return true;
    }

    return false;
};

const insertChannel = async (chat_id, name, link, c_type, c_value, owner_id) => {
    try {
        await db.execute({
            sql: `INSERT INTO channels (chat_id, name, link, condition_type, condition_value, added_at, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            args: [chat_id, name, link, c_type, c_value, Date.now(), owner_id]
        });
        return true;
    } catch(e) {
        return false;
    }
};

const handleAdminChannelsMessage = async (msg, user) => {
    const chatId = msg.chat.id;
    const text = msg.text || msg.caption || "";
    
    if (user.action === "admin_channel_wait_link") {
        let chat_id = "";
        let name = "";
        let link = "";
        
        let editing_id = null;
        if (user.temp_data) {
            try {
                let t = JSON.parse(user.temp_data);
                editing_id = t.editing_id || null;
            } catch(e){}
        }
        
        if (msg.forward_from_chat) {
            chat_id = msg.forward_from_chat.id.toString();
            name = msg.forward_from_chat.title;
            link = msg.forward_from_chat.username ? `https://t.me/${msg.forward_from_chat.username}` : `(Yopiq kanal)`;
            
            await checkAdminAndProceed(chatId, chat_id, name, link, editing_id);
            return true;
        }
        
        if (text.includes('joinchat') || text.includes('+') || text.includes('t.me/c/')) {
            link = text.trim();
            await updateUser(chatId, { action: "admin_channel_wait_name", temp_data: JSON.stringify({ link, editing_id }) });
            await bot.sendMessage(chatId, `Siz yopiq kanal linkini yubordingiz.\nIltimos, endi <b>kanalning nomini</b> yozib yuboring:`, { parse_mode: 'HTML' });
            return true;
        } else {
            let potentialUsername = "";
            const match = text.match(/(?:https?:\/\/t\.me\/|@)([a-zA-Z0-9_]+)/);
            if (match && match[1].toLowerCase() !== 'c') {
                potentialUsername = match[1];
            } else {
                potentialUsername = text.replace(/[^a-zA-Z0-9_]/g, '');
            }

            if (potentialUsername && potentialUsername.length >= 4) {
                const username = "@" + potentialUsername;
                try {
                    const chatInfo = await bot.getChat(username);
                    chat_id = chatInfo.id.toString();
                    name = chatInfo.title;
                    link = `https://t.me/${potentialUsername}`;
                    await checkAdminAndProceed(chatId, chat_id, name, link, editing_id);
                } catch (e) {
                    await bot.sendMessage(chatId, `⚠️ Kanal topilmadi yoki bot u kanalga admin emas.\nUsername: ${username}\nBotni kanalga admin qilib qayta urinib ko'ring.`);
                }
            } else {
                await bot.sendMessage(chatId, `⚠️ Link formati noto'g'ri yoki username topilmadi.`);
            }
            return true;
        }
    }
    
    if (user.action === "admin_channel_wait_name") {
        let tData = user.temp_data;
        if (typeof tData === 'string') {
            try { tData = JSON.parse(tData); } catch(e){}
        }
        await updateUser(chatId, { action: "admin_channel_wait_chat_id", temp_data: JSON.stringify({ link: tData.link, name: text, editing_id: tData.editing_id }) });
        await bot.sendMessage(chatId, `Yopiq kanallarni bot tekshirishi uchun uning ID si kerak (Masalan: -1001234567890).\nKanalning ID sini yuboring yoki kanaldan birorta xabarni shu yerga forward (uzatish) qiling:`);
        return true;
    }
    
    if (user.action === "admin_channel_wait_chat_id") {
        let tData = user.temp_data;
        if (typeof tData === 'string') {
            try { tData = JSON.parse(tData); } catch(e){}
        }
        
        let chat_id = "";
        if (msg.forward_from_chat) {
            chat_id = msg.forward_from_chat.id.toString();
        } else {
            chat_id = text.trim();
        }
        
        await checkAdminAndProceed(chatId, chat_id, tData.name, tData.link, tData.editing_id);
        return true;
    }
    
    if (user.action === "admin_channel_wait_owner") {
        let tData = user.temp_data;
        if (typeof tData === 'string') {
            try { tData = JSON.parse(tData); } catch(e){}
        }
        
        let owner_id = text.trim();
        if (owner_id === '0' || owner_id.toLowerCase() === 'yoq' || owner_id.toLowerCase() === "yo'q") {
            owner_id = null;
        }

        await prepareConditionSelect(chatId, tData.chat_id, tData.name, tData.link, owner_id, tData.editing_id);
        return true;
    }
    
    if (user.action === "admin_channel_wait_cond_time") {
        const hours = parseInt(text);
        if (isNaN(hours) || hours <= 0) {
            await bot.sendMessage(chatId, "Iltimos, faqat raqam bilan soatni kiriting!");
            return true;
        }
        
        let tData = user.temp_data;
        if (typeof tData === 'string') {
            try { tData = JSON.parse(tData); } catch(e){}
        }
        
        const val = hours * 60 * 60 * 1000; // in ms
        if (tData.editing_id) {
            await db.execute({ sql: `UPDATE channels SET chat_id = ?, name = ?, link = ?, condition_type = 'time', condition_value = ?, added_at = ? WHERE id = ?`, args: [tData.chat_id, tData.name, tData.link, val, Date.now(), tData.editing_id] });
        } else {
            await insertChannel(tData.chat_id, tData.name, tData.link, "time", val, tData.owner_id);
            if (tData.owner_id) {
                bot.sendMessage(tData.owner_id, `🎉 Sizning <b>${tData.name}</b> kanalingiz (Vaqt: ${hours} soat gacha) botimiz majburiy a'zoligiga qo'shildi!`, { parse_mode: "HTML" }).catch(()=>{});
            }
        }
        await updateUser(chatId, { action: "", temp_data: null });
        await bot.sendMessage(chatId, tData.editing_id ? "✅ Kanal shartlari (Vaqt) tahrirlandi!" : "✅ Kanal (Vaqt sharti bilan) qo'shildi!");
        handleAdminChannelsMenu(msg);
        return true;
    }
    
    if (user.action === "admin_channel_wait_cond_members") {
        const members = parseInt(text);
        if (isNaN(members) || members <= 0) {
            await bot.sendMessage(chatId, "Iltimos, faqat raqam bilan odam sonini kiriting!");
            return true;
        }
        
        let tData = user.temp_data;
        if (typeof tData === 'string') {
            try { tData = JSON.parse(tData); } catch(e){}
        }
        
        if (tData.editing_id) {
            await db.execute({ sql: `UPDATE channels SET chat_id = ?, name = ?, link = ?, condition_type = 'members', condition_value = ? WHERE id = ?`, args: [tData.chat_id, tData.name, tData.link, members, tData.editing_id] });
        } else {
            await insertChannel(tData.chat_id, tData.name, tData.link, "members", members, tData.owner_id);
            if (tData.owner_id) {
                bot.sendMessage(tData.owner_id, `🎉 Sizning <b>${tData.name}</b> kanalingiz (Odam soni: ${members} ta gacha) botimiz majburiy a'zoligiga qo'shildi!`, { parse_mode: "HTML" }).catch(()=>{});
            }
        }
        await updateUser(chatId, { action: "", temp_data: null });
        await bot.sendMessage(chatId, tData.editing_id ? "✅ Kanal shartlari (Odam soni) tahrirlandi!" : "✅ Kanal (Odam soni sharti bilan) qo'shildi!");
        handleAdminChannelsMenu(msg);
        return true;
    }

    return false;
};

const askChannelOwner = async (chatId, chat_id, name, link, editing_id) => {
    await updateUser(chatId, { action: "admin_channel_wait_owner", temp_data: JSON.stringify({ chat_id, name, link, editing_id }) });
    
    await bot.sendMessage(chatId, `<blockquote>🎛 <b>Admin panel</b> / 📢 <b>Kanallar</b> / <b>Kanal egasi</b></blockquote>\n\nKanal egasining Telegram ID sini yuboring (Masalan: 123456789). Agar kanalga qo'shilganda va olib tashlanganda unga xabar yuborilishini istamasangiz <b>0</b> deb yozing:`, {
        parse_mode: 'HTML'
    });
};

const prepareConditionSelect = async (chatId, chat_id, name, link, owner_id = null, editing_id = null, editMessageId = null) => {
    await updateUser(chatId, { action: "admin_channel_cond", temp_data: JSON.stringify({ chat_id, name, link, owner_id, editing_id }) });
    
    const text = `<blockquote>🎛 <b>Admin panel</b> / 📢 <b>Kanallar</b> / <b>Shart tanlash</b></blockquote>\n\n<b>Kanal:</b> ${name}\n\nQanday shart bilan qo'shilsin?`;
    const opts = {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: "♾ Cheksiz", callback_data: "admin_channel_cond_forever" }],
                [{ text: "⏳ Vaqtga qarab", callback_data: "admin_channel_cond_time" }],
                [{ text: "👥 Odam soniga qarab", callback_data: "admin_channel_cond_members" }]
            ]
        }
    };

    if (editMessageId) {
        opts.chat_id = chatId;
        opts.message_id = editMessageId;
        await bot.editMessageText(text, opts).catch(()=>{});
    } else {
        await bot.sendMessage(chatId, text, opts);
    }
};

module.exports = {
    handleAdminChannelsMenu,
    handleAdminChannelsCallback,
    handleAdminChannelsMessage
};
