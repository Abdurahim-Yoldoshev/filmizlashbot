const bot = require("./bot");
const { searchMoviesByName, getMovie } = require("../base/models/movies.model");
const { searchSeriesByName, getSeries } = require("../base/models/series.model");

function safeCaption(text) {
  if (!text) return "";
  return text.replace(/<[^>]*>/gm, "").trim();
}

function cleanCaption(text) {
  if (!text) return "";
  let t = safeCaption(text);
  const lines = t.split("\n");
  const filtered = [];
  for (const line of lines) {
    const l = line.trim();
    if (l.includes("YANGI KINO") || l.includes("YANGI SERIAL")) continue;
    if (/^[🎬📺]?\s*Kodi:\s*\d+\s*$/.test(l)) continue;
    if (l.includes("Tomosha qilish uchun")) continue;
    filtered.push(line);
  }
  return filtered.join("\n").trim();
}

function buildTrellerHeader(trailerUrl) {
  if (trailerUrl) {
    return `<a href="${trailerUrl}">🎬 Treller</a>`;
  }
  return `🎬 Treller`;
}

function buildCaptionText(type, code, plain, trailerUrl) {
  const header = buildTrellerHeader(trailerUrl);
  const prefix =
    type === "movie"
      ? `${header}\n\n🎬 Kodi: ${code}\n\n`
      : `${header}\n\n📺 Kodi: ${code}\n\n`;
  const suffix =
    type === "movie"
      ? `\n\n🎬 Tomosha qilish uchun quyidagi tugmani bosing 👇`
      : `\n\n📺 Tomosha qilish uchun quyidagi tugmani bosing 👇`;
  const full = prefix + plain + suffix;
  return full.length > 4000 ? full.substring(0, 3990) + "..." : full;
}

function toJpegUrl(url) {
  if (!url) return null;
  if (!url.startsWith("http")) return null;
  return url.replace(/\.webp$/i, ".jpg");
}

let cachedBotUsername = null;

bot.on("inline_query", async (query) => {
  const queryText = query.query.trim();

  if (!cachedBotUsername) {
    try {
      const info = await bot.getMe();
      cachedBotUsername = info.username;
    } catch (e) {}
  }
  const botUsername = cachedBotUsername || "kino_bot";

  // MUHIM TARTIB: node-telegram-bot-api button obyektini stringify qilishi shart!
  const inlineOptions = {
    cache_time: 0,
    is_personal: true,
    button: JSON.stringify({
      text: "🎬 Barcha filmlarni ko'rish",
      start_parameter: "channels",
    }),
  };

  // ==========================================
  // QIDIRUV VA BAZADAN OLISH
  // ==========================================
  let movies = [];
  let seriesList = [];

  try {
    if (!queryText) {
      // Qidiruv bo'sh bo'lsa, oxirgi 25 ta kino va serialni olib kelamiz
      const db = require('../base/db');
      const [mRes, sRes] = await Promise.all([
        db.execute('SELECT * FROM movies ORDER BY id DESC LIMIT 24'),
        db.execute('SELECT * FROM series ORDER BY id DESC LIMIT 24')
      ]);
      movies = mRes.rows || [];
      seriesList = sRes.rows || [];
    } else {
      const isCode = /^\d+$/.test(queryText);
      if (isCode) {
        const code = parseInt(queryText);
        const [m, s] = await Promise.all([getMovie(code), getSeries(code)]);
        if (m) movies.push(m);
        if (s) seriesList.push(s);
      } else {
        [movies, seriesList] = await Promise.all([
          searchMoviesByName(queryText),
          searchSeriesByName(queryText),
        ]);
      }
    }
  } catch (dbErr) {
    console.error("[Inline] DB xato:", dbErr.message);
    return bot.answerInlineQuery(query.id, [], inlineOptions).catch(() => {});
  }

  const results = [];

  // DB dan nomalum bo'lib kelib qolsa, iteratsiyada qotib qolmasligi uchun himoya qo'shildi ( || [] )
  for (const item of (movies || [])) {
    try {
      results.push(buildResult(item, "movie", botUsername));
    } catch (e) {
      console.error(`[Inline] movie ${item.code} xato:`, e.message);
    }
  }
  for (const item of (seriesList || [])) {
    try {
      results.push(buildResult(item, "series", botUsername));
    } catch (e) {
      console.error(`[Inline] series ${item.code} xato:`, e.message);
    }
  }

  console.log(`[Inline] "${queryText}" => ${results.length} natija`);

  // Telegram API limitini hisobga olish (maksimum 50)
  const finalResults = results.slice(0, 50);

  try {
    await bot.answerInlineQuery(query.id, finalResults, inlineOptions);
  } catch (firstErr) {
    const errMsg = firstErr.response ? JSON.stringify(firstErr.response.body) : firstErr.message;
    console.error("[Inline] 1-urinish xato:", errMsg);

    try {
      const fallback = finalResults.map((r) => toArticle(r));
      await bot.answerInlineQuery(query.id, fallback, inlineOptions);
    } catch (secondErr) {
      console.error("[Inline] 2-urinish ham xato:", secondErr.message);
    }
  }
});

// Har qanday natijani sof article ga o'tkazish
function toArticle(r) {
  if (r.type === "article") return r;
  const text = r.caption || r.input_message_content?.message_text || r.title || "";
  return {
    type: "article",
    id: r.id + "_fb",
    title: r.title || "",
    description: r.description || "",
    input_message_content: { message_text: text.substring(0, 4096) || r.title },
    reply_markup: r.reply_markup,
  };
}

function buildResult(item, type, botUsername) {
  const code = item.code;
  const plain = cleanCaption(item.caption);
  const icon = type === "movie" ? "🎬" : "📺";

  let label = "";
  if (type === "movie") {
    const m = item.caption ? item.caption.match(/Kino nomi:\s*(.+)/) : null;
    label = item.title || (m ? m[1].trim() : `Kino ${code}`);
  } else {
    const m = item.caption ? item.caption.match(/Serial nomi:\s*(.+)/) : null;
    label = item.title || (m ? m[1].trim() : `Serial ${code}`);
  }

  const trailerUrl = item.trailer_url || null;
  const captionText = buildCaptionText(type, code, plain, trailerUrl);
  const shortCaption =
    captionText.length > 1024
      ? captionText.substring(0, 1020) + "..."
      : captionText;
  const inline_keyboard = [
    [
      {
        text: "▶️ Tomosha qilish",
        url: `https://t.me/${botUsername || "kino_bot"}?start=${code}`,
      },
    ],
  ];

  if (item.poster_url && item.poster_url.startsWith("http")) {
    const imgUrl = toJpegUrl(item.poster_url);
    return {
      type: "photo",
      id: `${type}_${code}_photo`,
      photo_url: imgUrl,
      thumb_url: imgUrl,
      title: `${icon} ${label}`,
      description: `Kod: ${code}`,
      caption: shortCaption,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard },
    };
  }

  if (item.trailer_file_id && !item.trailer_file_id.startsWith("http")) {
    return {
      type: "cached_video",
      id: `${type}_${code}_video`,
      video_file_id: item.trailer_file_id,
      title: `${icon} ${label}`,
      description: `Kod: ${code}`,
      caption: shortCaption,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard },
    };
  }

  return {
    type: "article",
    id: `${type}_${code}_article`,
    title: `${icon} ${label}`,
    description: trailerUrl
      ? `🎬 Treller mavjud  •  Kod: ${code}`
      : `Kod: ${code} • Tomosha qilish uchun bosing`,
    input_message_content: {
      message_text: captionText.substring(0, 4096),
      parse_mode: "HTML",
    },
    reply_markup: { inline_keyboard },
  };
}