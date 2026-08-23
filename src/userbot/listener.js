const db = require('../../base/db');
const { NewMessage } = require('telegram/events');

// Kuzatiladigan botlarning usernamelari
const WATCHED_BOTS = ['HUMOcardbot', 'CardXabarbot'];

// Kelgan to'lovlarni bazaga yozish
const savePayment = async (botUsername, text, amount, rawText) => {
    try {
        await db.execute({
            sql: `CREATE TABLE IF NOT EXISTS incoming_payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bot_username TEXT,
                amount INTEGER,
                raw_text TEXT,
                used INTEGER DEFAULT 0,
                created_at INTEGER
            )`,
            args: []
        });
        await db.execute({
            sql: `INSERT INTO incoming_payments (bot_username, amount, raw_text, used, created_at) VALUES (?, ?, ?, 0, ?)`,
            args: [botUsername, amount, rawText, Date.now()]
        });
        console.log(`[Userbot] To'lov yozildi: ${botUsername} | ${amount} so'm`);
    } catch (e) {
        console.error("[Userbot] To'lov saqlashda xato:", e.message);
    }
};

// Matndan summani chiqarib olish
// Turli formatlar: "50 000 so'm", "50000 UZS", "50,000", "summa: 50000"
const extractAmount = (text) => {
    if (!text) return null;

    // "50 000 so'm" yoki "50000 so'm" yoki "50 000 UZS" formatlar
    const patterns = [
        /(\d[\d\s,]+)\s*(so['']?m|uzs|сум)/i,
        /summa[:\s]+(\d[\d\s,]+)/i,
        /amount[:\s]+(\d[\d\s,]+)/i,
        /to['']lov[:\s]+(\d[\d\s,]+)/i,
        /(\d{4,})/  // fallback: har qanday 4+ xonali son
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            const numStr = match[1].replace(/[\s,]/g, '');
            const num = parseInt(numStr);
            if (!isNaN(num) && num > 100) return num;
        }
    }
    return null;
};

// Userbotni tinglovchiga bog'lash
const listenForPayments = (client) => {
    client.addEventHandler(async (event) => {
        try {
            const message = event.message;
            if (!message || !message.text) return;

            const sender = await message.getSender();
            if (!sender) return;

            const senderUsername = sender.username || '';
            if (!WATCHED_BOTS.includes(senderUsername)) return;

            const text = message.text;
            const amount = extractAmount(text);

            if (amount) {
                await savePayment(senderUsername, text, amount, text);
            }
        } catch (e) {
            // Ignore individual message errors
        }
    }, new NewMessage({}));

    console.log(`[Userbot] Kuzatish boshlandi: ${WATCHED_BOTS.join(', ')}`);
};

// Summaga mos to'lovni bazadan qidirish (oxirgi 15 daqiqa ichida)
const findMatchingPayment = async (amount) => {
    try {
        await db.execute({
            sql: `CREATE TABLE IF NOT EXISTS incoming_payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bot_username TEXT,
                amount INTEGER,
                raw_text TEXT,
                used INTEGER DEFAULT 0,
                created_at INTEGER
            )`,
            args: []
        });

        const fifteenMinAgo = Date.now() - 15 * 60 * 1000;
        const res = await db.execute({
            sql: `SELECT * FROM incoming_payments WHERE amount = ? AND used = 0 AND created_at > ? ORDER BY created_at DESC LIMIT 1`,
            args: [amount, fifteenMinAgo]
        });

        if (res.rows.length > 0) {
            return res.rows[0];
        }
    } catch (e) {
        console.error("[Checker] To'lov qidirishda xato:", e.message);
    }
    return null;
};

// To'lovni ishlatilgan deb belgilash
const markPaymentUsed = async (id) => {
    try {
        await db.execute({
            sql: `UPDATE incoming_payments SET used = 1 WHERE id = ?`,
            args: [id]
        });
    } catch (e) {}
};

module.exports = { listenForPayments, findMatchingPayment, markPaymentUsed, extractAmount };
