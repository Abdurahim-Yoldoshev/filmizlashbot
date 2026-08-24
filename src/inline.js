const bot = require('./bot');
const { searchMoviesByName, getMovie } = require('../base/models/movies.model');
const { searchSeriesByName, getSeries } = require('../base/models/series.model');

function safeCaption(text) {
    if (!text) return '';
    return text.replace(/<[^>]*>/gm, '').trim();
}

// Bazadagi eski sarlavha, kod va tugma yozuvlarini olib tashlaydi
function cleanCaption(text) {
    if (!text) return '';
    let t = safeCaption(text);

    // Satrni qatorlarga ajratib, keraksizlarini olib tashlaymiz
    const lines = t.split('\n');
    const filtered = [];
    for (const line of lines) {
        const l = line.trim();
        // Eski olov sarlavhalarini o'tkazib yuboramiz
        if (l.includes('YANGI KINO') || l.includes('YANGI SERIAL')) continue;
        // Kodi: X qatorini o'tkazib yuboramiz (bizning prefix qo'shadi)
        if (/^[🎬📺]?\s*Kodi:\s*\d+\s*$/.test(l)) continue;
        // Tomosha qilish tugmasi yozuvini o'tkazib yuboramiz
        if (l.includes('Tomosha qilish uchun')) continue;
        filtered.push(line);
    }

    // Boshdagi va oxirdagi bo'sh qatorlarni olib tashlaymiz
    return filtered.join('\n').trim();
}


// "Treller" — agar trailerUrl bo'lsa HTML link, bo'lmasa oddiy matn
function buildTrellerHeader(trailerUrl) {
    if (trailerUrl) {
        return `<a href="${trailerUrl}">🎬 Treller</a>`;
    }
    return `🎬 Treller`;
}

function buildCaptionText(type, code, plain, trailerUrl) {
    const header = buildTrellerHeader(trailerUrl);
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
    
    if (!cachedBotUsername) {
        try {
            const info = await bot.getMe();
            cachedBotUsername = info.username;
        } catch (e) {}
    }
    const botUsername = cachedBotUsername || 'kino_bot';
    
    // Telegram'ning yuqorida chiqib turadigan maxsus botga yo'naltiruvchi tugmasi
    const inlineOptions = {
        cache_time: 0,
        button: {
            text: "🎬 Barcha kinolarni ko'rish uchun bosing",
            start_parameter: "all"
        }
    };

    if (!queryText) {
        const defaultResult = [{
            type: 'article',
            id: 'default_search',
            title: '🎬 Barcha kinolarni ko\'rish',
            description: "@filmlarbuluti kanaliga o'tish uchun bosing",
            input_message_content: { message_text: '🎬 Barcha kinolar va seriallarni maxsus kanalimizdan topishingiz va tomosha qilishingiz mumkin!' },
            reply_markup: {
                inline_keyboard: [[
                    { text: '▶️ Kanalga o\'tish', url: `https://t.me/filmlarbuluti` }
                ]]
            }
        }];
        return bot.answerInlineQuery(query.id, defaultResult, inlineOptions).catch(() => {});
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
        return bot.answerInlineQuery(query.id, [], inlineOptions).catch(() => {});
    }

    const results = [];

    // Har doim birinchi bo'lib chiqadigan kanal reklamasi (Article)
    results.push({
        type: 'article',
        id: 'channel_promo',
        title: "🎬 Barcha kinolar va seriallar",
        description: "@filmlarbuluti kanaliga o'tish uchun bosing",
        input_message_content: {
            message_text: "🎬 <b>Barcha kinolar va seriallarni maxsus kanalimizdan topishingiz va tomosha qilishingiz mumkin!</b>",
            parse_mode: 'HTML'
        },
        reply_markup: {
            inline_keyboard: [
                [{ text: "▶️ Kanalga o'tish", url: "https://t.me/filmlarbuluti" }]
            ]
        }
    });

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
        await bot.answerInlineQuery(query.id, finalResults, inlineOptions);
    } catch (firstErr) {
        const errMsg = firstErr.response ? JSON.stringify(firstErr.response.body) : firstErr.message;
        console.error('[Inline] 1-urinish xato:', errMsg);

        // 2-urinish: faqat article (rasmsiz, sof matn)
        try {
            const fallback = finalResults.map(r => toArticle(r));
            await bot.answerInlineQuery(query.id, fallback, inlineOptions);
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
    const plain = cleanCaption(item.caption);
    const icon = type === 'movie' ? '🎬' : '📺';

    let label = '';
    if (type === 'movie') {
        const m = item.caption ? item.caption.match(/Kino nomi:\s*(.+)/) : null;
        label = item.title || (m ? m[1].trim() : `Kino ${code}`);
    } else {
        const m = item.caption ? item.caption.match(/Serial nomi:\s*(.+)/) : null;
        label = item.title || (m ? m[1].trim() : `Serial ${code}`);
    }

    // trailer_url ni HTML link sifatida ishlatamiz
    const trailerUrl = item.trailer_url || null;
    const captionText = buildCaptionText(type, code, plain, trailerUrl);
    const shortCaption = captionText.length > 1024 ? captionText.substring(0, 1020) + '...' : captionText;
    const inline_keyboard = [[
        { text: '▶️ Tomosha qilish', url: `https://t.me/${botUsername || 'kino_bot'}?start=${code}` }
    ]];

    // 1-prioritet: poster_url (Asilmedia yoki boshqa global manbadan kelgan URL)
    if (item.poster_url && item.poster_url.startsWith('http')) {
        const imgUrl = toJpegUrl(item.poster_url);
        return {
            type: 'photo',
            id: `${type}_${code}_photo`,
            photo_url: imgUrl,
            thumb_url: imgUrl,
            title: `${icon} ${label}`,
            description: `Kod: ${code}`,
            caption: shortCaption,
            parse_mode: 'HTML',
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
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard }
        };
    }

    // 3-prioritet: rasm/video yo'q bo'lsa — Treller havolali article
    return {
        type: 'article',
        id: `${type}_${code}_article`,
        title: `${icon} ${label}`,
        description: trailerUrl ? `🎬 Treller mavjud  •  Kod: ${code}` : `Kod: ${code} • Tomosha qilish uchun bosing`,
        input_message_content: {
            message_text: captionText.substring(0, 4096),
            parse_mode: 'HTML'
        },
        reply_markup: { inline_keyboard }
    };
}

