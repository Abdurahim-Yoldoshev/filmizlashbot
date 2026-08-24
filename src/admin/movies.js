const { getMovie, addMovie, deleteMovie } = require('../../base/models/movies.model');
const { updateUser } = require('../../base/models/user.model');
const bot = require('../bot');

// --- ADD MOVIE FLOW ---
const startAddMovie = async (chatId, messageId = null) => {
    await updateUser(chatId, { action: "admin_add_movie_custom_code" });
    const text = "🎬 <b>Yangi kino qo'shish</b>\n\nKino uchun o'zingiz xohlagan <b>KOD (raqam)</b> ni kiriting:";
    const opts = {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_section_movie" }]] }
    };
    if (messageId) {
        opts.chat_id = chatId;
        opts.message_id = messageId;
        await bot.editMessageText(text, opts).catch(async () => {
            bot.deleteMessage(chatId, messageId).catch(()=>{});
            await bot.sendMessage(chatId, text, { ...opts, message_id: undefined });
        });
    } else {
        await bot.sendMessage(chatId, text, opts);
    }
};

const handleAddMovieCustomCode = async (msg, user) => {
    const chatId = msg.chat.id;
    const code = parseInt(msg.text);

    if (isNaN(code)) {
        return bot.sendMessage(chatId, "⚠️ Faqat raqamdan iborat kod kiriting:");
    }

    const existingMovie = await getMovie(code);
    if (existingMovie) {
        return bot.sendMessage(chatId, "⚠️ Bu kod bilan kino bazada allaqachon mavjud! Boshqa kod kiriting:");
    }

    await updateUser(chatId, { action: `admin_search_movie_tmdb_${code}` });
    await bot.sendMessage(chatId, `✅ Kod qabul qilindi: <b>${code}</b>\n\nEndi ushbu kinoni Global bazadan (TMDb) topish uchun uning <b>nomini yozing</b> (yoki izlashni xohlamasangiz "Qo'lda" deb yozing):`, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_section_movie" }]] }
    });
};

const handleSearchMovieTmdb = async (msg, user) => {
    const chatId = msg.chat.id;
    const query = msg.text;
    const code = parseInt(user.action.split('_').pop());

    if (!query) return;

    if (query.toLowerCase() === "qo'lda" || query.toLowerCase() === "qolda") {
        await updateUser(chatId, { action: `admin_add_local_movie_trailer_${code}` });
        return bot.sendMessage(chatId, `Endi ushbu kino uchun <b>asosiy rasm yoki treyler (video)</b> yuboring:`, {
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_section_movie" }]] }
        });
    }

    const { startSearchAnimation } = require('../helper/animation');
    const anim = await startSearchAnimation(chatId, "⏳ TMDb bazasidan izlanmoqda");

    const { searchMovieTmdb } = require('../helper/tmdb');
    const results = await searchMovieTmdb(query);

    await anim.stop();

    if (results.length === 0) {
        let inline_keyboard = [
            [{ text: "✏️ Qo'lda kiritish", callback_data: `admin_manual_movie_${code}` }],
            [{ text: "🔙 Orqaga", callback_data: "admin_section_movie" }]
        ];
        return bot.sendMessage(chatId, "⚠️ TMDb dan bunday nomli kino topilmadi. Boshqa nom yozib ko'ring yoki qo'lda kiriting:", {
            reply_markup: { inline_keyboard }
        });
    }

    let inline_keyboard = [];
    const topResults = results.slice(0, 10);
    for (const movie of topResults) {
        const year = movie.release_date ? movie.release_date.split('-')[0] : 'Noma\'lum';
        const title = `${movie.title} (${year})`;
        // Tugmaga bosganda ham custom code ni, ham TMDB ID ni uzatamiz!
        // format: admin_tmdb_movie_{tmdbId}_{customCode}
        inline_keyboard.push([{ text: title, callback_data: `admin_tmdb_movie_${movie.id}_${code}` }]);
    }
    
    inline_keyboard.push([{ text: "✏️ Topilmadi, qo'lda kiritish", callback_data: `admin_manual_movie_${code}` }]);
    inline_keyboard.push([{ text: "🔙 Orqaga", callback_data: "admin_section_movie" }]);

    await bot.sendMessage(chatId, `🔍 <b>"${query}"</b> bo'yicha qidiruv natijalari:\n\nKerakli kinoni tanlang:`, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard }
    });
};

// Format: admin_tmdb_movie_{tmdbId}_{customCode}
const handleTmdbMovieSelect = async (chatId, tmdbId, customCode, messageId) => {
    const existingMovie = await getMovie(customCode);
    if (existingMovie) {
        return bot.sendMessage(chatId, `⚠️ Bu kino (ID: ${customCode}) allaqachon bazada mavjud! Boshqasini tanlang yoki menyudan orqaga qayting.`);
    }

    await bot.editMessageText("⏳ TMDb dan rasm va ma'lumotlar olinmoqda...", { chat_id: chatId, message_id: messageId }).catch(()=>{});
    
    const { getMovieDetailsTmdb } = require('../helper/tmdb');
    const tmdbData = await getMovieDetailsTmdb(tmdbId);

    if (!tmdbData) {
        return bot.sendMessage(chatId, "❌ TMDb dan ma'lumot olishda xatolik yuz berdi.");
    }

    let inline_keyboard = [
        [{ text: "✅ Avtomatik yuklash", callback_data: `admin_auto_load_movie_${tmdbId}_${customCode}` }],
        [{ text: "✏️ Qo'lda kiritish", callback_data: `admin_manual_movie_${customCode}` }],
        [{ text: "🔙 Orqaga", callback_data: "admin_section_movie" }]
    ];

    const confirmText = `<b>TMDb dan quyidagi ma'lumotlar topildi:</b>\n\n${tmdbData.caption}\n\n<i>Ushbu ma'lumotlar bilan avtomatik yuklansinmi yoxud o'zingiz qo'lda kiritasizmi?</i>`;

    if (tmdbData.poster_url) {
        await bot.sendPhoto(chatId, tmdbData.poster_url, {
            caption: confirmText,
            parse_mode: "HTML",
            reply_markup: { inline_keyboard }
        });
    } else {
        await bot.sendMessage(chatId, confirmText, {
            parse_mode: "HTML",
            reply_markup: { inline_keyboard }
        });
    }
    bot.deleteMessage(chatId, messageId).catch(()=>{});
};

const handleAutoLoadMovie = async (chatId, tmdbId, customCode, messageId) => {
    await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId }).catch(()=>{});
    
    // Trailer and caption are already known, but instead of caching them in DB now, 
    // we set action to wait for the video file and fetch tmdb again.
    await updateUser(chatId, { action: `admin_add_auto_movie_file_${customCode}|${tmdbId}` });

    await bot.sendMessage(chatId, `✅ Avtomatik yuklash tanlandi.\n\nEndi <b>${customCode}</b> - kodli kino uchun <b>to'liq video faylini</b> yuboring:`, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_section_movie" }]] }
    });
};

const handleAddAutoMovieFile = async (msg, user) => {
    const chatId = msg.chat.id;
    const parts = user.action.replace('admin_add_auto_movie_file_', '').split('|');
    const customCode = parseInt(parts[0]);
    const tmdbId = parts[1];

    const { validateVideo } = require('../automatic/videoCheck');
    const validation = await validateVideo(msg);
    if (!validation.valid) {
        return bot.sendMessage(chatId, "⚠️ " + validation.reason);
    }

    const file_id = msg.video ? msg.video.file_id : msg.document.file_id;
    const file_unique_id = validation.file_unique_id;
    
    await bot.sendMessage(chatId, "⏳ Saqlanmoqda...");
    const { getMovieDetailsTmdb } = require('../helper/tmdb');
    const tmdbData = await getMovieDetailsTmdb(tmdbId);

    const success = await addMovie(file_id, file_unique_id, tmdbData.poster_url, customCode, tmdbData.caption);

    if (success) {
        // Asilmedia rasm qidirish va bazaga saqlash
        const { searchAsilmediaPoster } = require('../helper/asilmedia');
        const { updateMoviePosterUrl } = require('../../base/models/movies.model');
        const titleMatch = tmdbData.caption ? tmdbData.caption.match(/Kino nomi:\s*(.+)/) : null;
        if (titleMatch) {
            searchAsilmediaPoster(titleMatch[1].trim()).then(posterUrl => {
                if (posterUrl) updateMoviePosterUrl(customCode, posterUrl);
            });
        }

        await bot.sendMessage(chatId, `✅ <b>${customCode}</b> ID li kino muvaffaqiyatli saqlandi!`, {
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_section_movie" }]]
            }
        });

        const { postToChannel } = require('../automatic/channels/trailer');
        const botInfo = await bot.getMe();
        if (tmdbData.poster_url) {
            await postToChannel({ code: customCode, caption: tmdbData.caption, file_id, trailer_file_id: tmdbData.poster_url }, 'movie', botInfo.username);
        }
        
        const { postToCloudChannels } = require('../automatic/channels/cloud');
        await postToCloudChannels({ code: customCode, caption: tmdbData.caption, file_id }, 'movie');
    } else {
        await bot.sendMessage(chatId, "❌ Kinoni saqlashda xatolik yuz berdi.");
    }
    await updateUser(chatId, { action: "" });
};

const handleStartManualMovie = async (chatId, code, messageId) => {
    await updateUser(chatId, { action: `admin_add_local_movie_file_${code}` });
    const text = `✏️ Qo'lda kiritish tanlandi.\n\nEndi <b>${code}</b> - kodli kino uchun <b>to'liq video faylini</b> yuboring (Agar videoga izoh yozilgan bo'lsa u qabul qilinadi, va "------------" belgisi bo'lsa undan keyingi qismi avtomatik kesib tashlanadi):`;
    
    if (messageId) {
        await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_section_movie" }]] }
        }).catch(async () => {
            bot.deleteMessage(chatId, messageId).catch(()=>{});
            await bot.sendMessage(chatId, text, { parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_section_movie" }]] } });
        });
    } else {
        await bot.sendMessage(chatId, text, { parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_section_movie" }]] } });
    }
};

const handleAddLocalMovieFile = async (msg, user) => {
    const chatId = msg.chat.id;
    const code = parseInt(user.action.split('_').pop());

    const { validateVideo } = require('../automatic/videoCheck');
    const validation = await validateVideo(msg);
    if (!validation.valid) {
        return bot.sendMessage(chatId, "⚠️ " + validation.reason);
    }

    const file_id = msg.video ? msg.video.file_id : msg.document.file_id;
    const file_unique_id = validation.file_unique_id;
    
    const { cleanCaption } = require('../helper/cleaner');
    
    let overrideSize = null;
    let overrideDuration = null;
    
    if (msg.video) {
        if (msg.video.file_size) {
            overrideSize = (msg.video.file_size / (1024 * 1024)).toFixed(1) + ' MB';
        }
        if (msg.video.duration) {
            let d = msg.video.duration;
            let h = Math.floor(d / 3600);
            let m = Math.floor((d % 3600) / 60);
            let s = d % 60;
            if (h > 0) {
                overrideDuration = `${h} soat ${m} daqiqa`;
            } else {
                overrideDuration = `${m} daqiqa ${s} soniya`;
            }
        }
    } else if (msg.document && msg.document.file_size) {
        overrideSize = (msg.document.file_size / (1024 * 1024)).toFixed(1) + ' MB';
    }

    let caption = cleanCaption(msg.caption || msg.text || '', { overrideSize, overrideDuration });
    
    await addMovie(file_id, file_unique_id, 'kutilyapti', code, caption);
    bot.deleteMessage(chatId, msg.message_id).catch(()=>{});

    if (!caption) {
        await updateUser(chatId, { action: `admin_add_local_movie_desc_${code}` });
        const template = `🎬 Kino nomi: \n📅 Yili: \n🎭 Janr: #\n⭐️ IMDb: \n📝 Mazmuni: `;
        return bot.sendMessage(chatId, `✅ To'liq kino qabul qilindi.\n\nVideoda izoh (description) yo'q ekan. Iltimos, kino haqida ma'lumotni yozib yuboring (Namuna):\n\n<code>${template}</code>`, {
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_section_movie" }]] }
        });
    }

    await updateUser(chatId, { action: `admin_add_local_movie_trailer_${code}` });
    await bot.sendMessage(chatId, `✅ To'liq kino qabul qilindi.\n\nEndi <b>${code}</b> - kodli kino uchun <b>asosiy rasm yoki treyler (video)</b> yuboring:`, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_section_movie" }]] }
    });
};

const handleAddLocalMovieDesc = async (msg, user) => {
    const chatId = msg.chat.id;
    const code = parseInt(user.action.split('_').pop());
    
    const { cleanCaption } = require('../helper/cleaner');
    const caption = cleanCaption(msg.text || msg.caption);
    if (!caption) {
        return bot.sendMessage(chatId, "⚠️ Iltimos, matn yuboring.");
    }

    const db = require('../../base/db');
    await db.execute({
        sql: `UPDATE movies SET caption = ? WHERE code = ?`,
        args: [caption, code]
    });
    bot.deleteMessage(chatId, msg.message_id).catch(()=>{});

    await updateUser(chatId, { action: `admin_add_local_movie_trailer_${code}` });

    await bot.sendMessage(chatId, `✅ Ma'lumot qabul qilindi.\n\nEndi <b>${code}</b> - kodli kino uchun <b>asosiy rasm yoki treyler (video)</b> yuboring:`, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_section_movie" }]] }
    });
};

const handleAddLocalMovieTrailer = async (msg, user) => {
    const chatId = msg.chat.id;
    const code = parseInt(user.action.split('_').pop());

    if (!msg.video && !msg.photo) {
        return bot.sendMessage(chatId, "⚠️ Iltimos, faqat rasm yoki video yuboring.");
    }

    let trailer_file_id = msg.video ? msg.video.file_id : msg.photo[msg.photo.length - 1].file_id;
    
    const db = require('../../base/db');
    await db.execute({
        sql: `UPDATE movies SET trailer_file_id = ? WHERE code = ?`,
        args: [trailer_file_id, code]
    });
    bot.deleteMessage(chatId, msg.message_id).catch(()=>{});

    // @filmlarbuluti kanaliga traylerni yuborib, xabar linkini saqlaymiz
    const TRAILER_CHANNEL = process.env.TRAILER_CHANNEL || '@filmlarbuluti';
    try {
        let forwarded = null;
        try { forwarded = await bot.forwardMessage(TRAILER_CHANNEL, chatId, msg.message_id); } catch(e) {}
        if (!forwarded) { try { forwarded = await bot.copyMessage(TRAILER_CHANNEL, chatId, msg.message_id); } catch(e) {} }
        
        if (forwarded && forwarded.message_id) {
            const channelUsername = TRAILER_CHANNEL.replace('@', '');
            const trailerUrl = `https://t.me/${channelUsername}/${forwarded.message_id}`;
            const { updateMovieTrailerUrl } = require('../../base/models/movies.model');
            await updateMovieTrailerUrl(code, trailerUrl);
            console.log(`[Trailer] ${code} uchun trailer_url saqlandi: ${trailerUrl}`);
        }
    } catch (e) {
        console.error('[Trailer] Kanalga yuborishda xato:', e.message);
    }

    const { getMovie } = require('../../base/models/movies.model');
    const existingMovie = await getMovie(code);

    await bot.sendMessage(chatId, `✅ <b>${code}</b> ID li mahalliy kino muvaffaqiyatli to'liq saqlandi!`, {
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_section_movie" }]]
        }
    });

    const { postToChannel } = require('../automatic/channels/trailer');
    const botInfo = await bot.getMe();
    await postToChannel(existingMovie, 'movie', botInfo.username);

    const { postToCloudChannels } = require('../automatic/channels/cloud');
    await postToCloudChannels(existingMovie, 'movie');

    await updateUser(chatId, { action: "" });
};

const handleAddMovieFile = async (msg, user) => {
    const chatId = msg.chat.id;
    const parts = user.action.split('|');
    const code = parseInt(parts[1]);
    
    const { validateVideo } = require('../automatic/videoCheck');
    const validation = await validateVideo(msg);
    if (!validation.valid) {
        return bot.sendMessage(chatId, "⚠️ " + validation.reason);
    }

    const file_id = msg.video ? msg.video.file_id : msg.document.file_id;
    const file_unique_id = validation.file_unique_id;
    
    await bot.sendMessage(chatId, "⏳ TMDb dan rasm va ma'lumotlar olinmoqda...");
    const { getMovieDetailsTmdb } = require('../helper/tmdb');
    const tmdbData = await getMovieDetailsTmdb(code);

    let caption = `🎬 Kino nomi: Noma'lum\nID: ${code}`;
    let trailer_file_id = null;

    if (tmdbData) {
        caption = tmdbData.caption;
        trailer_file_id = tmdbData.poster_url;
    }

    const success = await addMovie(file_id, file_unique_id, trailer_file_id, code, caption);
    bot.deleteMessage(chatId, msg.message_id).catch(()=>{});
    
    if (success) {
        // Asilmedia rasm qidirish va bazaga saqlash
        const { searchAsilmediaPoster } = require('../helper/asilmedia');
        const { updateMoviePosterUrl } = require('../../base/models/movies.model');
        const titleMatch = caption ? caption.match(/Kino nomi:\s*(.+)/) : null;
        if (titleMatch) {
            searchAsilmediaPoster(titleMatch[1].trim()).then(posterUrl => {
                if (posterUrl) updateMoviePosterUrl(code, posterUrl);
            });
        }

        await bot.sendMessage(chatId, `✅ <b>${code}</b> ID li kino bazaga muvaffaqiyatli saqlandi!\n\n${caption}`, {
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_section_movie" }]]
            }
        });

        // Post to channel
        const { postToChannel } = require('../automatic/channels/trailer');
        const botInfo = await bot.getMe();
        if (trailer_file_id) {
            await postToChannel({ code, caption, file_id, trailer_file_id }, 'movie', botInfo.username);
        }

        const { postToCloudChannels } = require('../automatic/channels/cloud');
        await postToCloudChannels({ code, caption, file_id }, 'movie');
    } else {
        await bot.sendMessage(chatId, "❌ Kinoni saqlashda xatolik yuz berdi.");
    }

    await updateUser(chatId, { action: "" });
};

// --- DELETE MOVIE FLOW ---
const startDeleteMovie = async (chatId, messageId = null) => {
    await updateUser(chatId, { action: "admin_delete_movie_code" });
    const text = "🗑 <b>Kino o'chirish</b>\n\nO'chirmoqchi bo'lgan kino kodini yuboring:";
    const opts = {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_section_movie" }]] }
    };
    if (messageId) {
        opts.chat_id = chatId;
        opts.message_id = messageId;
        await bot.editMessageText(text, opts).catch(async () => {
            bot.deleteMessage(chatId, messageId).catch(()=>{});
            await bot.sendMessage(chatId, text, { ...opts, message_id: undefined });
        });
    } else {
        await bot.sendMessage(chatId, text, opts);
    }
};

const handleDeleteMovieCode = async (msg, user) => {
    const chatId = msg.chat.id;
    const code = parseInt(msg.text);
    if (isNaN(code)) {
        return bot.sendMessage(chatId, "⚠️ Faqat raqamdan iborat kod kiriting:");
    }

    const existing = await getMovie(code);
    if (!existing) {
        return bot.sendMessage(chatId, "⚠️ Bunday kod bilan kino topilmadi.");
    }

    await updateUser(chatId, { action: "" });
    await bot.sendMessage(chatId, `⚠️ Siz rostdan ham <b>${code}</b> kodli kinoni o'chirmoqchimisiz?\n\nSarlavha: ${existing.caption ? existing.caption.substring(0, 50) + '...' : 'Yo\'q'}`, {
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: [
                [{ text: "✅ Ha, o'chirish", callback_data: `admin_confirm_del_movie_${code}` }],
                [{ text: "🔙 Orqaga", callback_data: "admin_section_movie" }]
            ]
        }
    });
};

const confirmDeleteMovie = async (chatId, code, messageId) => {
    const success = await deleteMovie(code);
    const text = success ? `✅ <b>${code}</b> kodli kino muvaffaqiyatli o'chirildi!` : "❌ Kinoni o'chirishda xatolik yuz berdi.";
    const opts = {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_section_movie" }]]
        }
    };
    await bot.editMessageText(text, opts).catch(async () => {
        bot.deleteMessage(chatId, messageId).catch(()=>{});
        await bot.sendMessage(chatId, text, { ...opts, message_id: undefined });
    });
};

// --- EDIT MOVIE FLOW ---
const startEditMovie = async (chatId, messageId = null) => {
    await updateUser(chatId, { action: "admin_edit_movie_code" });
    const text = "✏️ <b>Kinoni tahrirlash</b>\n\nTahrirlamoqchi bo'lgan kino kodini yuboring:";
    const opts = {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_section_movie" }]] }
    };
    if (messageId) {
        opts.chat_id = chatId;
        opts.message_id = messageId;
        await bot.editMessageText(text, opts).catch(async () => {
            bot.deleteMessage(chatId, messageId).catch(()=>{});
            await bot.sendMessage(chatId, text, { ...opts, message_id: undefined });
        });
    } else {
        await bot.sendMessage(chatId, text, opts);
    }
};

const handleEditMovieCode = async (msg, user) => {
    const chatId = msg.chat.id;
    const code = parseInt(msg.text);
    if (isNaN(code)) {
        return bot.sendMessage(chatId, "⚠️ Faqat raqamdan iborat kod kiriting:");
    }

    const movie = await getMovie(code);
    if (!movie) {
        return bot.sendMessage(chatId, "⚠️ Bunday kod bilan kino topilmadi.");
    }

    await updateUser(chatId, { action: "" });
    await bot.sendMessage(chatId, `🎬 <b>Kino topildi: ${code}</b>\n\nNimani o'zgartirmoqchisiz?`, {
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: [
                [{ text: "🎬 Treyler/Rasm", callback_data: `admin_edit_movie_trailer_${code}` }],
                [{ text: "📝 Ma'lumot", callback_data: `admin_edit_movie_desc_${code}` }],
                [{ text: "🔙 Orqaga", callback_data: "admin_section_movie" }]
            ]
        }
    });
};

const startEditMovieTrailer = async (chatId, code, messageId) => {
    await updateUser(chatId, { action: `admin_update_movie_trailer_${code}` });
    const text = `Kodi <b>${code}</b> bo'lgan kino uchun <b>yangi rasm yoki video (treyler)</b> yuboring:`;
    const opts = {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_section_movie" }]] }
    };
    await bot.editMessageText(text, opts).catch(async () => {
        bot.deleteMessage(chatId, messageId).catch(()=>{});
        await bot.sendMessage(chatId, text, { ...opts, message_id: undefined });
    });
};

const handleUpdateMovieTrailer = async (msg, user) => {
    const chatId = msg.chat.id;
    const code = user.action.split('_').pop();

    if (!msg.video && !msg.photo) {
        return bot.sendMessage(chatId, "⚠️ Iltimos, faqat rasm yoki video fayl yuboring.");
    }

    let trailer_file_id = '';
    if (msg.video) {
        trailer_file_id = msg.video.file_id;
    } else if (msg.photo) {
        trailer_file_id = msg.photo[msg.photo.length - 1].file_id;
    }

    const { updateMovie } = require('../../base/models/movies.model');
    const success = await updateMovie(code, { trailer_file_id });
    bot.deleteMessage(chatId, msg.message_id).catch(()=>{});

    if (success) {
        await bot.sendMessage(chatId, `✅ <b>${code}</b> kodli kino treyleri/rasmi muvaffaqiyatli yangilandi!`, {
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_section_movie" }]] }
        });
    } else {
        await bot.sendMessage(chatId, "❌ Yangilashda xatolik yuz berdi.");
    }
    await updateUser(chatId, { action: "" });
};

const startEditMovieDesc = async (chatId, code, messageId) => {
    await updateUser(chatId, { action: `admin_update_movie_desc_${code}` });
    const movie = await getMovie(code);
    
    const text = `Kodi <b>${code}</b> bo'lgan kino uchun <b>yangi ma'lumotni (description)</b> yuboring:\n\n<i>Joriy ma'lumot:</i>\n<code>${movie.caption || 'Yo\'q'}</code>`;
    const opts = {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_section_movie" }]] }
    };
    await bot.editMessageText(text, opts).catch(async () => {
        bot.deleteMessage(chatId, messageId).catch(()=>{});
        await bot.sendMessage(chatId, text, { ...opts, message_id: undefined });
    });
};

const handleUpdateMovieDesc = async (msg, user) => {
    const chatId = msg.chat.id;
    const code = user.action.split('_').pop();

    if (!msg.text) {
        return bot.sendMessage(chatId, "⚠️ Iltimos, ma'lumotni matn ko'rinishida yuboring.");
    }

    const { cleanCaption } = require('../helper/cleaner');
    const caption = cleanCaption(msg.text);
    const { updateMovie } = require('../../base/models/movies.model');
    const success = await updateMovie(code, { caption });
    bot.deleteMessage(chatId, msg.message_id).catch(()=>{});

    if (success) {
        await bot.sendMessage(chatId, `✅ <b>${code}</b> kodli kino ma'lumotlari muvaffaqiyatli yangilandi!`, {
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_section_movie" }]] }
        });
    } else {
        await bot.sendMessage(chatId, "❌ Yangilashda xatolik yuz berdi.");
    }
    await updateUser(chatId, { action: "" });
};

module.exports = {
    startAddMovie,
    handleAddMovieCustomCode,
    handleSearchMovieTmdb,
    handleTmdbMovieSelect,
    handleAutoLoadMovie,
    handleAddAutoMovieFile,
    handleStartManualMovie,
    handleAddMovieFile,
    handleAddLocalMovieTrailer,
    handleAddLocalMovieDesc,
    handleAddLocalMovieFile,
    startDeleteMovie,
    handleDeleteMovieCode,
    confirmDeleteMovie,
    startEditMovie,
    handleEditMovieCode,
    startEditMovieTrailer,
    handleUpdateMovieTrailer,
    startEditMovieDesc,
    handleUpdateMovieDesc
};
