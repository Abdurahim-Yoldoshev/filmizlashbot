const db = require('./base/db');

async function migrate() {
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
        console.log("promocodes table created");
        
        await db.execute(`
            CREATE TABLE IF NOT EXISTS promo_usages (
                code TEXT,
                chatId TEXT,
                PRIMARY KEY (code, chatId)
            )
        `);
        console.log("promo_usages table created");
    } catch (e) {
        console.log("Error creating tables:", e.message);
    }

    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS finance_plans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL, -- 'tariff' yoki 'margin'
                name TEXT NOT NULL,
                price INTEGER NOT NULL,
                duration_days INTEGER -- tariflar uchun (masalan 30 kun), ustama uchun null bo'lishi mumkin
            )
        `);
        console.log("finance_plans table created successfully.");
    } catch (e) {
        console.log("Error creating finance_plans table:", e.message);
    }
    process.exit(0);
}
migrate();
