/**
 * asilmedia.js
 * Asilmedia.org saytidan kino nomini qidirib, poster URL sini topib qaytaradi.
 * Qidiruv: https://asilmedia.org/?do=search&subaction=search&story={query}
 * Rasm: <img src="https://asilmedia.org/rasmlar/images/..." ...> formati
 */

const axios = require('axios');

const BASE_URL = 'https://asilmedia.org';
const SEARCH_URL = `${BASE_URL}/?do=search&subaction=search&story=`;

// Rasmni HTML dan topib olamiz
function extractFirstImageUrl(html) {
    // Asilmedia rasmlar patterhi: /rasmlar/images/ yoki /uploads/
    const patterns = [
        // Asosiy kino posteri
        /src="(https:\/\/asilmedia\.org\/rasmlar\/images\/[^"]+\.(webp|jpg|jpeg|png))"/i,
        /src="(\/rasmlar\/images\/[^"]+\.(webp|jpg|jpeg|png))"/i,
        // Upload papkasidagi rasmlar
        /src="(https:\/\/asilmedia\.org\/uploads\/[^"]+\.(webp|jpg|jpeg|png))"/i,
        /src="(\/uploads\/[^"]+\.(webp|jpg|jpeg|png))"/i,
    ];

    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) {
            const url = match[1];
            return url.startsWith('http') ? url : `${BASE_URL}${url}`;
        }
    }
    return null;
}

// Birinchi kino sahifasiga o'tib, asosiy posterini olamiz
async function fetchPosterFromPage(pageUrl) {
    try {
        const resp = await axios.get(pageUrl, {
            timeout: 8000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept-Language': 'uz,ru;q=0.9,en;q=0.8'
            }
        });

        const html = resp.data;

        // Kino detail sahifasidagi birinchi katta rasmni topamiz
        // Odatda full story sahifasida <img class="poster" ...> yoki birinchi katta rasm
        const imgMatch = html.match(
            /src="((?:https:\/\/asilmedia\.org)?\/rasmlar\/images\/[^"]+\.(webp|jpg|jpeg|png))"/i
        ) || html.match(
            /src="((?:https:\/\/asilmedia\.org)?\/uploads\/[^"]+\.(webp|jpg|jpeg|png))"/i
        );

        if (imgMatch) {
            const url = imgMatch[1];
            return url.startsWith('http') ? url : `${BASE_URL}${url}`;
        }
        return null;
    } catch (e) {
        return null;
    }
}

/**
 * Kino nomi bo'yicha asilmedia.org dan poster URL topadi
 * @param {string} movieName - Kino nomi
 * @returns {Promise<string|null>} - Poster URL yoki null
 */
const searchAsilmediaPoster = async (movieName) => {
    try {
        const query = encodeURIComponent(movieName.trim());
        const searchUrl = `${SEARCH_URL}${query}`;

        const resp = await axios.get(searchUrl, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept-Language': 'uz,ru;q=0.9,en;q=0.8'
            }
        });

        const html = resp.data;

        // Qidiruv natijalaridan birinchi kino sahifasi linkini topamiz
        // Pattern: <a href="https://asilmedia.org/{id}-{slug}.html"
        const linkMatch = html.match(
            /href="(https:\/\/asilmedia\.org\/\d+-[^"]+\.html)"/i
        );

        if (!linkMatch) {
            // Qidiruv natijasida bevosita rasm bor bo'lsa
            return extractFirstImageUrl(html);
        }

        const moviePageUrl = linkMatch[1];
        const poster = await fetchPosterFromPage(moviePageUrl);
        return poster;

    } catch (e) {
        console.error('[Asilmedia] Qidiruvda xato:', e.message);
        return null;
    }
};

/**
 * Kino sahifasi URL bo'yicha poster URL topadi
 * @param {string} pageUrl - Kino sahifasi URL (https://asilmedia.org/...)
 * @returns {Promise<string|null>}
 */
const getAsilmediaPosterByUrl = async (pageUrl) => {
    return fetchPosterFromPage(pageUrl);
};

module.exports = { searchAsilmediaPoster, getAsilmediaPosterByUrl };
