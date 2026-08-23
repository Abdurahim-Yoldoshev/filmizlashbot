const db = require('../db');

const initSettingsTable = async () => {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        `);
        // Insert default card if not exists
        const res = await db.execute({ sql: "SELECT * FROM settings WHERE key = 'payment_card'", args: [] });
        if (res.rows.length === 0) {
            await db.execute({ sql: "INSERT INTO settings (key, value) VALUES (?, ?)", args: ['payment_card', '8600 0000 0000 0000|Karta egasi'] });
        }
        console.log("Settings modeli ishga tushdi.");
    } catch (error) {
        console.error("Settings modeli xatosi:", error);
    }
};

const getSetting = async (key) => {
    try {
        const res = await db.execute({ sql: "SELECT value FROM settings WHERE key = ?", args: [key] });
        if (res.rows.length > 0) return res.rows[0].value;
        return null;
    } catch (error) {
        return null;
    }
};

const updateSetting = async (key, value) => {
    try {
        await db.execute({ sql: "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", args: [key, value] });
        return true;
    } catch (error) {
        return false;
    }
};

module.exports = {
    initSettingsTable,
    getSetting,
    updateSetting
};
