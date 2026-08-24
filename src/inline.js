const bot = require('./bot');
const { searchMoviesByName, getMovie } = require('../base/models/movies.model');
const { searchSeriesByName, getSeries } = require('../base/models/series.model');

function safeCaption(text) {
    if (!text) return '';
    return text.replace(/<[^>]*>/gm, '').trim();
}

function buildCaptionText(type, code, plain) {
    const prefix = type === 'movie'
        ? `🔥 YANGI KINO! 🔥\n\n🎬 Kodi: ${code}\n\n`
        : `🔥 YANGI SERIAL! 🔥\n\n📺 Kodi: ${code}\n\n`;
    const suffix = type === 'movie'
        ? `\n\n🎬 Tomosha qilish uchun quyidagi tugmani bosing 👇`
        : `\n\n📺 Tomosha qilish uchun quyidagi tugmani bosing 👇`;
    const full = prefix + plain + suffix;
    return full.length > 4000 ? full.substring(0, 3990) + '...' : full;
}

let cachedBotUsername = null;

bot.on('inline_query', async (query) => {
    const queryText = query.query.trim();
    if (!queryText) {
        return bot.answerInlineQuery(query.id, [], { cache_time: 0 }).catch(() => {});
    }

    let movies = [];
    let seriesList = [];

    try {
        const isCode = /^\d+$/.test(queryText);
        if (isCode) {
            const code = parseInt(queryText);
            const [m, s] = await Promise.all([getMovie(code), getSeries(code)]);
            if (m) movies.push(m);
            if (s) seriesList.push(s);
        } else {
            [movies, seriesList] = await Promise.all([
                searchMoviesByName(queryText),
                searchSeriesByName(queryText)
            ]);
        }
    } catch (dbErr) {
        console.error('[Inline] DB xato:', dbErr.message);
        return bot.answerInlineQuery(query.id, [], { cache_time: 0 }).catch(() => {});
    }

    if (!cachedBotUsername) {
        try {
            const info = await bot.getMe();
            cachedBotUsername = info.username;
        } catch (e) {}
    }
    const botUsername = cachedBotUsername || '';

    const results = [];
    for (const item of movies) {
        try {
            results.push(buildResult(item, 'movie', botUsername));
        } catch (e) {
            console.error(`[Inline] movie ${item.code} xato:`, e.message);
        }
    }
    for (const item of seriesList) {
        try {
            results.push(buildResult(item, 'series', botUsername));
        } catch (e) {
            console.error(`[Inline] series ${item.code} xato:`, e.message);
        }
    }

    console.log(`[Inline] "${queryText}" => ${results.length} natija | turlari: ${results.map(r => r.type).join(', ')}`);

    // Telegram API inline query natijalari uchun 50 ta limit mavjud
    const finalResults = results.slice(0, 50);

    // Avval asosiy natijalarni yuborib ko'ramiz
    try {
        await bot.answerInlineQuery(query.id, finalResults, { cache_time: 0 });
    } catch (firstErr) {
        const errMsg = firstErr.response ? JSON.stringify(firstErr.response.body) : firstErr.message;
        console.error('[Inline] 1-urinish xato:', errMsg);

        // Xato bo'lsa barcha natijalarni sof article (rasmsiz) ga o'tkazib qayta urinib ko'ramiz
        try {
            const fallback = finalResults.map(r => {
                const article = toArticle(r);
                delete article.thumbnail_url; // Webp yoki yaroqsiz rasm bo'lsa xato bermasligi uchun o'chiramiz
                return article;
            });
            await bot.answerInlineQuery(query.id, fallback, { cache_time: 0 });
            console.log('[Inline] Fallback article bilan muvaffaqiyatli yuborildi');
        } catch (secondErr) {
            console.error('[Inline] 2-urinish ham xato:', secondErr.message);
        }
    }
});

// Har qanday natijani article ga o'tkazish (fallback)
function toArticle(r) {
    if (r.type === 'article') return r;
    const text = r.caption || r.input_message_content?.message_text || r.title || '';
    const article = {
        type: 'article',
        id: r.id + '_fallback',
        title: r.title || '',
        description: r.description || '',
        input_message_content: { message_text: text || r.title },
        reply_markup: r.reply_markup
    };
    return article;
}

function buildResult(item, type, botUsername) {
    const code = item.code;
    const plain = safeCaption(item.caption);
    const icon = type === 'movie' ? '🎬' : '📺';

    let label = '';
    if (type === 'movie') {
        const m = item.caption ? item.caption.match(/Kino nomi:\s*(.+)/) : null;
        label = item.title || (m ? m[1].trim() : `Kino ${code}`);
    } else {
        const m = item.caption ? item.caption.match(/Serial nomi:\s*(.+)/) : null;
        label = item.title || (m ? m[1].trim() : `Serial ${code}`);
    }

    const captionText = buildCaptionText(type, code, plain);
    const inline_keyboard = [[
        { text: '▶️ Tomosha qilish', url: `https://t.me/${botUsername || 'kino_bot'}?start=${code}` }
    ]];

    // 1-prioritet: HTTP orqali asilmedia rasmi (poster_url)
    if (item.poster_url && item.poster_url.startsWith('http')) {
        let pUrl = item.poster_url;
        return {
            type: 'photo',
            id: `${type}_${code}_photo`,
            photo_url: pUrl,
            thumb_url: pUrl,
            title: `${icon} ${label}`,
            description: `Kod: ${code}`,
            caption: captionText.length > 1024 ? captionText.substring(0, 1020) + '...' : captionText,
            reply_markup: { inline_keyboard }
        };
    }

    // 2-prioritet: Botdagi video/rasm fayl IDsidan foydalanish
    if (item.trailer_file_id) {
        // Agar trailer_file_id rasm bo'lsa (Buni aniqlash qiyin, lekin odatda video bo'ladi)
        return {
            type: 'cached_video',
            id: `${type}_${code}_video`,
            video_file_id: item.trailer_file_id,
            title: `${icon} ${label}`,
            description: `Kod: ${code}`,
            caption: captionText.length > 1024 ? captionText.substring(0, 1020) + '...' : captionText,
            reply_markup: { inline_keyboard }
        };
    }

    // Boshqa barcha hollarda article (matn)
    return {
        type: 'article',
        id: `${type}_${code}_article`,
        title: `${icon} ${label}`,
        description: `Kod: ${code} • Tomosha qilish uchun bosing`,
        input_message_content: { message_text: captionText },
        reply_markup: { inline_keyboard }
    };
}
