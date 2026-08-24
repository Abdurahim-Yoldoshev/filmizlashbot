const bot = require('./bot');
const { searchMoviesByName, getMovie } = require('../base/models/movies.model');
const { searchSeriesByName, getSeries } = require('../base/models/series.model');

function safeCaption(text) {
    if (!text) return '';
    return text.replace(/<[^>]*>/gm, '').trim();
}

// "Treller" so'zini o'rtada joylashtirib, 👉👈 bilan to'ldiradi
// Telegram xabar kengligiga moslashtirilgan (taxminan 32 ta belgi)
function buildTrellerHeader() {
    const word = ' Treller ';
    const totalWidth = 32; // Telegramda ko'rinadigan taxminiy kenglik
    const sideCount = Math.floor((totalWidth - word.length) / 2);
    const left = '👉'.repeat(Math.max(1, sideCount));
    const right = '👈'.repeat(Math.max(1, sideCount));
    return `${left}${word}${right}`;
}

function buildCaptionText(type, code, plain) {
    const header = buildTrellerHeader();
    const prefix = type === 'movie'
        ? `${header}\n\n🎬 Kodi: ${code}\n\n`
        : `${header}\n\n📺 Kodi: ${code}\n\n`;
    const suffix = type === 'movie'
        ? `\n\n🎬 Tomosha qilish uchun quyidagi tugmani bosing 👇`
        : `\n\n📺 Tomosha qilish uchun quyidagi tugmani bosing 👇`;
    const full = prefix + plain + suffix;
    return full.length > 4000 ? full.substring(0, 3990) + '...' : full;
}

// poster_url dan JPEG URL ni olish (WebP bo'lsa konvert qilish)
// Asilmedia yoki boshqa globaldan kelgan URL ni to'g'ri holda qaytaradi
function toJpegUrl(url) {
    if (!url) return null;
    if (!url.startsWith('http')) return null;
    // webp ni jpg ga almashtirib ko'ramiz (ba'zi CDNlar shu yo'lni qo'llab-quvvatlaydi)
    return url.replace(/\.webp$/i, '.jpg');
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

    // 1-urinish: asosiy natijalarni yuborib ko'ramiz (rasm/video bilan)
    try {
        await bot.answerInlineQuery(query.id, finalResults, { cache_time: 0 });
    } catch (firstErr) {
        const errMsg = firstErr.response ? JSON.stringify(firstErr.response.body) : firstErr.message;
        console.error('[Inline] 1-urinish xato:', errMsg);

        // 2-urinish: faqat article (rasmsiz, sof matn)
        try {
            const fallback = finalResults.map(r => toArticle(r));
            await bot.answerInlineQuery(query.id, fallback, { cache_time: 0 });
            console.log('[Inline] Fallback article bilan muvaffaqiyatli yuborildi');
        } catch (secondErr) {
            console.error('[Inline] 2-urinish ham xato:', secondErr.message);
        }
    }
});

// Har qanday natijani sof article ga o'tkazish (fallback)
function toArticle(r) {
    if (r.type === 'article') return r;
    const text = r.caption || r.input_message_content?.message_text || r.title || '';
    return {
        type: 'article',
        id: r.id + '_fb',
        title: r.title || '',
        description: r.description || '',
        input_message_content: { message_text: text.substring(0, 4096) || r.title },
        reply_markup: r.reply_markup
    };
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
    const shortCaption = captionText.length > 1024 ? captionText.substring(0, 1020) + '...' : captionText;
    const inline_keyboard = [[
        { text: '▶️ Tomosha qilish', url: `https://t.me/${botUsername || 'kino_bot'}?start=${code}` }
    ]];

    // 1-prioritet: poster_url (Asilmedia yoki boshqa global manbadan kelgan URL)
    if (item.poster_url && item.poster_url.startsWith('http')) {
        // WebP URL ni JPEG ga o'girib yuborib ko'ramiz
        const imgUrl = toJpegUrl(item.poster_url);
        return {
            type: 'photo',
            id: `${type}_${code}_photo`,
            photo_url: imgUrl,
            thumb_url: imgUrl,
            title: `${icon} ${label}`,
            description: `Kod: ${code}`,
            caption: shortCaption,
            reply_markup: { inline_keyboard }
        };
    }

    // 2-prioritet: trailer_file_id (Telegram kanalidan saqlangan video)
    if (item.trailer_file_id && !item.trailer_file_id.startsWith('http')) {
        return {
            type: 'cached_video',
            id: `${type}_${code}_video`,
            video_file_id: item.trailer_file_id,
            title: `${icon} ${label}`,
            description: `Kod: ${code}`,
            caption: shortCaption,
            reply_markup: { inline_keyboard }
        };
    }

    // 3-prioritet: rasm/video yo'q bo'lsa — Treller yozuvi bilan chiroyli article
    const header = buildTrellerHeader();
    return {
        type: 'article',
        id: `${type}_${code}_article`,
        title: `${icon} ${label}`,
        description: `${header}  •  Kod: ${code}`,
        input_message_content: { message_text: captionText.substring(0, 4096) },
        reply_markup: { inline_keyboard }
    };
}
