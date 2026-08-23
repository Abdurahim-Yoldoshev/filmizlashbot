const db = require('../db');

/**
 * Subscriptions jadvalini bazada yaratish
 */
const initSubscriptionTable = async () => {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS subscriptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id INTEGER,
                channel_id TEXT,
                expire_at INTEGER
            )
        `);
        console.log("Subscriptions modeli ishga tushdi.");
    } catch (error) {
        console.error("Subscriptions modeli xatosi:", error);
    }
};

/**
 * Yangi obunani bazaga qo'shish
 * @param {number|string} chat_id - Foydalanuvchi ID si
 * @param {string} channel_id - Kanal ID si
 * @param {number} expire_at - Tugash vaqti (Date.now() millisekundlarida)
 */
const addSubscription = async (chat_id, channel_id, expire_at) => {
    try {
        await db.execute({
            sql: `INSERT INTO subscriptions (chat_id, channel_id, expire_at) VALUES (?, ?, ?)`,
            args: [chat_id, channel_id, expire_at]
        });
        return true;
    } catch (error) {
        console.error("Obunani qo'shishda xato:", error);
        return false;
    }
};

const getSubscription = async (chat_id, channel_id) => {
    try {
        const result = await db.execute({
            sql: `SELECT * FROM subscriptions WHERE chat_id = ? AND channel_id = ?`,
            args: [chat_id, channel_id]
        });
        return result.rows[0];
    } catch (error) {
        console.error("Obunani olishda xato:", error);
        return null;
    }
};

const upsertSubscription = async (chat_id, channel_id, expire_at) => {
    try {
        const existing = await getSubscription(chat_id, channel_id);
        if (existing) {
            await db.execute({
                sql: `UPDATE subscriptions SET expire_at = ? WHERE id = ?`,
                args: [expire_at, existing.id]
            });
        } else {
            await addSubscription(chat_id, channel_id, expire_at);
        }
        return true;
    } catch (error) {
        console.error("Obunani yangilashda xato:", error);
        return false;
    }
};

/**
 * Vaqti tugagan barcha obunalarni topish
 * @returns {Promise<Array>}
 */
const getExpiredSubscriptions = async () => {
    try {
        const now = Date.now();
        const result = await db.execute({
            sql: `SELECT * FROM subscriptions WHERE expire_at <= ?`,
            args: [now]
        });
        return result.rows;
    } catch (error) {
        console.error("Tugagan obunalarni olishda xato:", error);
        return [];
    }
};

/**
 * ID bo'yicha obunani jadvaldan o'chirish
 * @param {number} id - Obuna ID si
 */
const removeSubscription = async (id) => {
    try {
        await db.execute({
            sql: `DELETE FROM subscriptions WHERE id = ?`,
            args: [id]
        });
        return true;
    } catch (error) {
        console.error("Obunani o'chirishda xato:", error);
        return false;
    }
};

module.exports = {
    initSubscriptionTable,
    addSubscription,
    getSubscription,
    upsertSubscription,
    getExpiredSubscriptions,
    removeSubscription
};
