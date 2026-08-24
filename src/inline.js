const bot = require('./bot');
const { searchMoviesByName, getMovie } = require('../base/models/movies.model');
const { searchSeriesByName, getSeries } = require('../base/models/series.model');

// Caption dan HTML teglarni tozalab, 1024 belgidan qisqa qilamiz
function safeCaption(text) {
    if (!text) return '';
    // HTML teglarni olib tashlaymiz — xavfsiz plain text
    const plain = text.replace(/<[^>]*>/gm, '');
    return plain.length > 900 ? plain.substring(0, 900) + '...' : plain;
}

let cachedBotUsername = null;

bot.on('inline_query', async (query) => {
    const text = query.query.trim();
    if (!text) {
        return bot.answerInlineQuery(query.id, [], { cache_time: 0 }).catch(() => {});
    }

    let movies = [];
    let seriesList = [];

    try {
        const isCode = /^\d+$/.test(text);
        if (isCode) {
            const code = parseInt(text);
            const [m, s] = await Promise.all([getMovie(code), getSeries(code)]);
            if (m) movies.push(m);
            if (s) seriesList.push(s);
        } else {
            [movies, seriesList] = await Promise.all([
                searchMoviesByName(text),
                searchSeriesByName(text)
            ]);
        }
    } catch (dbErr) {
        console.error('[Inline] DB xato:', dbErr.message);
        return bot.answerInlineQuery(query.id, [], { cache_time: 0 }).catch(() => {});
    }

    if (!cachedBotUsername) {
        try {
            const botInfo = await bot.getMe();
            cachedBotUsername = botInfo.username;
        } catch (e) {
            console.error('[Inline] getMe xato:', e.message);
        }
    }
    const botUsername = cachedBotUsername || '';

    const buildResult = (item, type) => {
        const code = item.code;
        const plain = safeCaption(item.caption);

        let label = '';
        let captionText = '';
        if (type === 'movie') {
            const titleMatch = item.caption ? item.caption.match(/Kino nomi:\s*(.+)/) : null;
            label = `🎬 ${item.title || (titleMatch ? titleMatch[1].trim() : `Kino ${code}`)}`;
            captionText = `🔥 YANGI KINO! 🔥\n\n🎬 Kodi: ${code}\n\n${plain}\n\n🎬 Tomosha qilish uchun quyidagi tugmani bosing 👇`;
        } else {
            const titleMatch = item.caption ? item.caption.match(/Serial nomi:\s*(.+)/) : null;
            label = `📺 ${item.title || (titleMatch ? titleMatch[1].trim() : `Serial ${code}`)}`;
            captionText = `🔥 YANGI SERIAL! 🔥\n\n📺 Kodi: ${code}\n\n${plain}\n\n📺 Tomosha qilish uchun quyidagi tugmani bosing 👇`;
        }

        const inline_keyboard = [[
            { text: '▶️ Tomosha qilish', url: `https://t.me/${botUsername}?start=${code}` }
        ]];

        const trailerFileId = item.trailer_file_id;
        const mainFileId = item.file_id;

        // URL rasm bo'lsa (TMDb poster URL)
        if (trailerFileId && trailerFileId.startsWith('http')) {
            return {
                type: 'photo',
                id: `${type}_${code}`,
                photo_url: trailerFileId,
                thumb_url: trailerFileId,
                title: label,
                description: `Kod: ${code}`,
                caption: captionText,
                reply_markup: { inline_keyboard }
            };
        }

        // Telegram file_id bo'lsa — cached_video (treyler video ham bo'lishi mumkin)
        if (trailerFileId) {
            return {
                type: 'cached_video',
                id: `${type}_${code}`,
                video_file_id: trailerFileId,
                title: label,
                description: `Kod: ${code}`,
                caption: captionText,
                reply_markup: { inline_keyboard }
            };
        }

        // Asosiy video file_id
        if (mainFileId) {
            return {
                type: 'cached_video',
                id: `${type}_${code}`,
                video_file_id: mainFileId,
                title: label,
                description: `Kod: ${code}`,
                caption: captionText,
                reply_markup: { inline_keyboard }
            };
        }

        // Fallback — faqat matn
        return {
            type: 'article',
            id: `${type}_${code}`,
            title: label,
            description: `Kod: ${code}`,
            input_message_content: {
                message_text: captionText
            },
            reply_markup: { inline_keyboard }
        };
    };

    const results = [
        ...movies.map(m => buildResult(m, 'movie')),
        ...seriesList.map(s => buildResult(s, 'series'))
    ];

    console.log(`[Inline] "${text}" => ${results.length} natija (${movies.length} kino, ${seriesList.length} serial)`);

    try {
        await bot.answerInlineQuery(query.id, results, { cache_time: 0 });
    } catch (e) {
        console.error('[Inline] answerInlineQuery xato:', e.response ? JSON.stringify(e.response.body) : e.message);
    }
});
