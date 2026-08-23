const { checkMovieByUniqueId } = require('../../base/models/movies.model');
const { checkEpisodeByUniqueId } = require('../../base/models/series.model');

/**
 * Videosining yaroqliligini va takrorlanmasligini tekshirish
 * @param {Object} msg - Telegram message object
 * @returns {Promise<{valid: boolean, reason?: string, file_unique_id?: string}>}
 */
const validateVideo = async (msg) => {
    const video = msg.video || msg.document;

    if (!video) {
        return { valid: false, reason: "Iltimos, faqat video yoki hujjat yuboring." };
    }

    if (msg.video) {
        // Checking for minimal duration e.g., 3 seconds
        if (msg.video.duration && msg.video.duration < 3) {
            return { valid: false, reason: "Video juda qisqa. Kamida 3 soniya bo'lishi kerak." };
        }
    }

    if (video.file_size && video.file_size < 10240) { // kamida 10 KB
        return { valid: false, reason: "Fayl hajmi juda kichik. Iltimos, haqiqiy video fayl yuboring." };
    }

    // Checking if file is forwarded (just to handle the specific logic if needed)
    // Actually, uniqueness check does everything. The problem with forwarded messages 
    // is that they might have same file_unique_id.
    const file_unique_id = video.file_unique_id;

    // Bazadan tekshirish
    const existingMovie = await checkMovieByUniqueId(file_unique_id);
    if (existingMovie) {
        return { valid: false, reason: `Bu video allaqachon ${existingMovie.code} kodli kino sifatida bazaga qo'shilgan. Bitta kino ikki marta ishlatilmasligi kerak!` };
    }

    const existingEpisode = await checkEpisodeByUniqueId(file_unique_id);
    if (existingEpisode) {
        return { valid: false, reason: `Bu video allaqachon ${existingEpisode.series_code} kodli serialning ${existingEpisode.episode_num}-qismi sifatida bazaga qo'shilgan. Bitta video ikki marta ishlatilmasligi kerak!` };
    }

    return { valid: true, file_unique_id };
};

module.exports = { validateVideo };
