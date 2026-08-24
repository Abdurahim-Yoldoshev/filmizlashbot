const bot = require('../../bot');
const { updateMovieChannelInfo } = require('../../../base/models/movies.model');
const { updateSeriesChannelInfo } = require('../../../base/models/series.model');

/**
 * Kanalga yuborilgan xabardan file_id va turini bazaga saqlaymiz
 */
const saveChannelFileInfo = async (sentMsg, code, itemType) => {
    try {
        let channel_file_id = null;
        let channel_file_type = null;

        if (sentMsg.video) {
            channel_file_id = sentMsg.video.file_id;
            channel_file_type = 'video';
        } else if (sentMsg.photo && sentMsg.photo.length > 0) {
            channel_file_id = sentMsg.photo[sentMsg.photo.length - 1].file_id;
            channel_file_type = 'photo';
        } else if (sentMsg.document) {
            channel_file_id = sentMsg.document.file_id;
            channel_file_type = 'document';
        }

        if (!channel_file_id) return;

        if (itemType === 'movie' || itemType === 'episode') {
            await updateMovieChannelInfo(code, channel_file_id, channel_file_type);
        } else if (itemType === 'series') {
            await updateSeriesChannelInfo(code, channel_file_id, channel_file_type);
        }

        console.log(`[Trailer] Kanal file_id saqlandi: ${itemType} ${code} => ${channel_file_type}`);
    } catch (e) {
        console.error('[Trailer] saveChannelFileInfo xato:', e.message);
    }
};

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
        fileId = item.series.trailer_file_id || item.file_id;
    }
    
    const inline_keyboard = [
        [{ text: "▶️ Tomosha qilish", url: `https://t.me/${botUsername}?start=${item.code}` }]
    ];

    if (text.length > 1024) {
        text = text.substring(0, 1000) + '...';
    }

    const code = type === 'episode' ? item.code : item.code;

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
            const sentMsg = await bot.sendPhoto(channelId, fileId, {
                caption: text,
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard }
            });
            await saveChannelFileInfo(sentMsg, code, type);
        } catch (e) {}
        return;
    }

    // Avval video sifatida yuborishga harakat qilamiz
    try {
        const sentMsg = await bot.sendVideo(channelId, fileId, {
            caption: text,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard }
        });
        await saveChannelFileInfo(sentMsg, code, type);
    } catch (err) {
        // Agar video bo'lmasa, rasm sifatida yuboramiz
        try {
            const sentMsg = await bot.sendPhoto(channelId, fileId, {
                caption: text,
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard }
            });
            await saveChannelFileInfo(sentMsg, code, type);
        } catch (e) {
            console.error("Failed to post to channel:", e);
        }
    }
};

module.exports = { postToChannel };
