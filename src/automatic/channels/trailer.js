const bot = require('../../bot');

const postToChannel = async (item, type, botUsername) => {
    const channelId = process.env.TRAILER_CHANNEL_ID;
    let text = '';
    let fileId = '';
    
    if (type === 'movie') {
        text = `🔥 <b>YANGI KINO!</b> 🔥\n\n🎬 <b>Kodi:</b> ${item.code}\n\n${item.caption}\n\n🎬 Tomosha qilish uchun quyidagi tugmani bosing 👇`;
        fileId = item.trailer_file_id || item.file_id;
    } else if (type === 'series') {
        text = `🔥 <b>YANGI SERIAL!</b> 🔥\n\n📺 <b>Kodi:</b> ${item.code}\n\n${item.caption}\n\n📺 Tomosha qilish uchun quyidagi tugmani bosing 👇`;
        fileId = item.trailer_file_id;
    } else if (type === 'episode') {
        text = `🔥 <b>YANGI QISM QO'SHILDI!</b> 🔥\n\n📺 <b>Kodi:</b> ${item.code}\n\n${item.series.caption || ''}\n\n🎬 <b>Qism: ${item.epNum}</b>\n\n📺 Tomosha qilish uchun quyidagi tugmani bosing 👇`;
        fileId = item.series.trailer_file_id || item.file_id; // Post series trailer if available
    }
    
    const inline_keyboard = [
        [{ text: "▶️ Tomosha qilish", url: `https://t.me/${botUsername}?start=${item.code}` }]
    ];

    if (text.length > 1024) {
        text = text.substring(0, 1000) + '...'; // limit caption length
    }

    if (!fileId || fileId.trim() === '') {
        try {
            await bot.sendMessage(channelId, text, {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard }
            });
        } catch (e) {}
        return;
    }

    const isUrlPhoto = fileId && fileId.toString().startsWith('http');

    if (isUrlPhoto) {
        try {
            await bot.sendPhoto(channelId, fileId, {
                caption: text,
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard }
            });
        } catch (e) {}
        return;
    }

    try {
        await bot.sendVideo(channelId, fileId, {
            caption: text,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard }
        });
    } catch (err) {
        // Fallback to photo if it's a photo
        try {
            await bot.sendPhoto(channelId, fileId, {
                caption: text,
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard }
            });
        } catch (e) {
            console.error("Failed to post to channel:", e);
        }
    }
};

module.exports = { postToChannel };
