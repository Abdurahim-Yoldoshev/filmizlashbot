const bot = require('../bot');
const db = require('../../base/db');
const { updateUser } = require('../../base/models/user.model');
const { addSeries, editSeries, addEpisode, deleteSeries, deleteEpisode, getSeries } = require('../../base/models/series.model');

const bulkLocks = {};

const { getMovie } = require('../../base/models/movies.model');

// --- ADD SERIES FLOW ---
const startAddUniversalSeries = async (chatId, messageId = null) => {
    await updateUser(chatId, { action: "admin_add_series_custom_code" });
    const text = "📺 <b>Serial qo'shish</b>\n\nSerial uchun o'zingiz xohlagan <b>KOD (raqam)</b> ni yuboring:";
    const opts = {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_section_series" }]] }
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

const handleAddUniversalSeriesCustomCode = async (msg, user) => {
    const chatId = msg.chat.id;
    const code = parseInt(msg.text);

    if (isNaN(code)) {
        return bot.sendMessage(chatId, "⚠️ Faqat raqamdan iborat kod kiriting:");
    }

    const existingSeries = await getSeries(code);
    if (existingSeries) {
        // Agar mavjud bo'lsa, qismlar menyusini ochamiz
        await updateUser(chatId, { action: "" });
        const { getEpisodes } = require('../../base/models/series.model');
        const episodes = await getEpisodes(code);
        const { generateEpisodePagination } = require('../helper/pagination');
        let inline_keyboard = generateEpisodePagination(episodes, 1, code, "admin_view");

        inline_keyboard.push([{ text: "➕ Qism qo'shish", callback_data: `admin_add_ep_for_${code}` }]);
        inline_keyboard.push([{ text: "🔙 Orqaga", callback_data: "admin_section_series" }]);

        const opts = {
            parse_mode: "HTML",
            caption: `📺 <b>Serial topildi!</b>\n\n<b>Kodi:</b> ${code}\n\n${existingSeries.caption || ""}`,
            reply_markup: {
                inline_keyboard: inline_keyboard
            }
        };

        if (existingSeries.trailer_file_id) {
            try {
                await bot.sendVideo(chatId, existingSeries.trailer_file_id, opts).catch(async () => {
                    await bot.sendPhoto(chatId, existingSeries.trailer_file_id, opts).catch(async () => {
                        await bot.sendMessage(chatId, opts.caption, { ...opts, caption: undefined });
                    });
                });
            } catch (e) {
                await bot.sendMessage(chatId, opts.caption, { ...opts, caption: undefined });
            }
        } else {
            await bot.sendMessage(chatId, opts.caption, { ...opts, caption: undefined });
        }
        return;
    }

    const existingMovie = await getMovie(code);
    if (existingMovie) {
        return bot.sendMessage(chatId, "⚠️ Bu kod bilan kino bazada mavjud! Boshqa kod kiriting:");
    }

    await updateUser(chatId, { action: `admin_search_series_tmdb_${code}` });
    await bot.sendMessage(chatId, `✅ Kod qabul qilindi: <b>${code}</b>\n\nEndi ushbu serialni Global bazadan (TMDb) topish uchun uning <b>nomini yozing</b> (yoki izlashni xohlamasangiz "Qo'lda" deb yozing):`, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_section_series" }]] }
    });
};

const handleSearchSeriesTmdb = async (msg, user) => {
    const chatId = msg.chat.id;
    const query = msg.text;
    const code = parseInt(user.action.split('_').pop());

    if (!query) return;

    if (query.toLowerCase() === "qo'lda" || query.toLowerCase() === "qolda") {
        await updateUser(chatId, { action: `admin_add_series_trailer_${code}` });
        return bot.sendMessage(chatId, `Endi ushbu serial uchun <b>asosiy rasm yoki treyler (video)</b> yuboring:`, {
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_section_series" }]] }
        });
    }

    const { startSearchAnimation } = require('../helper/animation');
    const anim = await startSearchAnimation(chatId, "⏳ TMDb bazasidan izlanmoqda");

    const { searchSeriesTmdb } = require('../helper/tmdb');
    const results = await searchSeriesTmdb(query);

    await anim.stop();

    if (results.length === 0) {
        let inline_keyboard = [
            [{ text: "✏️ Qo'lda kiritish", callback_data: `admin_manual_series_${code}` }],
            [{ text: "🔙 Orqaga", callback_data: "admin_section_series" }]
        ];
        return bot.sendMessage(chatId, "⚠️ TMDb dan bunday nomli serial topilmadi. Boshqa nom yozib ko'ring yoki qo'lda kiriting:", {
            reply_markup: { inline_keyboard }
        });
    }

    let inline_keyboard = [];
    const maxResults = Math.min(results.length, 10);
    for (let i = 0; i < maxResults; i++) {
        const series = results[i];
        const year = series.first_air_date ? series.first_air_date.split('-')[0] : '';
        const btnText = `${series.name} ${year ? '(' + year + ')' : ''}`;
        inline_keyboard.push([{ text: btnText, callback_data: `admin_tmdb_series_${series.id}_${code}` }]);
    }
    
    inline_keyboard.push([{ text: "✏️ Topilmadi, qo'lda kiritish", callback_data: `admin_manual_series_${code}` }]);
    inline_keyboard.push([{ text: "🔙 Orqaga", callback_data: "admin_section_series" }]);

    await bot.sendMessage(chatId, `👇 Qidiruv natijalari. Kerakli serialni tanlang:`, {
        reply_markup: { inline_keyboard }
    });
};

const handleTmdbSeriesSelect = async (chatId, tmdbId, customCode, messageId) => {
    const existingSeries = await getSeries(customCode);
    if (existingSeries) {
        return bot.sendMessage(chatId, `⚠️ Bu serial (ID: ${customCode}) allaqachon bazada mavjud! Boshqasini tanlang yoki menyudan orqaga qayting.`);
    }

    await bot.editMessageText("⏳ TMDb dan rasm va ma'lumotlar olinmoqda...", { chat_id: chatId, message_id: messageId }).catch(()=>{});
    
    const { getSeriesDetailsTmdb } = require('../helper/tmdb');
    const tmdbData = await getSeriesDetailsTmdb(tmdbId);

    if (!tmdbData) {
        return bot.sendMessage(chatId, "❌ TMDb dan ma'lumot olishda xatolik yuz berdi.");
    }

    let inline_keyboard = [
        [{ text: "✅ Avtomatik yuklash", callback_data: `admin_auto_load_series_${tmdbId}_${customCode}` }],
        [{ text: "✏️ Qo'lda kiritish", callback_data: `admin_manual_series_${customCode}` }],
        [{ text: "🔙 Orqaga", callback_data: "admin_section_series" }]
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

const handleAutoLoadSeries = async (chatId, tmdbId, customCode, messageId) => {
    await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId }).catch(()=>{});
    
    await bot.sendMessage(chatId, "⏳ Saqlanmoqda...");
    const { getSeriesDetailsTmdb } = require('../helper/tmdb');
    const tmdbData = await getSeriesDetailsTmdb(tmdbId);

    const success = await addSeries(customCode, tmdbData.poster_url, tmdbData.caption);
    if (success) {
        await updateUser(chatId, { action: `admin_add_ep_file_${customCode}_1` });
        await bot.sendMessage(chatId, `🎉 <b>${customCode}</b> ID li serial yaratildi!\n\nEndi ushbu serialning <b>1 - qismini (video yoki fayl)</b> yuboring:`, {
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_section_series" }]] }
        });

        try {
            const botInfo = await bot.getMe();
            const { postToChannel } = require('../automatic/channels/trailer');
            await postToChannel({ code: customCode, caption: tmdbData.caption, trailer_file_id: tmdbData.poster_url }, 'series', botInfo.username);
        } catch (e) {
            console.error(e);
        }
    } else {
        await bot.sendMessage(chatId, "❌ Serialni saqlashda xatolik yuz berdi.");
        await updateUser(chatId, { action: "" });
    }
};

const handleStartManualSeries = async (chatId, code, messageId) => {
    await updateUser(chatId, { action: `admin_add_series_trailer_${code}` });
    const text = `✏️ Qo'lda kiritish tanlandi.\n\nEndi <b>${code}</b> - kodli serial uchun <b>asosiy rasm yoki treyler (video)</b> yuboring:`;
    
    if (messageId) {
        await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_section_series" }]] }
        }).catch(async () => {
            bot.deleteMessage(chatId, messageId).catch(()=>{});
            await bot.sendMessage(chatId, text, { parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_section_series" }]] } });
        });
    } else {
        await bot.sendMessage(chatId, text, { parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_section_series" }]] } });
    }
};

const handleAddSeriesTrailer = async (msg, user) => {
    const chatId = msg.chat.id;
    const code = user.action.split('_').pop();

    if (!msg.video && !msg.photo) {
        return bot.sendMessage(chatId, "⚠️ Iltimos, faqat rasm yoki video fayl yuboring.");
    }

    let trailer_file_id = '';
    if (msg.video) {
        trailer_file_id = msg.video.file_id;
    } else if (msg.photo) {
        trailer_file_id = msg.photo[msg.photo.length - 1].file_id; // Eng katta razmeri
    }

    await updateUser(chatId, { action: `admin_add_series_desc|${code}|${trailer_file_id}` });
    bot.deleteMessage(chatId, msg.message_id).catch(()=>{});

    const template = `📺 Serial nomi: \n📅 Yili: \n🎭 Janr: #\n🌐 Tili: \n⭐️ IMDb: \n📝 Mazmuni: `;

    await bot.sendMessage(chatId, `Rasm/Treyler qabul qilindi.\n\nEndi serialning <b>ma'lumotlarini (description)</b> yuboring.\n\n⚠️ <b>Diqqat!</b> Quyidagi shablonni nusxalab oling va to'ldirib, shu yerga xabar qilib yuboring:\n\n<code>${template}</code>`, {
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_section_series" }]]
        }
    });
};

const handleAddSeriesDesc = async (msg, user) => {
    const chatId = msg.chat.id;
    const parts = user.action.split('|');
    const code = parts[1];
    const trailer_file_id = parts[2];
    
    if (!msg.text) {
        return bot.sendMessage(chatId, "⚠️ Iltimos, serial ma'lumotlarini matn ko'rinishida yuboring.");
    }

    const caption = msg.text;
    const success = await addSeries(parseInt(code), trailer_file_id, caption);
    bot.deleteMessage(chatId, msg.message_id).catch(()=>{});
    
    if (success) {
        await bot.sendMessage(chatId, `✅ <b>Serial muvaffaqiyatli qo'shildi!</b>\n\n🎬 Kodi: <b>${code}</b>\n\nEndi "➕ Qism qo'shish" tugmasi orqali qismlarni qo'shishingiz mumkin.`, {
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [
                    [{ text: "➕ Qism qo'shish", callback_data: `admin_add_ep_for_${code}` }],
                    [{ text: "🔙 Orqaga", callback_data: "admin_section_series" }]
                ]
            }
        });

        try {
            const botInfo = await bot.getMe();
            const { postToChannel } = require('../automatic/channels/trailer');
            await postToChannel({ code, caption, trailer_file_id }, 'series', botInfo.username);
        } catch (e) {
            console.error(e);
        }
    } else {
        await bot.sendMessage(chatId, "❌ Serial qo'shishda xatolik yuz berdi.");
    }
    
    await updateUser(chatId, { action: "" });
};

const handleAddEpisodeCodeDirect = async (chatId, code, messageId) => {
    const text = `Serial kodi: <b>${code}</b>\n\nQanday usulda qism qo'shmoqchisiz?`;
    
    const opts = {
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: [
                [{ text: "👤 Yakka", callback_data: `admin_add_ep_single_${code}` }, { text: "👥 Ommaviy", callback_data: `admin_add_ep_bulk_${code}` }],
                [{ text: "🔙 Orqaga", callback_data: `admin_view_page_${code}_1` }]
            ]
        }
    };

    if (messageId) {
        bot.deleteMessage(chatId, messageId).catch(()=>{});
        await bot.sendMessage(chatId, text, opts);
    } else {
        await bot.sendMessage(chatId, text, opts);
    }
};

const handleAddEpisodeSingle = async (chatId, code, messageId) => {
    const { getEpisodes } = require('../../base/models/series.model');
    const episodes = await getEpisodes(code);
    
    const nextEp = episodes.length > 0 ? episodes[episodes.length - 1].episode_num + 1 : 1;

    await updateUser(chatId, { action: `admin_add_episode_file_${code}_${nextEp}` });
    
    const text = `Serial kodi: <b>${code}</b>\n\n<b>${nextEp}-qism</b> kutilmoqda...\n\nIltimos, shu qism uchun <b>video faylni</b> yuboring:`;
    
    const opts = {
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: `admin_add_ep_for_${code}` }]]
        }
    };

    if (messageId) {
        bot.deleteMessage(chatId, messageId).catch(()=>{});
        await bot.sendMessage(chatId, text, opts);
    } else {
        await bot.sendMessage(chatId, text, opts);
    }
};

const handleAddEpisodeBulkMode = async (chatId, code, messageId) => {
    await updateUser(chatId, { action: `admin_add_episode_bulk_${code}` });
    
    const text = `Serial kodi: <b>${code}</b>\n\n👥 <b>Ommaviy qo'shish rejimi yondi.</b>\n\nSiz bir vaqtning o'zida bir nechta video fayllarni (yoki albom qilib) yuborishingiz mumkin. Bot ularni ketma-ket raqamlab qo'shib ketaveradi.\n\nTugatgach, "Tugatish" tugmasini bosing.`;
    
    const opts = {
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: [[{ text: "✅ Tugatish", callback_data: `admin_add_ep_for_${code}` }]]
        }
    };

    if (messageId) {
        bot.deleteMessage(chatId, messageId).catch(()=>{});
        await bot.sendMessage(chatId, text, opts);
    } else {
        await bot.sendMessage(chatId, text, opts);
    }
};


const handleAddEpisodeNum = async (msg, user) => {
    const chatId = msg.chat.id;
    const code = user.action.split('_').pop();
    const epNum = parseInt(msg.text);
    
    if (isNaN(epNum)) {
        return bot.sendMessage(chatId, "⚠️ Faqat raqam kiriting (masalan: 1):");
    }

    await updateUser(chatId, { action: `admin_add_episode_file_${code}_${epNum}` });
    await bot.sendMessage(chatId, `<b>${epNum}-qism</b> kutilmoqda...\n\nIltimos, shu qism uchun <b>video faylni</b> yuboring:`, {
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_section_series" }]]
        }
    });
};

const handleAddEpisodeFile = async (msg, user) => {
    const chatId = msg.chat.id;
    const parts = user.action.split('_');
    const code = parts[4];
    const epNum = parts[5];
    
    const { validateVideo } = require('../automatic/videoCheck');
    const validation = await validateVideo(msg);
    if (!validation.valid) {
        return bot.sendMessage(chatId, "⚠️ " + validation.reason);
    }

    const file_id = msg.video ? msg.video.file_id : msg.document.file_id;
    const file_unique_id = validation.file_unique_id;
    const success = await addEpisode(parseInt(code), parseInt(epNum), file_id, file_unique_id);
    bot.deleteMessage(chatId, msg.message_id).catch(()=>{});
    
    if (success) {
        const nextEp = parseInt(epNum) + 1;
        await bot.sendMessage(chatId, `✅ <b>${epNum}-qism muvaffaqiyatli qo'shildi!</b>\n\nSerial kodi: <b>${code}</b>`, {
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [
                    [{ text: `➕ ${nextEp}-qismni qo'shish`, callback_data: `admin_add_ep_next_${code}_${nextEp}` }],
                    [{ text: "🔙 Orqaga", callback_data: "admin_section_series" }]
                ]
            }
        });

        try {
            const { getSeries } = require('../../base/models/series.model');
            const series = await getSeries(code);
            if (series) {
                const botInfo = await bot.getMe();
                const { postToChannel } = require('../automatic/channels/trailer');
                await postToChannel({ code, series, epNum, file_id }, 'episode', botInfo.username);

                const { postToCloudChannels } = require('../automatic/channels/cloud');
                await postToCloudChannels({ code, series, epNum, file_id }, 'episode');
            }
        } catch (e) {
            console.error(e);
        }
    } else {
        await bot.sendMessage(chatId, "❌ Qism qo'shishda xatolik. Balki bu qism oldin qo'shilgan bo'lishi mumkin.");
    }
    
    await updateUser(chatId, { action: "" });
};

const handleBulkEpisodeFile = async (msg, user) => {
    const chatId = msg.chat.id;
    const parts = user.action.split('_');
    const code = parseInt(parts[4]);
    
    const { validateVideo } = require('../automatic/videoCheck');
    const validation = await validateVideo(msg);
    if (!validation.valid) {
        return bot.sendMessage(chatId, "⚠️ " + validation.reason);
    }

    const file_id = msg.video ? msg.video.file_id : msg.document.file_id;
    const file_unique_id = validation.file_unique_id;
    
    // Acquire mutex lock
    if (!bulkLocks[code]) bulkLocks[code] = Promise.resolve();
    
    const lock = bulkLocks[code];
    let release;
    bulkLocks[code] = new Promise(resolve => { release = resolve; });
    await lock;
    
    try {
        const { getEpisodes } = require('../../base/models/series.model');
        const episodes = await getEpisodes(code);
        const epNum = episodes.length > 0 ? episodes[episodes.length - 1].episode_num + 1 : 1;
        
        const success = await addEpisode(code, epNum, file_id, file_unique_id);
        
        if (success) {
            // Delete the video message the admin sent to keep chat clean
            bot.deleteMessage(chatId, msg.message_id).catch(()=>{});

            try {
                const { getSeries } = require('../../base/models/series.model');
                const series = await getSeries(code);
                if (series) {
                    const botInfo = await bot.getMe();
                    const { postToChannel } = require('../automatic/channels/trailer');
                    await postToChannel({ code, series, epNum, file_id }, 'episode', botInfo.username);

                    const { postToCloudChannels } = require('../automatic/channels/cloud');
                    await postToCloudChannels({ code, series, epNum, file_id }, 'episode');
                }
            } catch (e) {
                console.error(e);
            }
        } else {
            await bot.sendMessage(chatId, `❌ Qism qo'shishda xatolik yuz berdi (File ID: ${file_unique_id}).`);
        }
    } finally {
        release();
    }
};

// --- DELETE SERIES FLOW ---
const startDeleteSeries = async (chatId, messageId = null) => {
    await updateUser(chatId, { action: "admin_delete_series_code" });
    const text = "🗑 <b>Serial o'chirish</b>\n\nO'chirmoqchi bo'lgan serial kodini yuboring:";
    const opts = {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_section_series" }]] }
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

const handleDeleteSeriesCode = async (msg, user) => {
    const chatId = msg.chat.id;
    const code = parseInt(msg.text);

    if (isNaN(code)) {
        return bot.sendMessage(chatId, "⚠️ Faqat raqamdan iborat kod kiriting:");
    }

    const series = await getSeries(code);
    if (!series) {
        return bot.sendMessage(chatId, "⚠️ Bunday kod bilan serial topilmadi.");
    }

    await updateUser(chatId, { action: "" });
    const { getEpisodes } = require('../../base/models/series.model');
    const episodes = await getEpisodes(code);
    
    const { generateEpisodePagination } = require('../helper/pagination');
    let inline_keyboard = generateEpisodePagination(episodes, 1, code, "admin_ask_del");

    inline_keyboard.push([{ text: "💣 Butunlay serialni o'chirish", callback_data: `admin_ask_del_series_${code}` }]);
    inline_keyboard.push([{ text: "🔙 Orqaga", callback_data: "admin_section_series" }]);

    await bot.sendMessage(chatId, `📺 <b>Serial topildi!</b> Kodi: ${code}\n\nQaysi qismni o'chirmoqchisiz yoki butunlay o'chirasizmi?`, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard }
    });
};

const askDeleteEpisode = async (chatId, code, epNum, messageId) => {
    const text = `⚠️ Siz rostdan ham <b>${code}</b> kodli serialning <b>${epNum}-qismini</b> o'chirmoqchimisiz?`;
    const opts = {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: [
                [{ text: "✅ Ha, o'chirish", callback_data: `admin_confirm_del_ep_${code}_${epNum}` }],
                [{ text: "🔙 Orqaga", callback_data: `admin_back_to_series_view_${code}` }]
            ]
        }
    };
    await bot.editMessageText(text, opts).catch(async () => {
        bot.deleteMessage(chatId, messageId).catch(()=>{});
        await bot.sendMessage(chatId, text, { ...opts, message_id: undefined });
    });
};

const confirmDeleteEpisode = async (chatId, code, epNum, messageId) => {
    const success = await deleteEpisode(code, epNum);
    const text = success ? `✅ <b>${code}</b> kodli serialning <b>${epNum}-qismi</b> muvaffaqiyatli o'chirildi!` : "❌ Qism o'chirishda xatolik yuz berdi.";
    
    const opts = {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: `admin_back_to_series_view_${code}` }]]
        }
    };
    
    await bot.editMessageText(text, opts).catch(async () => {
        bot.deleteMessage(chatId, messageId).catch(()=>{});
        await bot.sendMessage(chatId, text, { ...opts, message_id: undefined });
    });
};

const askDeleteSeries = async (chatId, code, messageId) => {
    const text = `⚠️ Siz rostdan ham <b>${code}</b> kodli serialni va uning <b>barcha qismlarini</b> o'chirmoqchimisiz?`;
    const opts = {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: [
                [{ text: "✅ Ha, o'chirish", callback_data: `admin_confirm_del_series_${code}` }],
                [{ text: "🔙 Orqaga", callback_data: "admin_section_series" }]
            ]
        }
    };
    await bot.editMessageText(text, opts).catch(async () => {
        bot.deleteMessage(chatId, messageId).catch(()=>{});
        await bot.sendMessage(chatId, text, { ...opts, message_id: undefined });
    });
};

const confirmDeleteSeries = async (chatId, code, messageId) => {
    const success = await deleteSeries(code);
    const text = success ? `✅ <b>${code}</b> kodli serial va uning barcha qismlari muvaffaqiyatli o'chirildi!` : "❌ Serialni o'chirishda xatolik yuz berdi.";
    
    const opts = {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_section_series" }]]
        }
    };
    await bot.editMessageText(text, opts).catch(async () => {
        bot.deleteMessage(chatId, messageId).catch(()=>{});
        await bot.sendMessage(chatId, text, { ...opts, message_id: undefined });
    });
};

// --- EDIT SERIES FLOW ---
const startEditSeries = async (chatId, messageId = null) => {
    await updateUser(chatId, { action: "admin_edit_series_code" });
    const text = "✏️ <b>Serialni tahrirlash</b>\n\nTahrirlamoqchi bo'lgan serial kodini yuboring:";
    const opts = {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_section_series" }]] }
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

const handleEditSeriesCode = async (msg, user) => {
    const chatId = msg.chat.id;
    const code = parseInt(msg.text);
    if (isNaN(code)) {
        return bot.sendMessage(chatId, "⚠️ Faqat raqamdan iborat kod kiriting:");
    }

    const series = await getSeries(code);
    if (!series) {
        return bot.sendMessage(chatId, "⚠️ Bunday kod bilan serial topilmadi.");
    }

    await updateUser(chatId, { action: "" });
    await bot.sendMessage(chatId, `📺 <b>Serial topildi: ${code}</b>\n\nNimani o'zgartirmoqchisiz?`, {
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard: [
                [{ text: "🎬 Treyler/Rasm", callback_data: `admin_edit_series_trailer_${code}` }],
                [{ text: "📝 Ma'lumot", callback_data: `admin_edit_series_desc_${code}` }],
                [{ text: "🔙 Orqaga", callback_data: "admin_section_series" }]
            ]
        }
    });
};

const startEditSeriesTrailer = async (chatId, code, messageId) => {
    await updateUser(chatId, { action: `admin_update_series_trailer_${code}` });
    const text = `Kodi <b>${code}</b> bo'lgan serial uchun <b>yangi rasm yoki video (treyler)</b> yuboring:`;
    const opts = {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_section_series" }]] }
    };
    await bot.editMessageText(text, opts).catch(async () => {
        bot.deleteMessage(chatId, messageId).catch(()=>{});
        await bot.sendMessage(chatId, text, { ...opts, message_id: undefined });
    });
};

const handleUpdateSeriesTrailer = async (msg, user) => {
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

    const success = await updateSeries(code, { trailer_file_id });
    bot.deleteMessage(chatId, msg.message_id).catch(()=>{});

    if (success) {
        await bot.sendMessage(chatId, `✅ <b>${code}</b> kodli serial treyleri muvaffaqiyatli yangilandi!`, {
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_section_series" }]] }
        });
    } else {
        await bot.sendMessage(chatId, "❌ Yangilashda xatolik yuz berdi.");
    }
    await updateUser(chatId, { action: "" });
};

const startEditSeriesDesc = async (chatId, code, messageId) => {
    await updateUser(chatId, { action: `admin_update_series_desc_${code}` });
    const series = await getSeries(code);
    
    const text = `Kodi <b>${code}</b> bo'lgan serial uchun <b>yangi ma'lumotni (description)</b> yuboring:\n\n<i>Joriy ma'lumot:</i>\n<code>${series.caption || 'Yo\'q'}</code>`;
    const opts = {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_section_series" }]] }
    };
    await bot.editMessageText(text, opts).catch(async () => {
        bot.deleteMessage(chatId, messageId).catch(()=>{});
        await bot.sendMessage(chatId, text, { ...opts, message_id: undefined });
    });
};

const handleUpdateSeriesDesc = async (msg, user) => {
    const chatId = msg.chat.id;
    const code = user.action.split('_').pop();

    if (!msg.text) {
        return bot.sendMessage(chatId, "⚠️ Iltimos, ma'lumotni matn ko'rinishida yuboring.");
    }

    const caption = msg.text;
    const success = await updateSeries(code, { caption });
    bot.deleteMessage(chatId, msg.message_id).catch(()=>{});

    if (success) {
        await bot.sendMessage(chatId, `✅ <b>${code}</b> kodli serial ma'lumotlari muvaffaqiyatli yangilandi!`, {
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_section_series" }]] }
        });
    } else {
        await bot.sendMessage(chatId, "❌ Yangilashda xatolik yuz berdi.");
    }
    await updateUser(chatId, { action: "" });
};

module.exports = {
    startAddUniversalSeries,
    handleAddUniversalSeriesCustomCode,
    handleSearchSeriesTmdb,
    handleTmdbSeriesSelect,
    handleAutoLoadSeries,
    handleStartManualSeries,
    handleAddSeriesTrailer,
    handleAddSeriesDesc,
    startDeleteSeries,
    handleDeleteSeriesCode,
    startEditSeries,
    handleEditSeriesCode,
    startEditSeriesTrailer,
    handleUpdateSeriesTrailer,
    startEditSeriesDesc,
    handleUpdateSeriesDesc,
    handleAddEpisodeCodeDirect,
    handleAddEpisodeSingle,
    handleAddEpisodeBulkMode,
    handleAddEpisodeNum,
    handleAddEpisodeFile,
    handleBulkEpisodeFile,
    askDeleteEpisode,
    confirmDeleteEpisode,
    askDeleteSeries,
    confirmDeleteSeries
};
