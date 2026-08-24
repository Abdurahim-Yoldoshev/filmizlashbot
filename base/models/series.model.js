const db = require('../db');

const initSeriesTable = async () => {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS series (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code INTEGER UNIQUE NOT NULL,
                trailer_file_id TEXT NOT NULL,
                caption TEXT,
                title TEXT
            )
        `);
        await db.execute(`
            CREATE TABLE IF NOT EXISTS episodes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                series_code INTEGER NOT NULL,
                episode_num INTEGER NOT NULL,
                file_id TEXT NOT NULL,
                file_unique_id TEXT,
                UNIQUE(series_code, episode_num)
            )
        `);
        try { await db.execute(`ALTER TABLE episodes ADD COLUMN file_unique_id TEXT`); } catch (e) {}
        try { await db.execute(`ALTER TABLE series ADD COLUMN title TEXT`); } catch (e) {}
        try { await db.execute(`ALTER TABLE series ADD COLUMN channel_file_id TEXT`); } catch (e) {}
        try { await db.execute(`ALTER TABLE series ADD COLUMN channel_file_type TEXT`); } catch (e) {}
        try { await db.execute(`ALTER TABLE series ADD COLUMN poster_url TEXT`); } catch (e) {}
        console.log("Series modellari ishga tushdi.");
    } catch (error) {
        console.error("Series modeli xatosi:", error);
    }
};

const addSeries = async (code, trailer_file_id, caption) => {
    try {
        let title = '';
        if (caption) {
            const titleMatch = caption.match(/Serial nomi:\s*(.+)/);
            if (titleMatch) title = titleMatch[1].trim();
        }

        await db.execute({
            sql: `INSERT INTO series (code, trailer_file_id, caption, title) VALUES (?, ?, ?, ?)`,
            args: [code, trailer_file_id, caption, title]
        });
        return true;
    } catch (error) {
        console.error("Serial qo'shishda xato:", error);
        return false;
    }
};

const addEpisode = async (series_code, episode_num, file_id, file_unique_id = null) => {
    try {
        await db.execute({
            sql: `INSERT INTO episodes (series_code, episode_num, file_id, file_unique_id) VALUES (?, ?, ?, ?)`,
            args: [series_code, episode_num, file_id, file_unique_id]
        });
        return true;
    } catch (error) {
        console.error("Qism qo'shishda xato:", error);
        return false;
    }
};

const getSeries = async (code) => {
    try {
        const result = await db.execute({
            sql: `SELECT * FROM series WHERE code = ?`,
            args: [code]
        });
        return result.rows[0];
    } catch (error) {
        return null;
    }
};

const checkEpisodeByUniqueId = async (file_unique_id) => {
    try {
        const result = await db.execute({
            sql: `SELECT * FROM episodes WHERE file_unique_id = ?`,
            args: [file_unique_id]
        });
        return result.rows[0];
    } catch (error) {
        return null;
    }
};

const getEpisodes = async (series_code) => {
    try {
        const result = await db.execute({
            sql: `SELECT * FROM episodes WHERE series_code = ? ORDER BY episode_num ASC`,
            args: [series_code]
        });
        return result.rows;
    } catch (error) {
        return [];
    }
};

const getEpisode = async (series_code, episode_num) => {
    try {
        const result = await db.execute({
            sql: `SELECT * FROM episodes WHERE series_code = ? AND episode_num = ?`,
            args: [series_code, episode_num]
        });
        return result.rows[0];
    } catch (error) {
        return null;
    }
};

const deleteSeries = async (code) => {
    try {
        await db.execute({ sql: `DELETE FROM episodes WHERE series_code = ?`, args: [code] });
        await db.execute({ sql: `DELETE FROM series WHERE code = ?`, args: [code] });
        return true;
    } catch (error) {
        return false;
    }
};

const deleteEpisode = async (series_code, episode_num) => {
    try {
        await db.execute({
            sql: `DELETE FROM episodes WHERE series_code = ? AND episode_num = ?`,
            args: [series_code, episode_num]
        });
        return true;
    } catch (error) {
        return false;
    }
};

const updateSeries = async (code, updateData) => {
    try {
        let sql = "UPDATE series SET ";
        let args = [];
        let sets = [];
        
        if (updateData.trailer_file_id !== undefined) {
            sets.push("trailer_file_id = ?");
            args.push(updateData.trailer_file_id);
        }
        if (updateData.caption !== undefined) {
            sets.push("caption = ?");
            args.push(updateData.caption);
            
            let title = '';
            const titleMatch = updateData.caption.match(/Serial nomi:\s*(.+)/);
            if (titleMatch) title = titleMatch[1].trim();
            sets.push("title = ?");
            args.push(title);
        }
        
        if (sets.length === 0) return true;
        
        sql += sets.join(", ") + " WHERE code = ?";
        args.push(code);
        
        await db.execute({ sql, args });
        return true;
    } catch (error) {
        console.error("Serial yangilashda xato:", error);
        return false;
    }
};

const searchSeriesByName = async (query) => {
    try {
        const normalizedQuery = query.replace(/['"‘`’]/g, '_').toLowerCase();
        const result = await db.execute({
            sql: `SELECT * FROM series WHERE LOWER(title) LIKE ? OR LOWER(caption) LIKE ? LIMIT 10`,
            args: [`%${normalizedQuery}%`, `%${normalizedQuery}%`]
        });
        return result.rows || [];
    } catch (error) {
        return [];
    }
};

/**
 * Serial uchun kanalga yuklangan xabar file_id va turini saqlash
 */
const updateSeriesChannelInfo = async (code, channel_file_id, channel_file_type) => {
    try {
        await db.execute({
            sql: `UPDATE series SET channel_file_id = ?, channel_file_type = ? WHERE code = ?`,
            args: [channel_file_id, channel_file_type, code]
        });
        return true;
    } catch (error) {
        console.error("Serial kanal info yangilashda xato:", error);
        return false;
    }
const updateSeriesPosterUrl = async (code, poster_url) => {
    try {
        await db.execute({
            sql: `UPDATE series SET poster_url = ? WHERE code = ?`,
            args: [poster_url, code]
        });
        return true;
    } catch (error) {
        console.error("Serial poster_url yangilashda xato:", error);
        return false;
    }
};

module.exports = {
    initSeriesTable,
    addSeries,
    addEpisode,
    getSeries,
    checkEpisodeByUniqueId,
    getEpisodes,
    getEpisode,
    deleteSeries,
    deleteEpisode,
    updateSeries,
    updateSeriesChannelInfo,
    updateSeriesPosterUrl,
    searchSeriesByName
};
