const db = require('../db');

/**
 * Kinolar jadvalini bazada yaratish
 */
const initMoviesTable = async () => {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS movies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_id TEXT NOT NULL,
                file_unique_id TEXT,
                trailer_file_id TEXT,
                code INTEGER UNIQUE NOT NULL,
                caption TEXT,
                title TEXT
            )
        `);
        // try to add file_unique_id and title columns if they don't exist
        try { await db.execute(`ALTER TABLE movies ADD COLUMN file_unique_id TEXT`); } catch (e) {}
        try { await db.execute(`ALTER TABLE movies ADD COLUMN title TEXT`); } catch (e) {}
        console.log("Movies modeli ishga tushdi.");
    } catch (error) {
        console.error("Movies modeli xatosi:", error);
    }
};

/**
 * Yangi kino qo'shish
 * @param {string} file_id - Telegramdagi kino fayli ID si (file_id)
 * @param {string} file_unique_id - Kino faylining takrorlanmas ID si
 * @param {string} trailer_file_id - Kino trelleri fayli ID si
 * @param {number|string} code - Kino uchun maxsus kod
 * @param {string} caption - Kino tavsifi yoki nomi (ixtiyoriy)
 * @returns {Promise<boolean>}
 */
const addMovie = async (file_id, file_unique_id, trailer_file_id, code, caption = '') => {
    try {
        let title = '';
        if (caption) {
            const titleMatch = caption.match(/Kino nomi:\s*(.+)/);
            if (titleMatch) title = titleMatch[1].trim();
        }

        await db.execute({
            sql: `INSERT INTO movies (file_id, file_unique_id, trailer_file_id, code, caption, title) VALUES (?, ?, ?, ?, ?, ?)`,
            args: [file_id, file_unique_id, trailer_file_id, code, caption, title]
        });
        return true;
    } catch (error) {
        console.error("Kino qo'shishda xato:", error);
        return false;
    }
};

/**
 * Kodi bo'yicha kinoni topish
 * @param {number|string} code - Izlanayotgan kino kodi
 * @returns {Promise<Object|null>} Topilsa kino obyekti, topilmasa null qaytaradi
 */
const getMovie = async (code) => {
    try {
        const result = await db.execute({
            sql: `SELECT * FROM movies WHERE code = ?`,
            args: [code]
        });
        return result.rows[0];
    } catch (error) {
        console.error("Kinoni olishda xato:", error);
        return null;
    }
};

/**
 * File unique ID bo'yicha kinoni topish
 * @param {string} file_unique_id 
 * @returns {Promise<Object|null>}
 */
const checkMovieByUniqueId = async (file_unique_id) => {
    try {
        const result = await db.execute({
            sql: `SELECT * FROM movies WHERE file_unique_id = ?`,
            args: [file_unique_id]
        });
        return result.rows[0];
    } catch (error) {
        console.error("Kinoni unique id bo'yicha olishda xato:", error);
        return null;
    }
};

/**
 * Kodi bo'yicha kinoni o'chirib tashlash
 * @param {number|string} code - O'chiriladigan kino kodi
 * @returns {Promise<boolean>}
 */
const deleteMovie = async (code) => {
    try {
        await db.execute({
            sql: `DELETE FROM movies WHERE code = ?`,
            args: [code]
        });
        return true;
    } catch (error) {
        console.error("Kinoni o'chirishda xato:", error);
        return false;
    }
};

/**
 * Kinoni yangilash (Tahrirlash)
 * @param {number|string} code 
 * @param {Object} updates - { file_id, trailer_file_id, caption }
 * @returns {Promise<boolean>}
 */
const updateMovie = async (code, updates) => {
    try {
        const fields = [];
        const args = [];
        if (updates.file_id !== undefined) {
            fields.push("file_id = ?");
            args.push(updates.file_id);
        }
        if (updates.trailer_file_id !== undefined) {
            fields.push("trailer_file_id = ?");
            args.push(updates.trailer_file_id);
        }
        if (updates.caption !== undefined) {
            fields.push("caption = ?");
            args.push(updates.caption);

            let title = '';
            const titleMatch = updates.caption.match(/Kino nomi:\s*(.+)/);
            if (titleMatch) title = titleMatch[1].trim();
            fields.push("title = ?");
            args.push(title);
        }

        if (fields.length === 0) return true;

        args.push(code);

        await db.execute({
            sql: `UPDATE movies SET ${fields.join(', ')} WHERE code = ?`,
            args: args
        });
        return true;
    } catch (error) {
        console.error("Kinoni yangilashda xato:", error);
        return false;
    }
};

/**
 * Nomi bo'yicha kinolarni qidirish
 * @param {string} query 
 * @returns {Promise<Array>}
 */
const searchMoviesByName = async (query) => {
    try {
        const normalizedQuery = query.replace(/['"‘`’]/g, '_').toLowerCase();
        const result = await db.execute({
            sql: `SELECT * FROM movies WHERE LOWER(title) LIKE ? OR LOWER(caption) LIKE ? LIMIT 10`,
            args: [`%${normalizedQuery}%`, `%${normalizedQuery}%`]
        });
        return result.rows || [];
    } catch (error) {
        console.error("Kinoni nomi bo'yicha qidirishda xato:", error);
        return [];
    }
};

module.exports = {
    initMoviesTable,
    addMovie,
    getMovie,
    checkMovieByUniqueId,
    deleteMovie,
    updateMovie,
    searchMoviesByName
};
