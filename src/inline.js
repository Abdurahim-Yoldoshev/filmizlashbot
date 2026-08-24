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

    // Avval barchasini yuborib ko'ramiz
    try {
        await bot.answerInlineQuery(query.id, results, { cache_time: 0 });
    } catch (firstErr) {
        const errMsg = firstErr.response ? JSON.stringify(firstErr.response.body) : firstErr.message;
        console.error('[Inline] 1-urinish xato:', errMsg);

        // Xato bo'lsa barcha natijalarni article ga o'tkazib qayta urinib ko'ramiz
        try {
            const fallback = results.map(r => toArticle(r));
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
        id: r.id,
        title: r.title || '',
        description: r.description || '',
        input_message_content: { message_text: text || r.title },
        reply_markup: r.reply_markup
    };
    // thumbnail_url faqat http URL bo'lganda qo'shiladi
    if (r.photo_url) article.thumbnail_url = r.photo_url;
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
        { text: '▶️ Tomosha qilish', url: `https://t.me/${botUsername}?start=${code}` }
    ]];

    // Avval asilmedia orqali topilgan poster_url, so'ng trailer_file_id (TMDb)
    let imageUrl = item.poster_url || item.trailer_file_id;

    if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
        return {
            type: 'photo',
            id: `${type}_${code}`,
            photo_url: imageUrl,
            thumb_url: imageUrl,
            title: `${icon} ${label}`,
            description: `Kod: ${code}`,
            caption: captionText.length > 1024 ? captionText.substring(0, 1020) + '...' : captionText,
            reply_markup: { inline_keyboard }
        };
    }

    // Boshqa barcha hollarda article (thumbnail_url qo'shib)
    const article = {
        type: 'article',
        id: `${type}_${code}`,
        title: `${icon} ${label}`,
        description: `Kod: ${code} • Tomosha qilish uchun bosing`,
        input_message_content: { message_text: captionText },
        reply_markup: { inline_keyboard }
    };

    // Agar HTTP URL mavjud bo'lsa thumbnail sifatida qo'shamiz
    if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
        article.thumbnail_url = imageUrl;
    }

    return article;
}
