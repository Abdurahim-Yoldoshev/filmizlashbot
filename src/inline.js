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

        // trailer_file_id = poster rasm, file_id = to'liq video
        // Avval treyler rasmini ishlatishga harakat qilamiz
        const trailerFileId = item.trailer_file_id;
        const mainFileId = item.file_id;

        // 1. Agar treyler file_id mavjud va URL bo'lsa — photo inline
        if (trailerFileId && trailerFileId.startsWith('http')) {
            return {
                type: 'photo',
                id: `${type}_${item.code}`,
                photo_url: trailerFileId,
                thumb_url: trailerFileId,
                title: title,
                caption: captionText,
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard }
            };
        }

        // 2. Agar treyler Telegram file_id bo'lsa — cached_photo (treyler asosan photo/video)
        if (trailerFileId) {
            // Avval photo sifatida sinab ko'ramiz
            return {
                type: 'cached_photo',
                id: `${type}_${item.code}`,
                photo_file_id: trailerFileId,
                title: title,
                caption: captionText,
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard }
            };
        }

        // 3. Agar faqat asosiy video file_id mavjud bo'lsa — cached_video
        if (mainFileId) {
            return {
                type: 'cached_video',
                id: `${type}_${item.code}`,
                video_file_id: mainFileId,
                title: title,
                caption: captionText,
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard }
            };
        }

        // 4. Hech qanday fayl yo'q — faqat matn
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
