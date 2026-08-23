const db = require('../db');

/**
 * Users (Foydalanuvchilar) jadvalini bazada yaratish
 */
const initUserTable = async () => {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS users (
                chatId INTEGER PRIMARY KEY,
                username TEXT,
                name TEXT,
                contact TEXT,
                balance INTEGER DEFAULT 0,
                admin BOOLEAN DEFAULT 0,
                ban BOOLEAN DEFAULT 0,
                action TEXT DEFAULT '',
                temp_data TEXT
            )
        `);
        console.log("User modeli ishga tushdi.");
    } catch (error) {
        console.error("User modeli xatosi:", error);
    }
};

/**
 * Yangi foydalanuvchini bazaga saqlash yoki eski ma'lumotlarini yangilash
 * @param {number|string} chatId - Foydalanuvchi ID raqami
 * @param {string} username - Foydalanuvchi username-i (@)
 * @param {string} name - Foydalanuvchi ismi
 * @param {number} balance - Balans miqdori (default: 0)
 * @param {boolean} admin - Admin huquqi (default: false)
 * @param {boolean} ban - Ban qilinganmi (default: false)
 * @param {string} action - Hozirgi turgan qadami/menyusi (default: '')
 * @returns {Promise<boolean>} Muvaffaqiyatli saqlansa true qaytaradi
 */
const upsertUser = async (chatId, username, name, balance = 0, admin = false, ban = false, action = '') => {
    try {
        await db.execute({
            sql: `INSERT INTO users (chatId, username, name, balance, admin, ban, action) 
                  VALUES (?, ?, ?, ?, ?, ?, ?) 
                  ON CONFLICT(chatId) DO UPDATE SET 
                  username = excluded.username, 
                  name = excluded.name,
                  ban = excluded.ban,
                  action = excluded.action`,
            args: [chatId, username, name, balance, admin ? 1 : 0, ban ? 1 : 0, action]
        });
        return true;
    } catch (error) {
        console.error("User saqlashda xato:", error);
        return false;
    }
};

/**
 * ID orqali bitta foydalanuvchini topib olish
 * @param {number|string} chatId - Qidirilayotgan foydalanuvchi ID si
 * @returns {Promise<Object|null>} Topilsa user obyekti, topilmasa null qaytaradi
 */
const getUser = async (chatId) => {
    try {
        const result = await db.execute({
            sql: `SELECT * FROM users WHERE chatId = ?`,
            args: [chatId]
        });
        const user = result.rows[0];
        if (user) {
            user.admin = Boolean(user.admin);
            user.ban = Boolean(user.ban);
        }
        return user || null;
    } catch (error) {
        console.error("Userni olishda xato:", error);
        return null;
    }
};

/**
 * Foydalanuvchining ma'lumotlarini qisman o'zgartirish
 * @param {number|string} chatId - Yangilanadigan foydalanuvchi ID si
 * @param {Object} data - O'zgartiriladigan qiymatlar (Masalan: { action: 'search', ban: true })
 * @returns {Promise<boolean>}
 */
const updateUser = async (chatId, data) => {
    const keys = Object.keys(data);
    const values = Object.values(data);
    if (keys.length === 0) return;

    const setQuery = keys.map(key => `${key} = ?`).join(', ');
    
    try {
        await db.execute({
            sql: `UPDATE users SET ${setQuery} WHERE chatId = ?`,
            args: [...values, chatId]
        });
        return true;
    } catch (error) {
        console.error("Userni yangilashda xato:", error);
        return false;
    }
};

/**
 * Foydalanuvchini bazadan butunlay o'chirib tashlash
 * @param {number|string} chatId - O'chiriladigan foydalanuvchi ID si
 * @returns {Promise<boolean>}
 */
const deleteUser = async (chatId) => {
    try {
        await db.execute({
            sql: `DELETE FROM users WHERE chatId = ?`,
            args: [chatId]
        });
        return true;
    } catch (error) {
        console.error("Userni o'chirishda xato:", error);
        return false;
    }
};

/**
 * Barcha foydalanuvchilar ro'yxatini olish (Admin panel yoki statistika uchun)
 * @returns {Promise<Array>} Foydalanuvchilar massivi
 */
const getAllUsers = async () => {
    try {
        const result = await db.execute(`SELECT * FROM users`);
        return result.rows.map(user => {
            user.admin = Boolean(user.admin);
            user.ban = Boolean(user.ban);
            return user;
        });
    } catch (error) {
        console.error("Barcha userlarni olishda xato:", error);
        return [];
    }
};

const getWaitingUsers = async () => {
    try {
        const result = await db.execute(`SELECT * FROM users WHERE action LIKE 'waitjoin_%'`);
        return result.rows.map(user => {
            user.admin = Boolean(user.admin);
            user.ban = Boolean(user.ban);
            return user;
        });
    } catch (error) {
        console.error("Kutayotgan userlarni olishda xato:", error);
        return [];
    }
};

module.exports = {
    initUserTable,
    upsertUser,
    getUser,
    updateUser,
    deleteUser,
    getAllUsers,
    getWaitingUsers
};
