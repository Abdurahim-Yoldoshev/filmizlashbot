const bot = require("../bot");
const { updateUser } = require("../../base/models/user.model");
const { getMovie } = require("../../base/models/movies.model");
const { getAllChannels } = require("../../base/models/channel.model");

const askSearchQuery = async (msg) => {
    const chatId = msg.chat.id;
    await updateUser(chatId, { action: "search" });
    await bot.sendMessage(
        chatId,
        "<blockquote><b>🔍 Qidiruv</b></blockquote>\n\n🔍 Izlayotgan kino/serialingizning <b>kodini</b> yoki <b>nomini</b> yuboring:",
        { parse_mode: "HTML" }
    );
};

// Check if user has joined main channels
const checkMainChannels = async (chatId) => {
    try {
        const trailerId = process.env.TRAILER_CHANNEL_ID;
        const promoId = process.env.PROMO_CHANNEL_ID;
        
        if (trailerId) {
            const member1 = await bot.getChatMember(trailerId, chatId).catch(() => ({ status: 'left' }));
            if (['left', 'kicked'].includes(member1.status)) return false;
        }
        
        if (promoId) {
            const member2 = await bot.getChatMember(promoId, chatId).catch(() => ({ status: 'left' }));
            if (['left', 'kicked'].includes(member2.status)) return false;
        }
        return true;
    } catch(e) {
        return false;
    }
};

// Check if user has joined all channels
const getUnsubscribedChannels = async (chatId) => {
    const channels = await getAllChannels();
    let notJoined = [];
    for (const channel of channels) {
        try {
            const member = await bot.getChatMember(channel.chat_id, chatId);
            if (['left', 'kicked'].includes(member.status)) {
                notJoined.push(channel);
            }
        } catch (e) {
            // If error, assume not joined
            notJoined.push(channel);
        }
    }
    return notJoined;
};

const handleSearch = async (msg, user) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    const isCode = /^\d+$/.test(text);

    if (!isCode) {
        // Kino nomi bo'yicha izlash
        const { searchMoviesByName } = require('../../base/models/movies.model');
        const { searchSeriesByName } = require('../../base/models/series.model');
        
        const movies = await searchMoviesByName(text);
        const series = await searchSeriesByName(text);
        
        if (movies.length === 0 && series.length === 0) {
            await bot.sendMessage(chatId, "😔 Kechirasiz, bunday nomli kino yoki serial topilmadi.");
            return;
        }

        let resultText = `🔍 <b>"${text}"</b> so'rovi bo'yicha natijalar:\n\n`;
        
        if (movies.length > 0) {
            resultText += `<b>Kinolar:</b>\n`;
            movies.forEach(m => {
                const titleMatch = m.caption ? m.caption.match(/Kino nomi:\s*(.+)/) : null;
                const title = m.title || (titleMatch ? titleMatch[1] : 'Noma\'lum');
                resultText += `🎬 ${title} — <b>Kod: ${m.code}</b>\n`;
            });
            resultText += `\n`;
        }

        if (series.length > 0) {
            resultText += `<b>Seriallar:</b>\n`;
            series.forEach(s => {
                const titleMatch = s.caption ? s.caption.match(/Serial nomi:\s*(.+)/) : null;
                const title = s.title || (titleMatch ? titleMatch[1] : 'Noma\'lum');
                resultText += `📺 ${title} — <b>Kod: ${s.code}</b>\n`;
            });
        }

        resultText += `\n<i>Yuqoridagi kodlardan birini yuboring.</i>`;
        await bot.sendMessage(chatId, resultText, { parse_mode: "HTML" });
        return;
    }

    const code = parseInt(text);

    // Animatsiya (Loading)
    const msgObj = await bot.sendMessage(chatId, "⏳ Film izlanmoqda.");
    const delay = ms => new Promise(res => setTimeout(res, ms));
    
    await delay(400);
    await bot.editMessageText("⏳ Film izlanmoqda..", { chat_id: chatId, message_id: msgObj.message_id }).catch(()=>{});
    await delay(400);
    await bot.editMessageText("⏳ Film izlanmoqda...", { chat_id: chatId, message_id: msgObj.message_id }).catch(()=>{});
    await delay(400);
    await bot.editMessageText("⏳ Film izlanmoqda....", { chat_id: chatId, message_id: msgObj.message_id }).catch(()=>{});

    const { getSeries, getEpisodes } = require('../../base/models/series.model');
    const movie = await getMovie(code);
    const series = await getSeries(code);
    
    // Bazadan qidirilgandan keyin "Izlanmoqda" xabarini o'chirib tashlaymiz
    await bot.deleteMessage(chatId, msgObj.message_id).catch(()=>{});
    
    if (movie) {
        const notJoined = await getUnsubscribedChannels(chatId);
        const isMainJoined = await checkMainChannels(chatId);
        
        // Agar kanallarga obuna so'rash kerak bo'lsa
        if (notJoined.length > 0 || !isMainJoined) {
            // Agar u kanallarga a'zo bo'lmagan bo'lsa, trellerni yuboramiz
            let inline_keyboard = [];
            
            inline_keyboard.push([{ text: "▶️ To'liq kinoni ko'rish", callback_data: `movie_${code}` }]);
            
            if (movie.trailer_file_id) {
                try {
                    await bot.sendVideo(chatId, movie.trailer_file_id, {
                        caption: `🎬 <b>Kodi:</b> ${code}\n\n${movie.caption || ""}\n\n⚠️ To'liq kinoni ko'rish uchun quyidagi tugmani bosing va kanallarga obuna bo'ling!`,
                        parse_mode: "HTML",
                        protect_content: true,
                        reply_markup: {
                            inline_keyboard
                        }
                    });
                } catch (err) {
                    try {
                        await bot.sendPhoto(chatId, movie.trailer_file_id, {
                            caption: `🎬 <b>Kodi:</b> ${code}\n\n${movie.caption || ""}\n\n⚠️ To'liq kinoni ko'rish uchun quyidagi tugmani bosing va kanallarga obuna bo'ling!`,
                            parse_mode: "HTML",
                            protect_content: true,
                            reply_markup: {
                                inline_keyboard
                            }
                        });
                    } catch (e) {
                        console.error("Trellerni yuborishda xatolik:", e.response ? e.response.body : e);
                        await bot.sendMessage(chatId, "⚠️ Videoni yuborishda xatolik yuz berdi. (File ID xato bo'lishi mumkin)");
                    }
                }
            } else {
                // Treyler yo'q, faqat rasm yoki matn yuboramiz. Lekin kino bazasida faqat video saqlangani uchun matn yuboramiz.
                const txt = `🎬 <b>Kodi:</b> ${code}\n\n${movie.caption || ""}\n\n⚠️ <b>Kino topildi!</b>\nUni ko'rish uchun quyidagi tugmani bosib majburiy kanallarga obuna bo'ling!`;
                await bot.sendMessage(chatId, txt, {
                    parse_mode: "HTML",
                    reply_markup: { inline_keyboard }
                });
            }
        } else {
            // Hammasiga obuna bo'lgan bo'lsa, to'g'ridan-to'g'ri to'liq kinoni beramiz
            try {
                await bot.sendVideo(chatId, movie.file_id, {
                    caption: `🎬 <b>Kodi:</b> ${code}\n\n${movie.caption || ""}`,
                    parse_mode: "HTML",
                    protect_content: true
                });
            } catch (err) {
                console.error("To'liq kinoni yuborishda xatolik:", err.response ? err.response.body : err);
                await bot.sendMessage(chatId, "⚠️ Videoni yuborishda xatolik yuz berdi. (File ID xato bo'lishi mumkin)");
            }
        }
        await updateUser(chatId, { action: "" });
    } else if (series) {
        const notJoined = await getUnsubscribedChannels(chatId);
        const isMainJoined = await checkMainChannels(chatId);
        
        let inline_keyboard = [];
        if (notJoined.length > 0 || !isMainJoined) {
            inline_keyboard.push([{ text: "▶️ Barcha qismlarni ko'rish", callback_data: `series_${code}` }]);
        } else {
            const episodes = await getEpisodes(code);
            const { generateEpisodePagination } = require('./pagination');
            inline_keyboard = generateEpisodePagination(episodes, 1, code, "");
        }

        try {
            await bot.sendVideo(chatId, series.trailer_file_id, {
                caption: `📺 <b>Kodi:</b> ${code}\n\n${series.caption || ""}`,
                parse_mode: "HTML",
                protect_content: true,
                reply_markup: inline_keyboard.length > 0 ? { inline_keyboard } : undefined
            });
        } catch (err) {
            // If it's a photo
            bot.sendPhoto(chatId, series.trailer_file_id, {
                caption: `📺 <b>Kodi:</b> ${code}\n\n${series.caption || ""}`,
                parse_mode: "HTML",
                protect_content: true,
                reply_markup: inline_keyboard.length > 0 ? { inline_keyboard } : undefined
            }).catch(()=>{});
        }
        await updateUser(chatId, { action: "" });
    } else {
        await bot.sendMessage(chatId, "😔 Kechirasiz, bunday kodli kino yoki serial topilmadi. Kodni tekshirib qaytadan urinib ko'ring.");
    }
};

const handleSearchQuery = async (query) => {
    const data = query.data;
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;

    if (data.startsWith("movie_")) {
        const code = parseInt(data.split("_")[1]);
        const notJoined = await getUnsubscribedChannels(chatId);
        const isMainJoined = await checkMainChannels(chatId);

        if (!isMainJoined) {
            bot.answerCallbackQuery(query.id, { text: "⚠️ Asosiy kanal va Promo kanalga obuna bo'ling! Ularning manzili bot biosida (profilida) joylashgan.", show_alert: true }).catch(()=>{});
            return true;
        }

        if (notJoined.length > 0) {
            // Hali obuna bo'lmagan, kanallar ro'yxatini chiqaramiz
            let inline_keyboard = notJoined.map(ch => [{ text: ch.name, url: ch.link }]);
            inline_keyboard.push([{ text: "✅ Tekshirish", callback_data: `movie_${code}` }]);

            // Biz xabarni faqat matn qilib o'zgartira olmaymiz (chunki u video),
            // shuning uchun Popup xabar beramiz va yangi xabarda kanallarni jo'natamiz yoki keyboardni o'zgartiramiz
            bot.answerCallbackQuery(query.id, { text: "⚠️ Iltimos, barcha kanallarga obuna bo'ling!", show_alert: true });
            
            // Xabarning keyboardini yangilaymiz
            bot.editMessageReplyMarkup({ inline_keyboard }, { chat_id: chatId, message_id: messageId }).catch(() => {});
            return true;
        }

        // Agar obuna bo'lgan bo'lsa, trellerni to'liq kinoga o'zgartiramiz
        const movie = await getMovie(code);
        if (movie) {
            try {
                await bot.editMessageMedia({
                    type: 'video',
                    media: movie.file_id,
                    caption: `🎬 <b>Kodi:</b> ${code}\n\n${movie.caption || ""}`,
                    parse_mode: "HTML"
                }, {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: { inline_keyboard: [] }
                });
            } catch (err) {
                // Agar eski message video bo'lmasa (matn bo'lsa) error beradi
                if(err.response && err.response.body && err.response.body.description.includes("message is not modified")) {
                    // already modified
                } else {
                    bot.deleteMessage(chatId, messageId).catch(()=>{});
                    bot.sendVideo(chatId, movie.file_id, {
                        caption: `🎬 <b>Kodi:</b> ${code}\n\n${movie.caption || ""}`,
                        parse_mode: "HTML",
                        protect_content: true
                    }).catch(()=>{});
                }
            }
            bot.answerCallbackQuery(query.id, { text: "✅ Obuna tasdiqlandi, marhamat!" });
        } else {
            bot.answerCallbackQuery(query.id, { text: "😔 Kino topilmadi." });
        }
        return true;
    }

    if (data.startsWith("series_")) {
        const code = parseInt(data.split("_")[1]);
        const notJoined = await getUnsubscribedChannels(chatId);
        const isMainJoined = await checkMainChannels(chatId);
        
        if (!isMainJoined) {
            bot.answerCallbackQuery(query.id, { text: "⚠️ Asosiy kanal va Promo kanalga obuna bo'ling! Ularning manzili bot biosida (profilida) joylashgan.", show_alert: true }).catch(()=>{});
            return true;
        }

        if (notJoined.length > 0) {
            let inline_keyboard = notJoined.map(ch => [{ text: ch.name, url: ch.link }]);
            inline_keyboard.push([{ text: "✅ Tekshirish", callback_data: `series_${code}` }]);
            bot.answerCallbackQuery(query.id, { text: "⚠️ Iltimos, barcha kanallarga obuna bo'ling!", show_alert: true }).catch(()=>{});
            bot.editMessageReplyMarkup({ inline_keyboard }, { chat_id: chatId, message_id: messageId }).catch(() => {});
            return true;
        }

        const { getEpisodes } = require('../../base/models/series.model');
        const episodes = await getEpisodes(code);
        const { generateEpisodePagination } = require('./pagination');
        const inline_keyboard = generateEpisodePagination(episodes, 1, code, "");

        bot.editMessageReplyMarkup({ inline_keyboard }, { chat_id: chatId, message_id: messageId }).catch(() => {});
        bot.answerCallbackQuery(query.id, { text: "✅ Obuna tasdiqlandi, qismlarni tanlang!" }).catch(()=>{});
        return true;
    }

    if (data.startsWith("page_")) {
        const parts = data.split("_");
        const code = parseInt(parts[1]);
        const page = parseInt(parts[2]);

        const notJoined = await getUnsubscribedChannels(chatId);
        const isMainJoined = await checkMainChannels(chatId);

        if (!isMainJoined) {
            bot.answerCallbackQuery(query.id, { text: "⚠️ Asosiy kanal va Promo kanalga obuna bo'ling! Ularning manzili bot biosida (profilida) joylashgan.", show_alert: true }).catch(()=>{});
            return true;
        }

        if (notJoined.length > 0) {
            let inline_keyboard = notJoined.map(ch => [{ text: ch.name, url: ch.link }]);
            inline_keyboard.push([{ text: "✅ Tekshirish", callback_data: `series_${code}` }]);
            bot.answerCallbackQuery(query.id, { text: "⚠️ Iltimos, barcha kanallarga obuna bo'ling!", show_alert: true }).catch(()=>{});
            bot.editMessageReplyMarkup({ inline_keyboard }, { chat_id: chatId, message_id: messageId }).catch(() => {});
            return true;
        }

        const { getEpisodes } = require('../../base/models/series.model');
        const episodes = await getEpisodes(code);
        const { generateEpisodePagination } = require('./pagination');
        const inline_keyboard = generateEpisodePagination(episodes, page, code, "");

        bot.editMessageReplyMarkup({ inline_keyboard }, { chat_id: chatId, message_id: messageId }).catch(() => {});
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }

    if (data === "ignore_pagination") {
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }

    if (data.startsWith("ep_")) {
        const parts = data.split("_");
        const code = parseInt(parts[1]);
        const epNum = parseInt(parts[2]);

        const notJoined = await getUnsubscribedChannels(chatId);
        const isMainJoined = await checkMainChannels(chatId);

        if (!isMainJoined) {
            bot.answerCallbackQuery(query.id, { text: "⚠️ Asosiy kanal va Promo kanalga obuna bo'ling! Ularning manzili bot biosida (profilida) joylashgan.", show_alert: true }).catch(()=>{});
            return true;
        }

        if (notJoined.length > 0) {
            let inline_keyboard = notJoined.map(ch => [{ text: ch.name, url: ch.link }]);
            inline_keyboard.push([{ text: "✅ Tekshirish", callback_data: `series_${code}` }]);
            bot.answerCallbackQuery(query.id, { text: "⚠️ Iltimos, barcha kanallarga obuna bo'ling!", show_alert: true }).catch(()=>{});
            bot.editMessageReplyMarkup({ inline_keyboard }, { chat_id: chatId, message_id: messageId }).catch(() => {});
            return true;
        }

        const { getEpisode, getSeries } = require('../../base/models/series.model');
        const episode = await getEpisode(code, epNum);
        const series = await getSeries(code);
        
        if (episode) {
            let captionText = `🎬 <b>${epNum}-qism</b>`;
            if (series && series.caption) {
                // Try to get the first line (Serial nomi)
                let firstLine = series.caption.split('\n')[0];
                firstLine = firstLine.replace('Serial nomi:', 'Serial:');
                captionText = `${firstLine}\n${captionText}`;
            }

            bot.sendVideo(chatId, episode.file_id, {
                caption: captionText,
                parse_mode: "HTML",
                protect_content: true
            }).catch(()=>{});
            bot.answerCallbackQuery(query.id).catch(()=>{});
        } else {
            bot.answerCallbackQuery(query.id, { text: "😔 Bu qism hali yuklanmagan." }).catch(()=>{});
        }
        return true;
    }

    return false;
};

module.exports = {
    askSearchQuery,
    handleSearch,
    handleSearchQuery
};
