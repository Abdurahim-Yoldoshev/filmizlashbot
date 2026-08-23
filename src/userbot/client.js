const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const db = require('../../base/db');

let userbotClient = null;
let isConnecting = false;

// Session string ni bazadan olish
const getSessionString = async () => {
    try {
        const res = await db.execute({ sql: "SELECT price FROM finance_plans WHERE type = 'userbot_setting' AND name = 'session'", args: [] });
        if (res.rows.length > 0) return res.rows[0].price || '';
    } catch (e) {}
    return '';
};

// Session string ni bazaga saqlash
const saveSessionString = async (session) => {
    try {
        await db.execute({
            sql: `INSERT INTO finance_plans (type, name, price, duration_days) VALUES ('userbot_setting', 'session', ?, 0)
                  ON CONFLICT(type, name) DO UPDATE SET price = excluded.price`,
            args: [session]
        });
    } catch (e) {
        // Try upsert without conflict handling
        await db.execute({
            sql: `UPDATE finance_plans SET price = ? WHERE type = 'userbot_setting' AND name = 'session'`,
            args: [session]
        });
    }
};

// Userbotni olish (singleton)
const getUserbotClient = () => userbotClient;
const isUserbotConnected = () => userbotClient !== null && userbotClient.connected;

// Userbotni ishga tushirish (saqlangan session bilan)
const startUserbot = async () => {
    if (isConnecting || isUserbotConnected()) return;
    isConnecting = true;

    try {
        const sessionStr = await getSessionString();
        if (!sessionStr) {
            console.log('[Userbot] Session topilmadi. Admin paneldan telefon raqam ulang.');
            isConnecting = false;
            return;
        }

        const apiId = process.env.TELEGRAM_API_ID ? parseInt(process.env.TELEGRAM_API_ID) : 2040;
        const apiHash = process.env.TELEGRAM_API_HASH || "b18441a1ff607e10a989891a5462e627";

        const client = new TelegramClient(new StringSession(sessionStr), apiId, apiHash, {
            connectionRetries: 5,
        });

        await client.connect();
        userbotClient = client;
        console.log('[Userbot] Muvaffaqiyatli ulandi! Humo va CardXabar botlari kuzatilmoqda...');

        // Yangi xabarlarni tinglash
        const { listenForPayments } = require('./listener');
        listenForPayments(client);

    } catch (e) {
        console.error('[Userbot] Ulanishda xato:', e.message);
        userbotClient = null;
    } finally {
        isConnecting = false;
    }
};

// Telefon raqam bilan yangi session yaratish — Admin paneldan chaqiriladi
const beginPhoneAuth = async (phoneNumber) => {
    const apiId = process.env.TELEGRAM_API_ID ? parseInt(process.env.TELEGRAM_API_ID) : 2040;
    const apiHash = process.env.TELEGRAM_API_HASH || "b18441a1ff607e10a989891a5462e627";

    const client = new TelegramClient(new StringSession(''), apiId, apiHash, {
        connectionRetries: 3,
    });

    await client.connect();

    const result = await client.sendCode({ apiId, apiHash }, phoneNumber);
    return { client, phoneCodeHash: result.phoneCodeHash };
};

// Kod bilan login — agar 2FA bo'lsa { needs_password: true } qaytaradi
const finishPhoneAuth = async (client, phoneNumber, phoneCode, phoneCodeHash) => {
    const { Api } = require('telegram');
    try {
        await client.invoke(new Api.auth.SignIn({
            phoneNumber,
            phoneCode,
            phoneCodeHash
        }));
    } catch (e) {
        if (e.errorMessage === 'SESSION_PASSWORD_NEEDED') {
            return { needs_password: true, client };
        }
        throw e;
    }

    const session = client.session.save();
    await saveSessionString(session);
    userbotClient = client;
    const { listenForPayments } = require('./listener');
    listenForPayments(client);
    return { needs_password: false };
};

// 2FA parol bilan login yakunlash
const finishPasswordAuth = async (client, password) => {
    const { Api } = require('telegram');
    const { computeCheck } = require('telegram/Password');

    const passwordData = await client.invoke(new Api.account.GetPassword());
    const passwordCheck = await computeCheck(passwordData, password);
    await client.invoke(new Api.auth.CheckPassword({ password: passwordCheck }));

    const session = client.session.save();
    await saveSessionString(session);
    userbotClient = client;
    const { listenForPayments } = require('./listener');
    listenForPayments(client);
    return true;
};

module.exports = { startUserbot, beginPhoneAuth, finishPhoneAuth, finishPasswordAuth, getUserbotClient, isUserbotConnected, saveSessionString, getSessionString };
