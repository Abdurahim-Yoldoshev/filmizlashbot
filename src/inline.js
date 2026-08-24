const bot = require('./bot');
const { searchMoviesByName, getMovie } = require('../base/models/movies.model');
const { searchSeriesByName, getSeries } = require('../base/models/series.model');

// Caption dan HTML teglarni tozalab, 900 belgidan qisqa qilamiz
function safeCaption(text) {
    if (!text) return '';
    const plain = text.replace(/<[^>]*>/gm, '').trim();
    return plain.length > 900 ? plain.substring(0, 900) + '...' : plain;
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
        try { results.push(buildResult(item, 'movie', botUsername)); } catch (e) {}
    }
    for (const item of seriesList) {
        try { results.push(buildResult(item, 'series', botUsername)); } catch (e) {}
    }

    console.log(`[Inline] "${queryText}" => ${results.length} natija (${movies.length} kino, ${seriesList.length} serial)`);

    bot.answerInlineQuery(query.id, results, { cache_time: 0 })
        .catch(e => {
            const desc = e.response ? JSON.stringify(e.response.body) : e.message;
            console.error('[Inline] answerInlineQuery xato:', desc);
        });
});

function buildResult(item, type, botUsername) {
    const code = item.code;
    const plain = safeCaption(item.caption);

    let label = '';
    let captionText = '';
    const icon = type === 'movie' ? '🎬' : '📺';

    if (type === 'movie') {
        const m = item.caption ? item.caption.match(/Kino nomi:\s*(.+)/) : null;
        label = item.title || (m ? m[1].trim() : `Kino ${code}`);
        captionText = `🔥 YANGI KINO! 🔥\n\n🎬 Kodi: ${code}\n\n${plain}\n\n🎬 Tomosha qilish uchun quyidagi tugmani bosing 👇`;
    } else {
        const m = item.caption ? item.caption.match(/Serial nomi:\s*(.+)/) : null;
        label = item.title || (m ? m[1].trim() : `Serial ${code}`);
        captionText = `🔥 YANGI SERIAL! 🔥\n\n📺 Kodi: ${code}\n\n${plain}\n\n📺 Tomosha qilish uchun quyidagi tugmani bosing 👇`;
    }

    const inline_keyboard = [[
        { text: '▶️ Tomosha qilish', url: `https://t.me/${botUsername}?start=${code}` }
    ]];

    // 1-ustuvorlik: kanalga yuborilganda saqlangan aniq file_id dan foydalanamiz
    const channelFileId = item.channel_file_id;
    const channelFileType = item.channel_file_type;

    if (channelFileId && channelFileType) {
        if (channelFileType === 'photo') {
            return {
                type: 'cached_photo',
                id: `${type}_${code}`,
                photo_file_id: channelFileId,
                title: `${icon} ${label}`,
                description: `Kod: ${code}`,
                caption: captionText,
                reply_markup: { inline_keyboard }
            };
        } else if (channelFileType === 'video') {
            return {
                type: 'cached_video',
                id: `${type}_${code}`,
                video_file_id: channelFileId,
                title: `${icon} ${label}`,
                description: `Kod: ${code}`,
                caption: captionText,
                reply_markup: { inline_keyboard }
            };
        }
    }

    // 2-ustuvorlik: trailer_file_id HTTP URL bo'lsa (TMDb poster)
    const trailerFileId = item.trailer_file_id;
    if (trailerFileId && trailerFileId.startsWith('http')) {
        return {
            type: 'photo',
            id: `${type}_${code}`,
            photo_url: trailerFileId,
            thumb_url: trailerFileId,
            title: `${icon} ${label}`,
            description: `Kod: ${code}`,
            caption: captionText,
            reply_markup: { inline_keyboard }
        };
    }

    // Fallback: article (har doim ishlaydi)
    return {
        type: 'article',
        id: `${type}_${code}`,
        title: `${icon} ${label}`,
        description: `Kod: ${code} • Tomosha qilish uchun bosing`,
        input_message_content: {
            message_text: captionText
        },
        reply_markup: { inline_keyboard }
    };
}
