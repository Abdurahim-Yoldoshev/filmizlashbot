const db = require('../db');

const initPromocodesTable = async () => {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS promocodes (
                code TEXT PRIMARY KEY,
                amount INTEGER,
                max_uses INTEGER,
                current_uses INTEGER DEFAULT 0,
                created_by TEXT
            )
        `);
        await db.execute(`
            CREATE TABLE IF NOT EXISTS promo_usages (
                code TEXT,
                chatId TEXT,
                PRIMARY KEY (code, chatId)
            )
        `);
        console.log("Promocodes modeli ishga tushdi.");
    } catch (e) {
        console.error("Promocodes modeli xatosi:", e.message);
    }
};

const getPromocode = async (code) => {
    try {
        const result = await db.execute({
            sql: "SELECT * FROM promocodes WHERE code = ?",
            args: [code]
        });
        return result.rows[0] || null;
    } catch (e) {
        return null;
    }
};

const createPromocode = async (code, amount, maxUses, createdBy) => {
    try {
        await db.execute({
            sql: "INSERT INTO promocodes (code, amount, max_uses, created_by) VALUES (?, ?, ?, ?)",
            args: [code, amount, maxUses, createdBy]
        });
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
};

const incrementPromoUses = async (code) => {
    try {
        await db.execute({
            sql: "UPDATE promocodes SET current_uses = current_uses + 1 WHERE code = ?",
            args: [code]
        });
        return true;
    } catch (e) {
        return false;
    }
};

const checkPromoUsage = async (code, chatId) => {
    try {
        const result = await db.execute({
            sql: "SELECT * FROM promo_usages WHERE code = ? AND chatId = ?",
            args: [code, chatId]
        });
        return result.rows.length > 0;
    } catch (e) {
        return false;
    }
};

const recordPromoUsage = async (code, chatId) => {
    try {
        await db.execute({
            sql: "INSERT INTO promo_usages (code, chatId) VALUES (?, ?)",
            args: [code, chatId]
        });
        return true;
    } catch (e) {
        return false;
    }
};

const deletePromocode = async (code) => {
    try {
        await db.execute({
            sql: "DELETE FROM promocodes WHERE code = ?",
            args: [code]
        });
        await db.execute({
            sql: "DELETE FROM promo_usages WHERE code = ?",
            args: [code]
        });
        return true;
    } catch (e) {
        return false;
    }
};

module.exports = {
    initPromocodesTable,
    getPromocode,
    createPromocode,
    incrementPromoUses,
    checkPromoUsage,
    recordPromoUsage,
    deletePromocode
};
