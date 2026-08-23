const { openAdminPanel, ADMIN_ID } = require('./panel');
const { startAddMovie, startDeleteMovie, handleDeleteMovieCode } = require('./movies');
const { startDeleteSeries, handleDeleteSeriesCode } = require('./series');
const bot = require('../bot');
const { updateUser } = require('../../base/models/user.model');
const { mainMenu } = require('../keyboards/menu');

const handleAdminCallback = async (query) => {
    const data = query.data;
    const chatId = query.message.chat.id;

    if (chatId !== ADMIN_ID) return false;

    if (data.startsWith("admin_channel")) {
        const { handleAdminChannelsCallback } = require('./channels');
        const { getUser } = require('../../base/models/user.model');
        const user = await getUser(chatId);
        const handled = await handleAdminChannelsCallback(query, user);
        if (handled) return true;
    }

    if (data === "admin_back") {
        await updateUser(chatId, { action: "" });
        await openAdminPanel(chatId);
        bot.deleteMessage(chatId, query.message.message_id).catch(()=>{});
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }

    if (data === "admin_close_menu") {
        bot.deleteMessage(chatId, query.message.message_id).catch(()=>{});
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }

    if (data === "ignore_pagination") {
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }

    if (data === "admin_finance_promo") {
        const { showAutoPromoSettings } = require('./finance');
        await showAutoPromoSettings(chatId, query.message.message_id);
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }

    if (data === "admin_finance_card") {
        const { isUserbotConnected } = require('../userbot/client');
        const { getSetting } = require('../../base/models/settings.model');
        const connected = isUserbotConnected();
        const cardData = (await getSetting('payment_card')) || '';
        const [cardNumber, cardOwner] = cardData ? cardData.split('|') : ['', ''];

        let statusText, keyboard;

        if (connected && cardData) {
            // Ulangan + karta bor — ko'rsatamiz
            statusText =
                `✅ <b>Userbot ulangan va ishlayapti.</b>\n\n` +
                `💳 <b>Karta raqami:</b> <code>${cardNumber}</code>\n` +
                `👤 <b>Ismi:</b> ${cardOwner}\n\n` +
                `@HUMOcardbot va @CardXabarbot xabarlarini kuzatmoqda.`;
            keyboard = [
                [{ text: "✏️ Karta raqamini o'zgartirish", callback_data: "admin_userbot_change_card" }],
                [{ text: "🔌 Uzish", callback_data: "admin_userbot_disconnect" }],
                [{ text: "🔙 Orqaga", callback_data: "admin_back_finance" }]
            ];
        } else if (connected && !cardData) {
            // Ulangan lekin karta yo'q — karta so'raymiz
            statusText = `✅ <b>Userbot ulandi!</b>\n\n💳 Endi qabul qiluvchi <b>karta raqami va ismi</b> ni kiriting.\n\nFormat: <code>8600 1234 5678 9012|Ism Familiya</code>`;
            await updateUser(chatId, { action: "admin_edit_card" });
            keyboard = [[{ text: "🔙 Orqaga", callback_data: "admin_back_finance" }]];
        } else {
            // Ulanmagan — telefon so'raymiz
            statusText = `⚠️ <b>Userbot ulanmagan.</b>\n\nTo'lovlarni avtomatik tekshirish uchun Telegram akkauntingizni ulang.\n\nTelefon raqamingizni yuboring (Masalan: <code>+998901234567</code>):`;
            await updateUser(chatId, { action: "admin_userbot_phone" });
            keyboard = [[{ text: "🔙 Orqaga", callback_data: "admin_back_finance" }]];
        }

        await bot.editMessageText(`<blockquote><b>👨‍💻 Admin Panel / Moliya / Userbot</b></blockquote>\n\n${statusText}`, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
        }).catch(()=>{});
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }

    if (data === "admin_userbot_change_card") {
        // Karta o'zgartirish — akk kirishga qaytsin
        const { getUserbotClient } = require('../userbot/client');
        const client = getUserbotClient();
        if (client) { try { await client.disconnect(); } catch(e) {} }
        await updateUser(chatId, { action: "admin_userbot_phone" });
        await bot.editMessageText(
            `<blockquote><b>👨‍💻 Admin Panel / Moliya / Userbot</b></blockquote>\n\n⚠️ <b>Akkauntni qayta ulang.</b>\n\nTelefon raqamingizni yuboring (Masalan: <code>+998901234567</code>):`,
            {
                chat_id: chatId,
                message_id: query.message.message_id,
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_back_finance" }]] }
            }
        ).catch(()=>{});
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }

    if (data === "admin_userbot_disconnect") {
        await bot.editMessageText(
            `<blockquote><b>👨‍💻 Admin Panel / Moliya / Userbot</b></blockquote>\n\n⚠️ <b>Haqiqatan ham akkauntni uzmoqchimisiz?</b>\n\nAkkauntni uzsangiz, foydalanuvchilar to'lovlari avtomatik tasdiqlanmaydi. Qaytadan ulash uchun telefon raqam va kod kiritishingiz kerak bo'ladi.`,
            {
                chat_id: chatId,
                message_id: query.message.message_id,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "✅ Ha, uzish", callback_data: "admin_userbot_disconnect_confirm" }],
                        [{ text: "❌ Yo'q, bekor qilish", callback_data: "admin_finance_card" }]
                    ]
                }
            }
        ).catch(()=>{});
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }

    if (data === "admin_userbot_disconnect_confirm") {
        const { getUserbotClient } = require('../userbot/client');
        const client = getUserbotClient();
        if (client) { try { await client.disconnect(); } catch(e) {} }
        bot.answerCallbackQuery(query.id, { text: "✅ Userbot uzildi!", show_alert: true }).catch(()=>{});
        // Sahifani yangilash
        setTimeout(() => {
            const { isUserbotConnected } = require('../userbot/client');
            bot.editMessageText(
                `<blockquote><b>👨‍💻 Admin Panel / Moliya / Userbot</b></blockquote>\n\n⚠️ <b>Userbot ulanmagan.</b>\n\nTo'lovlarni avtomatik tekshirish uchun Telegram akkauntingizni ulang.\n\nTelefon raqamingizni yuboring (Masalan: <code>+998901234567</code>):`,
                {
                    chat_id: chatId,
                    message_id: query.message.message_id,
                    parse_mode: 'HTML',
                    reply_markup: { inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_back_finance" }]] }
                }
            ).catch(()=>{});
        }, 1000);
        updateUser(chatId, { action: "admin_userbot_phone" }).catch(()=>{});
        return true;
    }

    if (data === "admin_broadcast_cancel") {
        await updateUser(chatId, { action: "" });
        bot.deleteMessage(chatId, query.message.message_id).catch(()=>{});
        bot.answerCallbackQuery(query.id, { text: "❌ Bekor qilindi" }).catch(()=>{});
        return true;
    }

    if (data.startsWith("admin_broadcast_confirm_")) {
        const messageIdToBroadcast = parseInt(data.replace("admin_broadcast_confirm_", ""));
        bot.deleteMessage(chatId, query.message.message_id).catch(()=>{});
        bot.answerCallbackQuery(query.id, { text: "✅ Xabar yuborish boshlandi..." }).catch(()=>{});
        
        const { startBroadcasting } = require('./broadcast');
        startBroadcasting(chatId, chatId, messageIdToBroadcast);
        return true;
    }

    
    if (data.startsWith("admin_promo_edit_")) {
        const fieldName = data.replace("admin_promo_edit_", "");
        const { promptEditPromoSetting } = require('./finance');
        await promptEditPromoSetting(chatId, query.message.message_id, fieldName);
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }

    if (data.startsWith("admin_promo_cat_")) {
        const category = data.replace("admin_promo_cat_", "");
        const { showAutoPromoCategory } = require('./finance');
        await showAutoPromoCategory(chatId, query.message.message_id, category);
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }

    if (data === "admin_promo_force_test") {
        const { sendRandomPromo } = require('../automatic/channels/promo');
        sendRandomPromo();
        bot.answerCallbackQuery(query.id, { text: "✅ Bitta promokod hoziroq kanalga yuborildi!", show_alert: true }).catch(()=>{});
        return true;
    }

    if (data === "admin_finance_tariffs") {
        const text = `<blockquote><b>👨‍💻 Admin Panel / Moliya / Tariflar</b></blockquote>\n\n💎 <b>Tariflar boshqaruvi</b>\n\nBu yerdan obuna tariflarini boshqarishingiz mumkin:`;
        const opts = {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "👁 Ko'rish", callback_data: "admin_tariff_list_watch" }, { text: "⬇️ Yuklash", callback_data: "admin_tariff_list_download" }],
                    [{ text: "🔙 Orqaga", callback_data: "admin_back_finance" }]
                ]
            }
        };
        await bot.editMessageText(text, opts).catch(()=>{});
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }

    if (data === "admin_finance_margins") {
        const { showMarginList } = require('./finance');
        await showMarginList(chatId, query.message.message_id);
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }

    if (data.startsWith("admin_margin_edit_")) {
        const id = parseInt(data.replace("admin_margin_edit_", ""));
        const { promptEditMargin } = require('./finance');
        await promptEditMargin(chatId, query.message.message_id, id);
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }

    if (data === "admin_cashback_tiers") {
        const { showCashbackTiers } = require('./finance');
        await showCashbackTiers(chatId, query.message.message_id);
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }
    if (data === "admin_cashback_add") {
        const { promptAddCashbackTierAmount } = require('./finance');
        await promptAddCashbackTierAmount(chatId, query.message.message_id);
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }
    if (data.startsWith("admin_cashback_del_ask_")) {
        const id = parseInt(data.replace("admin_cashback_del_ask_", ""));
        const { askDeleteCashbackTier } = require('./finance');
        await askDeleteCashbackTier(chatId, query.message.message_id, id);
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }
    if (data.startsWith("admin_cashback_del_confirm_")) {
        const id = parseInt(data.replace("admin_cashback_del_confirm_", ""));
        const { confirmDeleteCashbackTier } = require('./finance');
        await confirmDeleteCashbackTier(chatId, query.message.message_id, query.id, id);
        return true;
    }
    
    // --- TARIFF CRUD CALLBACKS ---
    if (data.startsWith("admin_tariff_list_")) {
        const { showTariffList } = require('./finance');
        const category = data.replace("admin_tariff_list_", "");
        await showTariffList(chatId, query.message.message_id, category, query.id);
        // Do not answerCallbackQuery here if showTariffList already answered it, but it's fine. Wait, if showTariffList answered it with alert, calling it again without text will just be ignored. Or it might fail. Better to not answer here.
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }
    if (data.startsWith("admin_add_tariff_")) {
        const { startAddTariff } = require('./finance');
        const category = data.replace("admin_add_tariff_", "");
        await startAddTariff(chatId, query.message.message_id, category);
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }
    if (data.startsWith("admin_tariff_view_")) {
        const { viewTariff } = require('./finance');
        const id = parseInt(data.replace("admin_tariff_view_", ""));
        await viewTariff(chatId, query.message.message_id, id);
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }
    if (data.startsWith("admin_tariff_del_ask_")) {
        const { askDeleteTariff } = require('./finance');
        const id = parseInt(data.replace("admin_tariff_del_ask_", ""));
        await askDeleteTariff(chatId, query.message.message_id, id);
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }
    if (data.startsWith("admin_tariff_del_confirm_")) {
        const { confirmDeleteTariff } = require('./finance');
        const id = parseInt(data.replace("admin_tariff_del_confirm_", ""));
        await confirmDeleteTariff(chatId, query.message.message_id, query.id, id);
        return true;
    }
    if (data.startsWith("admin_tariff_edit_menu_")) {
        const { editTariffMenu } = require('./finance');
        const id = parseInt(data.replace("admin_tariff_edit_menu_", ""));
        await editTariffMenu(chatId, query.message.message_id, id);
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }
    if (data.startsWith("admin_tariff_edit_field_")) {
        const { promptEditTariffField } = require('./finance');
        // format: admin_tariff_edit_field_ID_FIELD
        const parts = data.split("_");
        const field = parts.pop();
        const id = parseInt(parts.pop());
        await promptEditTariffField(chatId, query.message.message_id, id, field);
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }
    // -----------------------------

    if (data === "admin_back_finance") {
        const text = `<blockquote><b>👨‍💻 Admin Panel / Moliya</b></blockquote>\n\n💰 <b>Moliya boshqaruvi paneli</b>\n\nQuyidagi menyudan kerakli bo'limni tanlang:`;
        const opts = {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Tariflar", callback_data: "admin_finance_tariffs" }, { text: "Ustamalar", callback_data: "admin_finance_margins" }],
                    [{ text: "📣 Avto-Promo sozlamalari", callback_data: "admin_finance_promo" }],
                    [{ text: "💳 Karta qo'shish", callback_data: "admin_finance_card" }],
                    [{ text: "❌ Yopish", callback_data: "admin_back" }]
                ]
            }
        };
        await bot.editMessageText(text, opts).catch(()=>{});
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }

    if (data === "admin_section_movie") {
        await updateUser(chatId, { action: "" });
        const text = `<blockquote><b>👨‍💻 Admin Panel / Film / Kino</b></blockquote>\n\n🎬 <b>Kino boshqaruvi paneli</b>\n\nO'zingizga kerakli amalni tanlang:`;
        const opts = {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "➕ Kino qo'shish", callback_data: "admin_add_movie" }],
                    [{ text: "✏️ Tahrirlash", callback_data: "admin_edit_movie" }, { text: "🗑 Kino o'chirish", callback_data: "admin_delete_movie" }],
                    [{ text: "🔙 Orqaga", callback_data: "admin_back_to_film" }]
                ]
            }
        };
        await bot.editMessageText(text, opts).catch(async () => {
            bot.deleteMessage(chatId, query.message.message_id).catch(()=>{});
            await bot.sendMessage(chatId, text, { ...opts, message_id: undefined });
        });
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }
    
    if (data === "admin_section_series") {
        await updateUser(chatId, { action: "" });
        const text = `<blockquote><b>👨‍💻 Admin Panel / Film / Serial</b></blockquote>\n\n🎞 <b>Serial boshqaruvi paneli</b>\n\nO'zingizga kerakli tugmani tanlang:`;
        const opts = {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "➕ Qo'shish", callback_data: "admin_add_universal_series" }],
                    [{ text: "✏️ Tahrirlash", callback_data: "admin_edit_series" }, { text: "🗑 O'chirish", callback_data: "admin_delete_series" }],
                    [{ text: "🔙 Orqaga", callback_data: "admin_back_to_film" }]
                ]
            }
        };
        await bot.editMessageText(text, opts).catch(async () => {
            bot.deleteMessage(chatId, query.message.message_id).catch(()=>{});
            await bot.sendMessage(chatId, text, { ...opts, message_id: undefined });
        });
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }

    if (data === "admin_back_to_film" || data === "admin_back_film") {
        await updateUser(chatId, { action: "" });
        const text = `<blockquote><b>👨‍💻 Admin Panel / Film</b></blockquote>\n\n🎞 <b>Film boshqaruvi paneli</b>\n\nO'zingizga kerakli bo'limni tanlang:`;
        const opts = {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🎬 Kinolar", callback_data: "admin_section_movie" }, { text: "📺 Seriallar", callback_data: "admin_section_series" }],
                    [{ text: "❌ Yopish", callback_data: "admin_back" }]
                ]
            }
        };
        await bot.editMessageText(text, opts).catch(async () => {
            bot.deleteMessage(chatId, query.message.message_id).catch(()=>{});
            await bot.sendMessage(chatId, text, { ...opts, message_id: undefined });
        });
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }

    if (data === "admin_add_movie") {
        await startAddMovie(chatId, query.message.message_id);
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }
    if (data === "admin_edit_movie") {
        const { startEditMovie } = require('./movies');
        await startEditMovie(chatId, query.message.message_id);
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }
    if (data.startsWith("admin_edit_movie_trailer_")) {
        const code = parseInt(data.split('_').pop());
        const { startEditMovieTrailer } = require('./movies');
        await startEditMovieTrailer(chatId, code, query.message.message_id);
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }
    if (data.startsWith("admin_edit_movie_desc_")) {
        const code = parseInt(data.split('_').pop());
        const { startEditMovieDesc } = require('./movies');
        await startEditMovieDesc(chatId, code, query.message.message_id);
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }
    if (data.startsWith("admin_tmdb_movie_")) {
        const parts = data.split('_');
        const customCode = parseInt(parts.pop());
        const tmdbId = parseInt(parts.pop());
        const { handleTmdbMovieSelect } = require('./movies');
        await handleTmdbMovieSelect(chatId, tmdbId, customCode, query.message.message_id);
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }
    if (data.startsWith("admin_auto_load_movie_")) {
        const parts = data.split('_');
        const customCode = parseInt(parts.pop());
        const tmdbId = parseInt(parts.pop());
        const { handleAutoLoadMovie } = require('./movies');
        await handleAutoLoadMovie(chatId, tmdbId, customCode, query.message.message_id);
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }
    if (data.startsWith("admin_manual_movie_")) {
        const code = parseInt(data.split('_').pop());
        const { handleStartManualMovie } = require('./movies');
        await handleStartManualMovie(chatId, code, query.message.message_id);
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }
    if (data.startsWith("admin_tmdb_series_")) {
        const parts = data.split('_');
        const customCode = parseInt(parts.pop());
        const tmdbId = parseInt(parts.pop());
        const { handleTmdbSeriesSelect } = require('./series');
        await handleTmdbSeriesSelect(chatId, tmdbId, customCode, query.message.message_id);
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }
    if (data.startsWith("admin_auto_load_series_")) {
        const parts = data.split('_');
        const customCode = parseInt(parts.pop());
        const tmdbId = parseInt(parts.pop());
        const { handleAutoLoadSeries } = require('./series');
        await handleAutoLoadSeries(chatId, tmdbId, customCode, query.message.message_id);
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }
    if (data.startsWith("admin_manual_series_")) {
        const code = parseInt(data.split('_').pop());
        const { handleStartManualSeries } = require('./series');
        await handleStartManualSeries(chatId, code, query.message.message_id);
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }
    if (data === "admin_delete_movie") {
        await startDeleteMovie(chatId, query.message.message_id);
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }
    if (data.startsWith("admin_confirm_del_movie_")) {
        const code = parseInt(data.split("_").pop());
        const { confirmDeleteMovie } = require('./movies');
        await confirmDeleteMovie(chatId, code, query.message.message_id);
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }

    if (data === "admin_add_universal_series") {
        const { startAddUniversalSeries } = require('./series');
        await startAddUniversalSeries(chatId, query.message.message_id);
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }

    if (data === "admin_edit_series") {
        const { startEditSeries } = require('./series');
        await startEditSeries(chatId, query.message.message_id);
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }
    
    if (data.startsWith("admin_edit_series_trailer_")) {
        const code = parseInt(data.split('_').pop());
        const { startEditSeriesTrailer } = require('./series');
        await startEditSeriesTrailer(chatId, code, query.message.message_id);
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }
    
    if (data.startsWith("admin_edit_series_desc_")) {
        const code = parseInt(data.split('_').pop());
        const { startEditSeriesDesc } = require('./series');
        await startEditSeriesDesc(chatId, code, query.message.message_id);
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }
    
    if (data.startsWith("admin_add_ep_for_")) {
        const code = parseInt(data.split("_")[4]);
        const { handleAddEpisodeCodeDirect } = require('./series');
        await handleAddEpisodeCodeDirect(chatId, code, query.message.message_id);
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }

    if (data.startsWith("admin_add_ep_single_")) {
        const code = parseInt(data.split("_").pop());
        const { handleAddEpisodeSingle } = require('./series');
        await handleAddEpisodeSingle(chatId, code, query.message.message_id);
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }

    if (data.startsWith("admin_add_ep_bulk_")) {
        const code = parseInt(data.split("_").pop());
        const { handleAddEpisodeBulkMode } = require('./series');
        await handleAddEpisodeBulkMode(chatId, code, query.message.message_id);
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }

    if (data.startsWith("admin_add_ep_next_")) {
        const parts = data.split("_");
        const code = parseInt(parts[4]);
        const nextEpNum = parseInt(parts[5]);
        
        await updateUser(chatId, { action: `admin_add_episode_file_${code}_${nextEpNum}` });
        await bot.editMessageText(`<b>${nextEpNum}-qism</b> kutilmoqda...\n\nIltimos, shu qism uchun <b>video faylni</b> yuboring:\nSerial kodi: <b>${code}</b>`, {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [[{ text: "🔙 Orqaga", callback_data: "admin_section_series" }]]
            }
        }).catch(() => {});
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }

    if (data.startsWith("admin_view_page_")) {
        const parts = data.split("_");
        const page = parseInt(parts.pop());
        const code = parseInt(parts.pop());
        
        const { getEpisodes } = require('../../base/models/series.model');
        const episodes = await getEpisodes(code);
        const { generateEpisodePagination } = require('../helper/pagination');
        let inline_keyboard = generateEpisodePagination(episodes, page, code, "admin_view");

        inline_keyboard.push([{ text: "➕ Qism qo'shish", callback_data: `admin_add_ep_for_${code}` }]);
        inline_keyboard.push([{ text: "🔙 Orqaga", callback_data: "admin_section_series" }]);
        
        bot.editMessageReplyMarkup({ inline_keyboard }, { chat_id: chatId, message_id: query.message.message_id }).catch(() => {});
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }

    if (data.startsWith("admin_view_ep_")) {
        const parts = data.split("_");
        const epNum = parseInt(parts.pop());
        const code = parseInt(parts.pop());
        
        const { getEpisode, getSeries } = require('../../base/models/series.model');
        const episode = await getEpisode(code, epNum);
        const series = await getSeries(code);

        if (episode) {
            let captionText = `🎬 <b>${epNum}-qism</b>`;
            if (series && series.caption) {
                let firstLine = series.caption.split('\n')[0];
                firstLine = firstLine.replace('Serial nomi:', 'Serial:');
                captionText = `${firstLine}\n${captionText}`;
            }

            // We need to send the full video to the admin, with delete and back buttons.
            // But how do we go back? We can't edit the video message back into the series trailer easily because it's a new video file.
            // Wait, we CAN edit the message media! bot.editMessageMedia
            // Let's just send a new message or edit the current one.
            // Let's edit the current message's media so we don't clutter the chat.
            await bot.editMessageMedia({
                type: 'video',
                media: episode.file_id,
                caption: captionText,
                parse_mode: "HTML"
            }, {
                chat_id: chatId,
                message_id: query.message.message_id,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "🗑 O'chirish", callback_data: `admin_ask_del_ep_${code}_${epNum}` }],
                        [{ text: "🔙 Orqaga", callback_data: `admin_back_to_series_view_${code}` }]
                    ]
                }
            }).catch(async (err) => {
                // if it fails because it was a photo before, send a new one and delete old
                bot.deleteMessage(chatId, query.message.message_id).catch(()=>{});
                await bot.sendVideo(chatId, episode.file_id, {
                    caption: captionText,
                    parse_mode: "HTML",
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "🗑 O'chirish", callback_data: `admin_ask_del_ep_${code}_${epNum}` }],
                            [{ text: "🔙 Orqaga", callback_data: `admin_back_to_series_view_${code}` }]
                        ]
                    }
                }).catch(()=>{});
            });
            bot.answerCallbackQuery(query.id).catch(()=>{});
        } else {
            bot.answerCallbackQuery(query.id, { text: "😔 Bu qism topilmadi.", show_alert: true }).catch(()=>{});
        }
        return true;
    }

    if (data.startsWith("admin_back_to_series_view_")) {
        const code = parseInt(data.split("_").pop());
        const { getSeries, getEpisodes } = require('../../base/models/series.model');
        const series = await getSeries(code);
        if (series) {
            const episodes = await getEpisodes(code);
            const { generateEpisodePagination } = require('../helper/pagination');
            let inline_keyboard = generateEpisodePagination(episodes, 1, code, "admin_view");

            inline_keyboard.push([{ text: "➕ Qism qo'shish", callback_data: `admin_add_ep_for_${code}` }]);
            inline_keyboard.push([{ text: "🔙 Orqaga", callback_data: "admin_section_series" }]);

            const caption = `📺 <b>Serial topildi!</b>\n\n<b>Kodi:</b> ${code}\n\n${series.caption || ""}`;

            if (series.trailer_file_id) {
                await bot.editMessageMedia({
                    type: 'video', // we assume video, if photo it might fail. Let's try video, then photo.
                    media: series.trailer_file_id,
                    caption: caption,
                    parse_mode: "HTML"
                }, {
                    chat_id: chatId,
                    message_id: query.message.message_id,
                    reply_markup: { inline_keyboard }
                }).catch(async () => {
                    bot.deleteMessage(chatId, query.message.message_id).catch(()=>{});
                    // Fallback to sending new
                    await bot.sendVideo(chatId, series.trailer_file_id, {
                        caption: caption, parse_mode: "HTML", reply_markup: { inline_keyboard }
                    }).catch(async () => {
                        await bot.sendPhoto(chatId, series.trailer_file_id, {
                            caption: caption, parse_mode: "HTML", reply_markup: { inline_keyboard }
                        }).catch(()=>{});
                    });
                });
            }
        }
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }
    if (data === "admin_delete_series") {
        await startDeleteSeries(chatId, query.message.message_id);
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }
    if (data.startsWith("admin_ask_del_ep_")) {
        const parts = data.split("_");
        const epNum = parseInt(parts.pop());
        const code = parseInt(parts.pop());
        const { askDeleteEpisode } = require('./series');
        await askDeleteEpisode(chatId, code, epNum, query.message.message_id);
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }
    if (data.startsWith("admin_ask_del_page_")) {
        const parts = data.split("_");
        const page = parseInt(parts.pop());
        const code = parseInt(parts.pop());
        
        const { getEpisodes } = require('../../base/models/series.model');
        const episodes = await getEpisodes(code);
        const { generateEpisodePagination } = require('../helper/pagination');
        let inline_keyboard = generateEpisodePagination(episodes, page, code, "admin_ask_del");

        inline_keyboard.push([{ text: "💣 Butunlay serialni o'chirish", callback_data: `admin_ask_del_series_${code}` }]);
        inline_keyboard.push([{ text: "🔙 Orqaga", callback_data: "admin_close_menu" }]);
        
        bot.editMessageReplyMarkup({ inline_keyboard }, { chat_id: chatId, message_id: query.message.message_id }).catch(() => {});
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }
    if (data.startsWith("admin_confirm_del_ep_")) {
        const parts = data.split("_");
        const epNum = parseInt(parts.pop());
        const code = parseInt(parts.pop());
        const { confirmDeleteEpisode } = require('./series');
        await confirmDeleteEpisode(chatId, code, epNum, query.message.message_id);
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }
    if (data.startsWith("admin_ask_del_series_")) {
        const code = parseInt(data.split("_").pop());
        const { askDeleteSeries } = require('./series');
        await askDeleteSeries(chatId, code, query.message.message_id);
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }
    if (data.startsWith("admin_confirm_del_series_")) {
        const code = parseInt(data.split("_").pop());
        const { confirmDeleteSeries } = require('./series');
        await confirmDeleteSeries(chatId, code, query.message.message_id);
        bot.answerCallbackQuery(query.id).catch(()=>{});
        return true;
    }

    return false;
};

const handleAdminMessage = async (msg, user) => {
    const chatId = msg.chat.id;
    if (chatId !== ADMIN_ID) return false;

    const text = msg.text;

    if (text === "/admin") {
        await openAdminPanel(chatId);
        return true;
    }

    if (text === "🔙 Asosiy menyu") {
        await updateUser(chatId, { action: "" });
        await bot.sendMessage(chatId, "Asosiy menyuga qaytdingiz.", {
            ...mainMenu,
            parse_mode: 'HTML'
        });
        return true;
    }

    if (text === "🔙 Orqaga") {
        await openAdminPanel(chatId);
        return true;
    }

    if (text === "🎞 Filmlar") {
        await bot.sendMessage(chatId, `<blockquote><b>👨‍💻 Admin Panel / Film</b></blockquote>\n\n🎞 <b>Film boshqaruvi paneli</b>\n\nO'zingizga kerakli bo'limni tanlang:`, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🎬 Kinolar", callback_data: "admin_section_movie" }, { text: "🎞 Seriallar", callback_data: "admin_section_series" }],
                    [{ text: "❌ Yopish", callback_data: "admin_back" }]
                ]
            }
        });
        return true;
    }

    if (text === "💰 Moliya") {
        await bot.sendMessage(chatId, `<blockquote><b>👨‍💻 Admin Panel / Moliya</b></blockquote>\n\n💰 <b>Moliya boshqaruvi paneli</b>\n\nQuyidagi menyudan kerakli bo'limni tanlang:`, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Tariflar", callback_data: "admin_finance_tariffs" }, { text: "Ustamalar", callback_data: "admin_finance_margins" }],
                    [{ text: "📣 Avto-Promo sozlamalari", callback_data: "admin_finance_promo" }],
                    [{ text: "💳 Karta qo'shish", callback_data: "admin_finance_card" }],
                    [{ text: "❌ Yopish", callback_data: "admin_back" }]
                ]
            }
        });
        return true;
    }

    if (text === "📢 Kanallar") {
        const { handleAdminChannelsMenu } = require('./channels');
        await handleAdminChannelsMenu(msg);
        return true;
    }

    if (text === "✉️ Xabar") {
        const { handleBroadcastMenu } = require('./broadcast');
        await handleBroadcastMenu(msg);
        return true;
    }

    if (user && user.action) {
        if (user.action.startsWith("admin_channel_wait_")) {
            const { handleAdminChannelsMessage } = require('./channels');
            const handled = await handleAdminChannelsMessage(msg, user);
            if (handled) return true;
        }

        if (user.action === "admin_broadcast_wait") {
            const { handleBroadcastMessage } = require('./broadcast');
            await handleBroadcastMessage(msg, user);
            return true;
        }

        // Finance Tariff actions
        if (user.action.startsWith("admin_add_tariff_name|")) {
            const { handleAddTariffName } = require('./finance');
            await handleAddTariffName(msg, user);
            return true;
        }
        if (user.action.startsWith("admin_add_tariff_price|")) {
            const { handleAddTariffPrice } = require('./finance');
            await handleAddTariffPrice(msg, user);
            return true;
        }
        if (user.action.startsWith("admin_add_tariff_days|")) {
            const { handleAddTariffDays } = require('./finance');
            await handleAddTariffDays(msg, user);
            return true;
        }
        if (user.action.startsWith("admin_edit_tariff_field|")) {
            const { handleEditTariffField } = require('./finance');
            await handleEditTariffField(msg, user);
            return true;
        }
        if (user.action.startsWith("admin_edit_margin|")) {
            const { handleEditMargin } = require('./finance');
            await handleEditMargin(msg, user);
            return true;
        }
        if (user.action === "admin_add_cashback_amount") {
            const { handleAddCashbackTierAmount } = require('./finance');
            await handleAddCashbackTierAmount(msg, user);
            return true;
        }
        if (user.action.startsWith("admin_add_cashback_percent|")) {
            const { handleAddCashbackTierPercent } = require('./finance');
            await handleAddCashbackTierPercent(msg, user);
            return true;
        }

        if (user.action.startsWith("admin_edit_promo|")) {
            const { handleEditPromoSetting } = require('./finance');
            await handleEditPromoSetting(msg, user);
            return true;
        }

        if (user.action === "admin_userbot_phone") {
            const phone = msg.text ? msg.text.trim() : '';
            if (!phone.startsWith('+') || phone.length < 9) {
                await bot.sendMessage(chatId, "⚠️ Noto'g'ri format. Masalan: <code>+998901234567</code>", { parse_mode: 'HTML' });
                return true;
            }
            try {
                const { beginPhoneAuth } = require('../userbot/client');
                const { client, phoneCodeHash } = await beginPhoneAuth(phone);
                // Clientni temp_data ga vaqtincha saqlash uchun global map ishlatamiz
                global._userbotAuthSessions = global._userbotAuthSessions || {};
                global._userbotAuthSessions[chatId] = { client, phoneCodeHash, phone };
                await updateUser(chatId, { action: "admin_userbot_code" });
                await bot.sendMessage(chatId, `📲 <b>+${phone.replace('+','')} raqamiga Telegram kodi yuborildi.</b>\n\nKodni yuboring:`, { parse_mode: 'HTML' });
            } catch(e) {
                await bot.sendMessage(chatId, `❌ Xato: ${e.message}`);
                await updateUser(chatId, { action: "" });
            }
            return true;
        }

        if (user.action === "admin_userbot_code") {
            const code = msg.text ? msg.text.trim().replace(/\s/g, '') : '';
            const session = global._userbotAuthSessions && global._userbotAuthSessions[chatId];
            if (!session) {
                await bot.sendMessage(chatId, "⚠️ Sessiya topilmadi. Qaytadan telefon raqam kiriting.");
                await updateUser(chatId, { action: "" });
                return true;
            }
            try {
                const { finishPhoneAuth } = require('../userbot/client');
                const result = await finishPhoneAuth(session.client, session.phone, code, session.phoneCodeHash);
                if (result.needs_password) {
                    // 2FA parol kerak
                    global._userbotAuthSessions[chatId].client = result.client;
                    await updateUser(chatId, { action: "admin_userbot_password" });
                    await bot.sendMessage(chatId, "🔐 <b>Ikki bosqichli tekshiruv (2FA) yoqilgan.</b>\n\nTelegram parolingizni kiriting:", { parse_mode: 'HTML' });
                } else {
                    delete global._userbotAuthSessions[chatId];
                    await updateUser(chatId, { action: "admin_edit_card" });
                    await bot.sendMessage(chatId,
                        `✅ <b>Userbot muvaffaqiyatli ulandi!</b>\n\n` +
                        `💳 Endi qabul qiluvchi <b>karta raqami va egasining ismi</b>ni kiriting.\n\n` +
                        `Format: <code>8600 1234 5678 9012|Ism Familiya</code>`,
                        { parse_mode: 'HTML' }
                    );
                }
            } catch(e) {
                await bot.sendMessage(chatId, `❌ Kod noto'g'ri yoki muddati o'tgan: ${e.message}`);
            }
            return true;
        }

        if (user.action === "admin_userbot_password") {
            const password = msg.text ? msg.text.trim() : '';
            const session = global._userbotAuthSessions && global._userbotAuthSessions[chatId];
            // Parolni o'chirish (xavfsizlik uchun)
            bot.deleteMessage(chatId, msg.message_id).catch(()=>{});
            if (!session) {
                await bot.sendMessage(chatId, "⚠️ Sessiya topilmadi. Qaytadan telefon raqam kiriting.");
                await updateUser(chatId, { action: "" });
                return true;
            }
            try {
                const { finishPasswordAuth } = require('../userbot/client');
                await finishPasswordAuth(session.client, password);
                delete global._userbotAuthSessions[chatId];
                await updateUser(chatId, { action: "admin_edit_card" });
                await bot.sendMessage(chatId,
                    `✅ <b>Userbot muvaffaqiyatli ulandi!</b>\n\n` +
                    `💳 Endi qabul qiluvchi <b>karta raqami va egasining ismi</b>ni kiriting.\n\n` +
                    `Format: <code>8600 1234 5678 9012|Ism Familiya</code>`,
                    { parse_mode: 'HTML' }
                );
            } catch(e) {
                await bot.sendMessage(chatId, `❌ Parol noto'g'ri: ${e.message}`);
            }
            return true;
        }

        if (user.action === "admin_edit_card") {
            const text = msg.text ? msg.text.trim() : '';
            if (!text.includes('|')) {
                await bot.sendMessage(chatId,
                    "⚠️ <b>Xato format!</b>\nKarta raqami va ismni <b>|</b> belgisi bilan ajrating.\nMasalan: <code>8600 1234 5678 9012|Eshmatov Toshmat</code>",
                    { parse_mode: 'HTML' }
                );
                return true;
            }
            const [cardNumber, cardOwner] = text.split('|');
            const { updateSetting } = require('../../base/models/settings.model');
            await updateSetting('payment_card', text);
            await updateUser(chatId, { action: "" });
            await bot.sendMessage(chatId,
                `✅ <b>Karta saqlandi!</b>\n\n` +
                `💳 <b>Karta raqami:</b> <code>${cardNumber.trim()}</code>\n` +
                `👤 <b>Ismi:</b> ${cardOwner.trim()}\n\n` +
                `@HUMOcardbot va @CardXabarbot kuzatilmoqda. Foydalanuvchilar to'lov qilsa avtomatik tasdiqlanadi!`,
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "✏️ Karta raqamini o'zgartirish", callback_data: "admin_userbot_change_card" }],
                            [{ text: "🔙 Moliya bo'limiga qaytish", callback_data: "admin_back_finance" }]
                        ]
                    }
                }
            );
            return true;
        }

        // Movie actions
        if (user.action === "admin_delete_movie_code") {
            const { handleDeleteMovieCode } = require('./movies');
            await handleDeleteMovieCode(msg, user);
            return true;
        }
        if (user.action === "admin_edit_movie_code") {
            const { handleEditMovieCode } = require('./movies');
            await handleEditMovieCode(msg, user);
            return true;
        }
        if (user.action.startsWith("admin_update_movie_trailer_")) {
            const { handleUpdateMovieTrailer } = require('./movies');
            await handleUpdateMovieTrailer(msg, user);
            return true;
        }
        if (user.action.startsWith("admin_update_movie_desc_")) {
            const { handleUpdateMovieDesc } = require('./movies');
            await handleUpdateMovieDesc(msg, user);
            return true;
        }

        // Series actions
        if (user.action === "admin_add_series_custom_code") {
            const { handleAddUniversalSeriesCustomCode } = require('./series');
            await handleAddUniversalSeriesCustomCode(msg, user);
            return true;
        }
        if (user.action.startsWith("admin_search_series_tmdb_")) {
            const { handleSearchSeriesTmdb } = require('./series');
            await handleSearchSeriesTmdb(msg, user);
            return true;
        }
        if (user.action === "admin_delete_series_code") {
            const { handleDeleteSeriesCode } = require('./series');
            await handleDeleteSeriesCode(msg, user);
            return true;
        }
        if (user.action === "admin_edit_series_code") {
            const { handleEditSeriesCode } = require('./series');
            await handleEditSeriesCode(msg, user);
            return true;
        }
        if (user.action.startsWith("admin_update_series_trailer_")) {
            const { handleUpdateSeriesTrailer } = require('./series');
            await handleUpdateSeriesTrailer(msg, user);
            return true;
        }
        // Movie actions
        if (user.action === "admin_add_movie_custom_code") {
            const { handleAddMovieCustomCode } = require('./movies');
            await handleAddMovieCustomCode(msg, user);
            return true;
        }
        if (user.action.startsWith("admin_search_movie_tmdb_")) {
            const { handleSearchMovieTmdb } = require('./movies');
            await handleSearchMovieTmdb(msg, user);
            return true;
        }
        if (user.action.startsWith("admin_add_auto_movie_file_")) {
            const { handleAddAutoMovieFile } = require('./movies');
            await handleAddAutoMovieFile(msg, user);
            return true;
        }
        if (user.action.startsWith("admin_add_local_movie_trailer_")) {
            const { handleAddLocalMovieTrailer } = require('./movies');
            await handleAddLocalMovieTrailer(msg, user);
            return true;
        }
        if (user.action.startsWith("admin_add_local_movie_desc_")) {
            const { handleAddLocalMovieDesc } = require('./movies');
            await handleAddLocalMovieDesc(msg, user);
            return true;
        }
        if (user.action.startsWith("admin_add_local_movie_file_")) {
            const { handleAddLocalMovieFile } = require('./movies');
            await handleAddLocalMovieFile(msg, user);
            return true;
        }
        if (user.action.startsWith("admin_add_series_trailer_")) {
            const { handleAddSeriesTrailer } = require('./series');
            await handleAddSeriesTrailer(msg, user);
            return true;
        }
        if (user.action.startsWith("admin_update_series_desc_")) {
            const { handleUpdateSeriesDesc } = require('./series');
            await handleUpdateSeriesDesc(msg, user);
            return true;
        }
        if (user.action.startsWith("admin_add_series_desc|")) {
            const { handleAddSeriesDesc } = require('./series');
            await handleAddSeriesDesc(msg, user);
            return true;
        }

        // Episode actions
        if (user.action.startsWith("admin_add_episode_num_")) {
            const { handleAddEpisodeNum } = require('./series');
            await handleAddEpisodeNum(msg, user);
            return true;
        }
        if (user.action.startsWith("admin_add_ep_file_") || user.action.startsWith("admin_add_episode_file_")) {
            const { handleAddEpisodeFile } = require('./series');
            await handleAddEpisodeFile(msg, user);
            return true;
        }
        if (user.action.startsWith("admin_add_episode_bulk_")) {
            const { handleBulkEpisodeFile } = require('./series');
            await handleBulkEpisodeFile(msg, user);
            return true;
        }
    }

    return false;
};

module.exports = {
    handleAdminCallback,
    handleAdminMessage
};
