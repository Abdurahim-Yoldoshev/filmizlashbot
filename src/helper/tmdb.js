const axios = require('axios');

const TMDB_API_KEY = process.env.TMDB_API_KEY; // The user will need to add this to .env

// Helper: Free Google Translate API to Uzbek
const translateToUzbek = async (text) => {
    if (!text) return '';
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=uz&dt=t&q=${encodeURIComponent(text)}`;
        const res = await axios.get(url);
        if (res.data && res.data[0]) {
            return res.data[0].map(s => s[0]).join('');
        }
    } catch (err) {
        console.error("Translation error:", err.message);
    }
    return text;
};

// Helper: Free Google Translate API to English
const translateToEnglish = async (text) => {
    if (!text) return '';
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
        const res = await axios.get(url);
        if (res.data && res.data[0]) {
            return res.data[0].map(s => s[0]).join('');
        }
    } catch (err) {
        console.error("Translation to English error:", err.message);
    }
    return text;
};

const searchMovieTmdb = async (query) => {
    if (!TMDB_API_KEY) return [];
    try {
        const url1 = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=uz-UZ`;
        const res1 = await axios.get(url1);
        let results = res1.data.results || [];

        const englishQuery = await translateToEnglish(query);
        if (englishQuery && englishQuery.toLowerCase() !== query.toLowerCase()) {
            const url2 = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(englishQuery)}&language=uz-UZ`;
            const res2 = await axios.get(url2);
            const engResults = res2.data.results || [];
            
            const existingIds = new Set(results.map(r => r.id));
            engResults.forEach(r => {
                if (!existingIds.has(r.id)) {
                    results.push(r);
                    existingIds.add(r.id);
                }
            });
        }
        return results;
    } catch (err) {
        console.error("TMDb search error:", err.message);
        return [];
    }
};

const getMovieDetailsTmdb = async (tmdbId) => {
    if (!TMDB_API_KEY) return null;
    try {
        const url = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=uz-UZ`;
        const res = await axios.get(url);
        const data = res.data;

        // If overview is missing in Uzbek, fetch English and translate
        let overview = data.overview;
        if (!overview) {
            const enUrl = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`;
            const enRes = await axios.get(enUrl);
            if (enRes.data && enRes.data.overview) {
                overview = await translateToUzbek(enRes.data.overview);
            }
        }

        const genres = data.genres ? data.genres.map(g => g.name).join(', ') : 'Noma\'lum';
        const year = data.release_date ? data.release_date.split('-')[0] : 'Noma\'lum';
        const rating = data.vote_average ? data.vote_average.toFixed(1) : 'Noma\'lum';
        
        let title = data.title;
        title = await translateToUzbek(title);
        
        // Translate genres if they are in English (TMDB often returns English for uz-UZ if it's missing)
        const translatedGenres = await translateToUzbek(genres);
        
        let finalGenres = translatedGenres;
        if (finalGenres && finalGenres !== "Noma'lum") {
            finalGenres = finalGenres.split(',').map(g => {
                let text = g.trim();
                // Ba'zida tarjima bo'lsa yoki bo'sh bo'lsa
                if (!text) return '';
                // Probeldarni ostki chiziqqa almashtiramiz
                return '#' + text.replace(/\s+/g, '_');
            }).filter(g => g).join(' ');
        }

        const caption = `🎬 Kino nomi: ${title}\n📅 Yili: ${year}\n🎭 Janr: ${finalGenres}\n⭐️ IMDb: ${rating}\n📺 Sifati: 720p\n📝 Mazmuni: ${overview || 'Kiritilmagan'}`;

        const poster_url = data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null;

        return { caption, poster_url };
    } catch (err) {
        console.error("TMDb details error:", err.message);
        return null;
    }
};

const searchSeriesTmdb = async (query) => {
    if (!TMDB_API_KEY) return [];
    try {
        const url1 = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=uz-UZ`;
        const res1 = await axios.get(url1);
        let results = res1.data.results || [];

        const englishQuery = await translateToEnglish(query);
        if (englishQuery && englishQuery.toLowerCase() !== query.toLowerCase()) {
            const url2 = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(englishQuery)}&language=uz-UZ`;
            const res2 = await axios.get(url2);
            const engResults = res2.data.results || [];
            
            const existingIds = new Set(results.map(r => r.id));
            engResults.forEach(r => {
                if (!existingIds.has(r.id)) {
                    results.push(r);
                    existingIds.add(r.id);
                }
            });
        }
        return results;
    } catch (err) {
        console.error("TMDb series search error:", err.message);
        return [];
    }
};

const getSeriesDetailsTmdb = async (tmdbId) => {
    if (!TMDB_API_KEY) return null;
    try {
        const url = `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=uz-UZ`;
        const res = await axios.get(url);
        const data = res.data;

        // If overview is missing in Uzbek, fetch English and translate
        let overview = data.overview;
        if (!overview) {
            const enUrl = `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`;
            const enRes = await axios.get(enUrl);
            if (enRes.data && enRes.data.overview) {
                overview = await translateToUzbek(enRes.data.overview);
            }
        }

        const genres = data.genres ? data.genres.map(g => g.name).join(', ') : 'Noma\'lum';
        const year = data.first_air_date ? data.first_air_date.split('-')[0] : 'Noma\'lum';
        const rating = data.vote_average ? data.vote_average.toFixed(1) : 'Noma\'lum';
        
        let title = data.name;
        title = await translateToUzbek(title);
        
        // Translate genres if they are in English (TMDB often returns English for uz-UZ if it's missing)
        const translatedGenres = await translateToUzbek(genres);
        
        let finalGenres = translatedGenres;
        if (finalGenres && finalGenres !== "Noma'lum") {
            finalGenres = finalGenres.split(',').map(g => {
                let text = g.trim();
                if (!text) return '';
                return '#' + text.replace(/\s+/g, '_');
            }).filter(g => g).join(' ');
        }

        const caption = `📺 Serial nomi: ${title}\n📅 Yili: ${year}\n🎭 Janr: ${finalGenres}\n⭐️ IMDb: ${rating}\n📺 Sifati: 720p\n📝 Mazmuni: ${overview || 'Kiritilmagan'}`;

        const poster_url = data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null;

        return { caption, poster_url };
    } catch (err) {
        console.error("TMDb series details error:", err.message);
        return null;
    }
};

module.exports = {
    searchMovieTmdb,
    getMovieDetailsTmdb,
    searchSeriesTmdb,
    getSeriesDetailsTmdb
};
