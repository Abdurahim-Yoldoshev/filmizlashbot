const bot = require('./bot');
const { searchMoviesByName, getMovie } = require('../base/models/movies.model');
const { searchSeriesByName, getSeries } = require('../base/models/series.model');

function safeCaption(itemCaption) {
    if (!itemCaption) return '';
    if (itemCaption.length <= 850) return itemCaption;
    // Tahrirlangan matnda ochilib yopilmagan HTML teglar qolmasligi uchun barcha teglarni olib tashlaymiz
    let stripped = itemCaption.replace(/<[^>]*>?/gm, '');
    if (stripped.length > 850) {
        return stripped.substring(0, 850) + '...';
    }
    return stripped;
}

let cachedBotUsername = null;

bot.on('inline_query', async (query) => {
    const text = query.query.trim();
    if (!text) {
        return bot.answerInlineQuery(query.id, []);
    }

    const isCode = /^\d+$/.test(text);
    let movies = [];
    let seriesList = [];

    if (isCode) {
        const code = parseInt(text);
        const m = await getMovie(code);
        if (m) movies.push(m);
        const s = await getSeries(code);
        if (s) seriesList.push(s);
    } else {
        movies = await searchMoviesByName(text);
        seriesList = await searchSeriesByName(text);
    }

    if (!cachedBotUsername) {
        const botInfo = await bot.getMe();
        cachedBotUsername = botInfo.username;
    }
    const botUsername = cachedBotUsername;

    const processItem = async (item, type) => {
        let captionText = '';
        let title = '';
        let safeCap = safeCaption(item.caption);
        
        if (type === 'movie') {
            captionText = `🔥 <b>YANGI KINO!</b> 🔥\n\n🎬 <b>Kodi:</b> ${item.code}\n\n${safeCap}\n\n🎬 Tomosha qilish uchun quyidagi tugmani bosing 👇`;
            const titleMatch = item.caption ? item.caption.match(/Kino nomi:\s*(.+)/) : null;
            title = item.title || (titleMatch ? titleMatch[1] : `Kino ${item.code}`);
            title = `🎬 ${title}`;
        } else if (type === 'series') {
            captionText = `🔥 <b>YANGI SERIAL!</b> 🔥\n\n📺 <b>Kodi:</b> ${item.code}\n\n${safeCap}\n\n📺 Tomosha qilish uchun quyidagi tugmani bosing 👇`;
            const titleMatch = item.caption ? item.caption.match(/Serial nomi:\s*(.+)/) : null;
            title = item.title || (titleMatch ? titleMatch[1] : `Serial ${item.code}`);
            title = `📺 ${title}`;
        }

        const inline_keyboard = [
            [{ text: "▶️ Tomosha qilish", url: `https://t.me/${botUsername}?start=${item.code}` }]
        ];

        let result = null;
        let fileId = item.trailer_file_id || item.file_id;

        if (!fileId) {
            return {
                type: 'article',
                id: `${type}_${item.code}`,
                title: title,
                description: `Kod: ${item.code}`,
                input_message_content: {
                    message_text: captionText,
                    parse_mode: 'HTML'
                },
                reply_markup: { inline_keyboard }
            };
        }

        if (fileId.startsWith('http')) {
            return {
                type: 'photo',
                id: `${type}_${item.code}`,
                photo_url: fileId,
                thumb_url: fileId,
                title: title,
                caption: captionText,
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard }
            };
        }

        try {
            const fileInfo = await bot.getFile(fileId);
            const path = fileInfo.file_path || '';
            
            if (path.includes('video') || path.endsWith('.mp4')) {
                return {
                    type: 'cached_video',
                    id: `${type}_${item.code}`,
                    video_file_id: fileId,
                    title: title,
                    caption: captionText,
                    parse_mode: 'HTML',
                    reply_markup: { inline_keyboard }
                };
            } else if (path.includes('photo') || path.endsWith('.jpg') || path.endsWith('.png')) {
                return {
                    type: 'cached_photo',
                    id: `${type}_${item.code}`,
                    photo_file_id: fileId,
                    title: title,
                    caption: captionText,
                    parse_mode: 'HTML',
                    reply_markup: { inline_keyboard }
                };
            } else {
                return {
                    type: 'cached_document',
                    id: `${type}_${item.code}`,
                    document_file_id: fileId,
                    title: title,
                    caption: captionText,
                    parse_mode: 'HTML',
                    reply_markup: { inline_keyboard }
                };
            }
        } catch (e) {
            // Fallback if getFile fails
            return {
                type: 'article',
                id: `${type}_${item.code}`,
                title: title,
                description: `Kod: ${item.code}`,
                input_message_content: {
                    message_text: captionText,
                    parse_mode: 'HTML'
                },
                reply_markup: { inline_keyboard }
            };
        }
    };

    try {
        let results = [];
        const moviePromises = movies.map(m => processItem(m, 'movie'));
        const seriesPromises = seriesList.map(s => processItem(s, 'series'));
        
        const resolvedMovies = await Promise.all(moviePromises);
        const resolvedSeries = await Promise.all(seriesPromises);
        
        results = [...resolvedMovies, ...resolvedSeries].filter(r => r !== null);

        await bot.answerInlineQuery(query.id, results, { cache_time: 0 });
    } catch (e) {
        console.error("Inline query error:", e);
    }
});
