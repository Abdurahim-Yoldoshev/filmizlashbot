const bot = require('./bot');
const { handleCloudQuery } = require('./helper/cloud');
const { handleSearchQuery } = require('./helper/search');
const { handlePaymentsQuery } = require('./payments');
const { getUser } = require('../base/models/user.model');

bot.on('callback_query', async (query) => {
    // 1. Foydalanuvchi ban qilinganligini tekshiramiz
    const user = await getUser(query.from.id);
    if (user && user.ban) {
        bot.answerCallbackQuery(query.id, { text: "⚠️ Siz botdan vaqtincha bloklangansiz!", show_alert: true }).catch(() => {});
        return;
    }

    const { handleAdminCallback } = require('./admin/index');
    const isAdminHandled = await handleAdminCallback(query);
    if (isAdminHandled) return;

    // 2. Agar kelgan query Cloud bo'limiga tegishli bo'lsa, uni cloud.js ushlab qoladi va hal qiladi
    const handledByCloud = await handleCloudQuery(query);
    if (handledByCloud) return; 

    // 3. Kino qidirish tugmalari uchun (movie_xxx)
    const handledBySearch = await handleSearchQuery(query);
    if (handledBySearch) return;
    
    // 4. Hisob to'ldirish tugmalari uchun
    const handledByPayments = await handlePaymentsQuery(query);
    if (handledByPayments) return;
    
    // 5. Promokodni olish (kanaldan)
    if (query.data && query.data.startsWith('getpromo_')) {
        const code = query.data.replace('getpromo_', '');
        try {
            const member = await bot.getChatMember(process.env.PROMO_CHANNEL_ID, query.from.id);
            if (['member', 'administrator', 'creator'].includes(member.status)) {
                // Promokodni bazadan tekshiramiz
                const { getPromocode, checkPromoUsage, incrementPromoUses, recordPromoUsage, deletePromocode } = require('../base/models/promocode.model');
                const promo = await getPromocode(code);
                
                if (!promo) {
                    bot.answerCallbackQuery(query.id, { text: "❌ Ushbu promokod tugagan yoki yaroqsiz!", show_alert: true }).catch(()=>{});
                    return;
                }

                if (!user) {
                    bot.answerCallbackQuery(query.id, { text: "⚠️ Iltimos, pulni qabul qilish uchun avval botga kirib /start tugmasini bosing!", show_alert: true }).catch(()=>{});
                    return;
                }

                const hasUsed = await checkPromoUsage(code, query.from.id.toString());
                if (hasUsed) {
                    bot.answerCallbackQuery(query.id, { text: "⚠️ Siz ushbu promokoddan allaqachon foydalangansiz!", show_alert: true }).catch(()=>{});
                    return;
                }

                // Promokodni qo'llash
                const { updateUser } = require('../base/models/user.model');
                await updateUser(query.from.id, { balance: (user.balance || 0) + promo.amount });

                // Agar shu bilan promokod to'lgan bo'lsa
                if (promo.current_uses + 1 >= promo.max_uses) {
                    await deletePromocode(code);
                    if (promo.created_by && promo.created_by !== 'auto_admin') {
                        bot.sendMessage(promo.created_by, `⚠️ <b>Diqqat!</b>\n\nSiz yaratgan <code>${code}</code> promokodidan foydalanishlar soni to'liq tugadi va u yaroqsiz holatga kelib, bazadan o'chirildi.`, { parse_mode: 'HTML' }).catch(()=>{});
                    }
                } else {
                    await incrementPromoUses(code);
                    await recordPromoUsage(code, query.from.id.toString());
                }

                bot.answerCallbackQuery(query.id, { text: `🎉 Tabriklaymiz!\n\nHisobingizga ${promo.amount} so'm qo'shildi!`, show_alert: true }).catch(()=>{});
                bot.sendMessage(query.from.id, `🎉 <b>Promokod ishladi!</b>\n\nHisobingizga <b>${promo.amount} so'm</b> qo'shildi!`, { parse_mode: 'HTML' }).catch(()=>{});
            } else {
                bot.answerCallbackQuery(query.id, { text: "⚠️ Iltimos, promokodni ko'rish uchun ushbu kanalga obuna bo'ling!", show_alert: true }).catch(()=>{});
            }
        } catch (e) {
            bot.answerCallbackQuery(query.id, { text: "⚠️ Iltimos, kanalga obuna bo'ling va botga /start bering!", show_alert: true }).catch(()=>{});
        }
        return;
    }

});