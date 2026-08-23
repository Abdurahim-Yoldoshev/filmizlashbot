const db = require('../db');

/**
 * Majburiy a'zolik kanallari jadvalini bazada yaratish
 */
const initChannelTable = async () => {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS channels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id TEXT UNIQUE NOT NULL,
                name TEXT,
                link TEXT,
                condition_type TEXT,
                condition_value INTEGER,
                added_at INTEGER,
                owner_id TEXT
            )
        `);
        console.log("Channels modeli ishga tushdi.");
    } catch (error) {
        console.error("Channels modeli xatosi:", error);
    }
};

/**
 * Yangi majburiy a'zolik kanalini qo'shish
 * @param {string} chat_id - Kanalning ID si (masalan: @kinoummoni yoki -100123...)
 * @param {string} name - Kanalning ekranda ko'rinadigan nomi
 * @param {string} link - Kanalga qo'shilish havolasi (linki)
 * @returns {Promise<boolean>}
 */
const addChannel = async (chat_id, name, link) => {
    try {
        await db.execute({
            sql: `INSERT INTO channels (chat_id, name, link) VALUES (?, ?, ?)`,
            args: [chat_id, name, link]
        });
        return true;
    } catch (error) {
        console.error("Kanal qo'shishda xato:", error);
        return false;
    }
};

/**
 * Barcha qo'shilgan majburiy kanallar ro'yxatini olish
 * @returns {Promise<Array>} Kanallar massivi
 */
const getAllChannels = async () => {
    try {
        const result = await db.execute(`SELECT * FROM channels`);
        return result.rows;
    } catch (error) {
        console.error("Kanallarni olishda xato:", error);
        return [];
    }
};

/**
 * Kanalni jadvaldan o'chirib tashlash (majburiy a'zolikdan olib tashlash)
 * @param {string} chat_id - O'chiriladigan kanal ID si
 * @returns {Promise<boolean>}
 */
const deleteChannel = async (chat_id) => {
    try {
        await db.execute({
            sql: `DELETE FROM channels WHERE chat_id = ?`,
            args: [chat_id]
        });
        return true;
    } catch (error) {
        console.error("Kanalni o'chirishda xato:", error);
        return false;
    }
};

module.exports = {
    initChannelTable,
    addChannel,
    getAllChannels,
    deleteChannel
};
