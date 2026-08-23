const bot = require("./bot");
const { start, saveContact } = require("./helper/start");
const { openCloudMenu, handleReceiptUpload } = require("./helper/cloud");
const { askSearchQuery, handleSearch } = require("./helper/search");
const { getUser, updateUser } = require("../base/models/user.model");

bot.on("message", async (msg) => {
  const text = msg.text;
  const contact = msg.contact;
  const chatId = msg.chat.id;
  console.log(msg);

  // Botning "Yozmoqda...", "Video yuklamoqda..." kabi statuslarini chiqarish
  if (msg.video || msg.document) {
      bot.sendChatAction(chatId, 'upload_video').catch(()=>{});
  } else if (msg.photo) {
      bot.sendChatAction(chatId, 'upload_photo').catch(()=>{});
  } else if (text) {
      bot.sendChatAction(chatId, 'typing').catch(()=>{});
  }
  
  const { handleAdminMessage } = require('./admin/index');
  const userTemp = await getUser(chatId);
  const isAdminHandled = await handleAdminMessage(msg, userTemp);
  if (isAdminHandled) return;

  if (text && text.startsWith("/start")) {
    start(msg);
    return;
  }

  if (contact) {
    saveContact(msg);
    return;
  }

  // Foydalanuvchi hozir qaysi holatdaligini aniqlaymiz
  const user = await getUser(chatId);

  // Agar foydalanuvchi ban qilingan bo'lsa, hech qanday xabarga javob bermaymiz
  if (user && user.ban) {
    return;
  }

  // Bosh menyu tugmalari bosilsa holatni tozalab o'sha bo'limga o'tamiz
  const mainMenus = [
    "☁️ Cloud",
    "/cloud",
    "🔍 Qidiruv",
    "/search",
    "🎰 Omad Charxi",
    "/lucky",
    "💳 Hisob",
    "/balance",
    "ℹ️ Haqida",
    "/about",
    "🔔 Kanallar",
    "/channels",
  ];
  if (mainMenus.includes(text)) {
    await updateUser(chatId, { action: "" }); // holatni tozalash
    
    if (text === "🎰 Omad Charxi" || text === "/lucky") {
      const charxText = `<blockquote><b>🎰 Omad Charxi</b></blockquote>\n\n🎰 <b>Omad Charxi</b>\n\nIshtirok etish narxi: <b>2 000 so'm</b>\n\nYutuqlar:\n🔹 10 000 so'm\n🔹 5 000 so'm\n🔹 2 500 so'm\n🔹 1 000 so'm\n🔹 0 so'm\n\nOmadingizni sinab ko'rasizmi?`;
      await bot.sendMessage(chatId, charxText, {
          parse_mode: 'HTML',
          reply_markup: {
              inline_keyboard: [
                  [{ text: "🔄 Aylantirish (2 000 so'm)", callback_data: "lucky_spin_start" }],
                  [{ text: "❌ Yopish", callback_data: "close_balance" }]
              ]
          }
      });
      return;
    }

    if (text === "☁️ Cloud" || text === "/cloud") {
      await openCloudMenu(msg);
      return;
    }
    if (text == "🔔 Kanallar" || text === "/channels") {
      await bot.sendMessage(
        chatId,
        "<blockquote><b>🔔 Kanallar</b></blockquote>\n\n📣 Bizning rasmiy kanallar !\n <blockquote> <b>🔔 Asosiy kanal:</b> @filmlarbuluti\n Qo'yib borilayotgan kinolar va\n yangiliklardan xabardor bo'ling!\n\n 🗳 <b>Promo kanal:</b> @filmlarpromo\n Har kuni <b>HISOB</b>ni to'ldirish imkoniga ega\n bo'ling</blockquote>\n<blockquote>⚠️ <b>Diqqat:</b> Boshqa kanallarga ishonmang!</blockquote>",
        { parse_mode: "HTML" },
      );
      return;
    }
    if (text === "🔍 Qidiruv" || text === "/search") {
      await askSearchQuery(msg);
      return;
    }
    if (text === "💳 Hisob" || text === "/balance") {
      const { sendBalance } = require("./helper/balance");
      await sendBalance(msg, user);
      return;
    }
    if (text === "ℹ️ Haqida" || text === "/about" || text === "/help") {
      const aboutText = `🤖 <b>Bot haqida</b>

Ushbu bot orqali siz o'zingiz yoqtirgan filmlarni oson va tez topishingiz, hamda yuklab olishingiz mumkin.

✨ <b>Imkoniyatlar:</b>
• Film kodi yoki nomi orqali qidirish
• Shaxsiy ☁️ Cloud orqali kinolarni saqlash va yuklash
• 🎰 Omad charxi orqali yutuqlar yutib olish
• Hisobni oson to'ldirish va turli bonuslar

👨‍💻 <b>Admin:</b> @YoldoshevAbdurahim

🔖 <b>Versiya:</b> 1.0`;
      await bot.sendMessage(chatId, aboutText, { parse_mode: 'HTML', reply_markup:{
        inline_keyboard: [[ { text: "❌ Yopish",callback_data:"close_balance" }]]}});
      return;
    }

    // Qolgan tugmalar pastdagi o'z blokiga tushaveradi
  } else if (user && user.action === "search") {
    // Agar foydalanuvchi kino qidirish holatida bo'lsa
    await handleSearch(msg, user);
    return;
  } else if (user && user.action === "enter_promocode") {
    const { handlePromocodeInput } = require("./payments/index");
    await handlePromocodeInput(msg, user);
    return;
  } else if (user && user.action === "card_amount") {
    const { handleCardAmountInput } = require("./payments/index");
    await handleCardAmountInput(msg, user);
    return;
  } else if (user && user.action === "transfer_id_prompt") {
    const { handleTransferIdInput } = require("./payments/index");
    await handleTransferIdInput(msg, user);
    return;
  } else if (user && user.action && user.action.startsWith("transfer_amount_")) {
    const { handleTransferAmountInput } = require("./payments/index");
    await handleTransferAmountInput(msg, user);
    return;
  } else if (user && user.action && user.action.startsWith("promo_amount_")) {
    const { handleCreatePromoAmountInput } = require("./payments/methods");
    await handleCreatePromoAmountInput(msg, user);
    return;
  } else if (user && user.action && user.action.startsWith("card_receipt_")) {
    const { handleCardReceipt } = require("./payments/index");
    await handleCardReceipt(msg, user);
    return;
  } else if (user && user.action && user.action.startsWith("receipt_")) {
    // Agar u chek yuborish holatida bo'lsa (va bosh menyu bosmagan bo'lsa)
    await handleReceiptUpload(msg, user);
    return;
  }

  // Qolgan matnlar uchun logikalar ketaveradi...
});

bot.on('raw_update', (update) => {
    if (update.message_reaction_count) {
        const { handleReactionCount } = require('./automatic/channels/promo');
        handleReactionCount(update.message_reaction_count);
    }
});
