const db = require('../../base/db');
const bot = require('../bot');

const checkChannelsCondition = async () => {
    try {
        const result = await db.execute(`SELECT * FROM channels`);
        const channels = result.rows;

        for (const ch of channels) {
            if (ch.condition_type === 'time') {
                const added = ch.added_at || Date.now();
                const passed = Date.now() - added;
                
                if (passed >= ch.condition_value) {
                    await db.execute({ sql: `DELETE FROM channels WHERE id = ?`, args: [ch.id] });
                    if (ch.owner_id) {
                        bot.sendMessage(ch.owner_id, `ℹ️ Sizning <b>${ch.name}</b> kanalingiz botimiz majburiy a'zoligidan olib tashlandi, chunki belgilangan <b>vaqt</b> o'z nihoyasiga yetdi!`, { parse_mode: "HTML" }).catch(()=>{});
                    }
                    console.log(`Kanal (ID: ${ch.id}) vaqt sharti tugagani uchun o'chirildi.`);
                }
            } else if (ch.condition_type === 'members') {
                try {
                    const memberCount = await bot.getChatMemberCount(ch.chat_id);
                    if (memberCount >= ch.condition_value) {
                        await db.execute({ sql: `DELETE FROM channels WHERE id = ?`, args: [ch.id] });
                        if (ch.owner_id) {
                            bot.sendMessage(ch.owner_id, `ℹ️ Sizning <b>${ch.name}</b> kanalingiz botimiz majburiy a'zoligidan olib tashlandi, chunki u siz belgilagan <b>odam soniga (${ch.condition_value} ta)</b> yetdi!`, { parse_mode: "HTML" }).catch(()=>{});
                        }
                        console.log(`Kanal (ID: ${ch.id}) odam soni sharti bajarilgani uchun o'chirildi (${memberCount} / ${ch.condition_value}).`);
                    }
                } catch (e) {
                    // Agar bot o'chirilgan bo'lsa yoki admin bo'lmasa xato berishi mumkin
                }
            }
        }
    } catch (e) {
        console.error("checkChannelsCondition xatolik:", e);
    }
};

module.exports = {
    checkChannelsCondition
};
