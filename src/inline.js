const bot = require('./bot');
const { searchMoviesByName, getMovie } = require('../base/models/movies.model');
const { searchSeriesByName, getSeries } = require('../base/models/series.model');

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

    const botInfo = await bot.getMe();
    const botUsername = botInfo.username;

    let results = [];

    const processItem = (item, type) => {
        let captionText = '';
        let title = '';
        
        if (type === 'movie') {
            captionText = `🔥 <b>YANGI KINO!</b> 🔥\n\n🎬 <b>Kodi:</b> ${item.code}\n\n${item.caption || ''}\n\n🎬 Tomosha qilish uchun quyidagi tugmani bosing 👇`;
            const titleMatch = item.caption ? item.caption.match(/Kino nomi:\s*(.+)/) : null;
            title = item.title || (titleMatch ? titleMatch[1] : `Kino ${item.code}`);
            title = `🎬 ${title}`;
        } else if (type === 'series') {
            captionText = `🔥 <b>YANGI SERIAL!</b> 🔥\n\n📺 <b>Kodi:</b> ${item.code}\n\n${item.caption || ''}\n\n📺 Tomosha qilish uchun quyidagi tugmani bosing 👇`;
            const titleMatch = item.caption ? item.caption.match(/Serial nomi:\s*(.+)/) : null;
            title = item.title || (titleMatch ? titleMatch[1] : `Serial ${item.code}`);
            title = `📺 ${title}`;
        }

        if (captionText.length > 1024) {
            captionText = captionText.substring(0, 1000) + '...';
        }

        const inline_keyboard = [
            [{ text: "▶️ Tomosha qilish", url: `https://t.me/${botUsername}?start=${item.code}` }]
        ];

        let result = null;
        let fileId = item.trailer_file_id || item.file_id;

        if (fileId && fileId.startsWith('http')) {
            result = {
                type: 'photo',
                id: `${type}_${item.code}`,
                photo_url: fileId,
                thumb_url: fileId,
                title: title,
                caption: captionText,
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard }
            };
        } else {
            // For file_ids, we can't reliably guess if it's photo or video in inline query. 
            // We use article with text.
            result = {
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
        return result;
    };

    for (const m of movies) {
        results.push(processItem(m, 'movie'));
    }
    for (const s of seriesList) {
        results.push(processItem(s, 'series'));
    }

    try {
        await bot.answerInlineQuery(query.id, results, { cache_time: 0 });
    } catch (e) {
        console.error("Inline query error:", e);
    }
});
