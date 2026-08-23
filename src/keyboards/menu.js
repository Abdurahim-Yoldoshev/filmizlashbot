// Asosiy menyu klaviaturasi
const mainMenu = {
    reply_markup: {
        keyboard: [
            ['☁️ Cloud'],
            ['🔔 Kanallar', '🔍 Qidiruv'],
            ['🎰 Omad Charxi'],
            ['💳 Hisob', 'ℹ️ Haqida']
        ],
        resize_keyboard: true,
    }
};

// Kontakt so'rash klaviaturasi
const contactMenu = {
    reply_markup: {
        keyboard: [
            [
                {
                    text: '📱 Ulashish',
                    request_contact: true
                }
            ]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
    }
};

const cloudMenu = {
    reply_markup:{
        inline_keyboard: [
            [
                { text: "👁 Ko'rish", callback_data: "cloud_watch" },
                { text: "📥 Yuklash", callback_data: "cloud_download" }
            ],
            [
                { text: "❌ Yopish", callback_data: "cloud_exit" }
            ]
        ]
    }
};

const watchTariffMenu = {
    reply_markup: {
        inline_keyboard: [
            [{ text: "🛠 Test (1 daqiqa)", callback_data: "buy_watch_1m" }],
            [{ text: "1 kunlik (1 000 so'm)", callback_data: "buy_watch_1" }],
            [{ text: "7 kunlik (5 000 so'm)", callback_data: "buy_watch_7" }],
            [{ text: "30 kunlik (15 000 so'm)", callback_data: "buy_watch_30" }],
            [{ text: "🔙 Orqaga", callback_data: "cloud_back" }]
        ]
    }
};

const downloadTariffMenu = {
    reply_markup: {
        inline_keyboard: [
            [{ text: "🛠 Test (1 daqiqa)", callback_data: "buy_download_1m" }],
            [{ text: "1 soatlik (500 so'm)", callback_data: "buy_download_1" }],
            [{ text: "3 soatlik (1 000 so'm)", callback_data: "buy_download_3" }],
            [{ text: "24 soatlik (3 000 so'm)", callback_data: "buy_download_24" }],
            [{ text: "🔙 Orqaga", callback_data: "cloud_back" }]
        ]
    }
};

module.exports = {
    mainMenu,
    contactMenu,
    cloudMenu,
    watchTariffMenu,
    downloadTariffMenu
};
