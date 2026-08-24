const bot = require("../bot");
const {
  getUser,
  upsertUser,
  updateUser
} = require("../../base/models/user.model");
const { mainMenu, contactMenu } = require("../keyboards/menu");

const start = async (msg) => {
  const from = msg.from;
  const chatId = msg.chat.id;
  const username = from.username || "";
  const name = from.last_name || from.first_name || "";
  const balance = 0;

  const adminId = Number(process.env.ADMIN_ID);
  const isAdmin = chatId === adminId;

  try {
    // 1. Foydalanuvchi bazada bor yoki yo'qligini tekshiramiz model orqali
    const existingUser = await getUser(chatId);

    // 2. Agar foydalanuvchi bazada BO'LMASA (yangi foydalanuvchi)
    if (!existingUser) {
      // Bazaga saqlaymiz
      await upsertUser(chatId, username, name, balance, isAdmin);

      // Referal yoki Deep link tizimini tekshiramiz
      const startText = msg.text.split(' ');
      let pendingSearchCode = "";
      if (startText.length > 1) {
        if (startText[1].startsWith('ref_')) {
          const inviterId = startText[1].replace('ref_', '');
          if (inviterId != chatId) {
            const inviter = await getUser(inviterId);
            if (inviter) {
              await updateUser(chatId, { referred_by: inviterId });
              
              let refInviteBonus = 0;
              try {
                  const db = require('../../base/db');
                  const res = await db.execute({ sql: `SELECT price FROM finance_plans WHERE type = 'margin' AND name = 'referral_invite_bonus'` });
                  if (res.rows.length > 0) refInviteBonus = res.rows[0].price;
              } catch(e) {}
              
              if (refInviteBonus > 0) {
                  await updateUser(inviterId, { balance: (inviter.balance || 0) + refInviteBonus });
                  bot.sendMessage(inviterId, `🎉 <b>Tabriklaymiz!</b>\n\nSizning referal ssilkangiz orqali yangi a'zo (<b>${msg.from.first_name}</b>) ro'yxatdan o'tdi.\nHisobingizga <b>${refInviteBonus} so'm</b> qo'shildi!`, { parse_mode: 'HTML' }).catch(()=>{});
              }
            }
          }
        } else {
          pendingSearchCode = startText[1];
        }
      }

      if (pendingSearchCode) {
        await updateUser(chatId, { action: `pending_search_${pendingSearchCode}` });
      }

      // Kontakt so'raymiz
      await bot.sendMessage(
        chatId,
        "Botdan hisob ochib to'liq foydalanish uchun iltimos, kontakt ma'lumotlaringizni ulashing:",
        contactMenu,
      );
    } else {
      // 3. Agar foydalanuvchi bazada BO'LSA (eski foydalanuvchi)
      await updateUser(chatId, { username, name, admin: isAdmin });

      const startText = msg.text.split(' ');
      if (startText.length > 1 && !startText[1].startsWith('ref_')) {
          const code = startText[1];
          if (code === 'all') {
              return bot.sendMessage(chatId, '🎬 <b>Barcha kinolar va seriallarni tomosha qilish uchun maxsus kanalimizga o\'ting:</b>', {
                  parse_mode: 'HTML',
                  reply_markup: {
                      inline_keyboard: [[
                          { text: '▶️ Kanalga o\'tish', url: `https://t.me/filmlarbuluti` }
                      ]]
                  }
              });
          }
          // Mock the text property so handleSearch can read it
          msg.text = code;
          const { handleSearch } = require('./search');
          await handleSearch(msg, existingUser);
          return;
      }

      // To'g'ridan-to'g'ri asosiy menyuga o'tkazib yuboramiz
      await bot.sendMessage(
        chatId,
        `👋 Assalomu alaykum, <b>${msg.from.first_name}</b>!

🎬 <b>Film Izlash</b> botiga xush kelibsiz!

<blockquote>🔎 Film nomi yoki kodini <b>Qidiruv</b> bo‘limiga yuboring va kerakli filmni tezda toping.

💬 Boshqa chatlarda ham <b>@filmizlashbot</b> orqali film nomi yoki kodini yuborib qidirishingiz mumkin.</blockquote>`,
        {
          parse_mode: "HTML",
          protect_content: true,
          ...mainMenu,
        },
      );
    }
  } catch (error) {
    console.error("Error in start:", error);
  }
};

const saveContact = async (msg) => {
  if (!msg.contact) return;

  const chatId = msg.chat.id;
  const contact = msg.contact.phone_number;

  try {
    // Kontaktni bazaga saqlaymiz model orqali
    const user = await getUser(chatId);
    let action = user ? user.action : "";
    await updateUser(chatId, { contact, action: "" });

    // 1. Foydalanuvchi yuborgan kontakt xabarini o'chirish
    bot.deleteMessage(chatId, msg.message_id).catch(() => {});
    // 2. Undan oldingi bot so'ragan xabarni ham o'chirish (odatda ID bitta oldin bo'ladi)
    bot.deleteMessage(chatId, msg.message_id - 1).catch(() => {});

    if (action && action.startsWith("pending_search_")) {
        const code = action.split("_")[2];
        msg.text = code;
        const { handleSearch } = require("./search");
        await handleSearch(msg, { ...user, action: "" });
        return;
    }

    // Kontakt saqlangach, uni ham asosiy menyuga o'tkazib yuboramiz
    await bot.sendMessage(
      chatId,
      `👋 Assalomu alaykum, <b>${msg.from.first_name}</b>!

🎬 <b>Film Izlash</b> botiga xush kelibsiz!

<blockquote>🔎 Film nomi yoki kodini <b>Qidiruv</b> bo‘limiga yuboring va kerakli filmni tezda toping.

💬 Boshqa chatlarda ham <b>@filmizlashbot</b> orqali film nomi yoki kodini yuborib qidirishingiz mumkin.</blockquote>`,
      {
        parse_mode: "HTML",
        protect_content: true,
        ...mainMenu,
      },
    );
  } catch (error) {
    console.error("Error in saveContact:", error);
  }
};

module.exports = {
  start,
  saveContact,
};
