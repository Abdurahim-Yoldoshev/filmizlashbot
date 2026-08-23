const bot = require("../bot");

const formatMoney = (amount) => {
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " so'm";
};

const sendBalance = async (msg, user) => {
    const chatId = msg.chat.id;
    
    const name = user.name || msg.from.first_name || "Noma'lum";
    const id = user.chatId;
    const balance = formatMoney(user.balance || 0);
    
    let contact = user.contact || "Kiritilmagan";
    if (contact !== "Kiritilmagan") {
        // Remove +998 or 998 from the beginning
        if (contact.startsWith('+998')) {
            contact = contact.substring(4);
        } else if (contact.startsWith('998')) {
            contact = contact.substring(3);
        }
        // Make it copyable
        contact = `<code>${contact}</code>`;
    }

    const ban = user.ban ? "Ha ❌" : "Yo'q ✅";

    const text = `<blockquote><b>💳 Hisob</b></blockquote>

📇 Hisob kartangiz:

<blockquote>╭━━━━━━━━━━━━━━━━━━━━━━━━╮
    💳 KINO IZLASH
├━━━━━━━━━━━━━━━━━━━━━━━━┤
  👤 Ism: ${name}
  🆔 ID: <code>${id}</code>
  💵 Summa: ${balance}
  📞 Raqam: ${contact}
  ⛔️ Ban: ${ban}
╰━━━━━━━━━━━━━━━━━━━━━━━━╯</blockquote>

💳 Hisobni boshqarish uchun amallardan birini tanlang!
    `.trim();

    const inline_keyboard = [
        [
            { text: "💵 To'ldirish", callback_data: "menu_topup" },
            { text: "💸 O'tkazish", callback_data: "pay_transfer" }
        ],
        [
            { text: "❌ Yopish", callback_data: "close_balance" }
        ]
    ];

    await bot.sendMessage(chatId, text, { 
        parse_mode: "HTML",
        reply_markup: {
            inline_keyboard
        }
    });
};

module.exports = {
    sendBalance
};
