const bot = require('../bot');

const startSearchAnimation = async (chatId, textBase = "⏳ Global bazadan izlanmoqda") => {
    let msg;
    try {
        msg = await bot.sendMessage(chatId, `${textBase}.`);
    } catch (e) {
        return { stop: async () => {} };
    }
    
    let count = 1;
    let isStopped = false;
    
    const interval = setInterval(() => {
        if (isStopped) return;
        count = (count % 3) + 1;
        const dots = ".".repeat(count);
        bot.editMessageText(`${textBase}${dots}`, {
            chat_id: chatId,
            message_id: msg.message_id
        }).catch(() => {});
    }, 800);

    return {
        stop: async () => {
            isStopped = true;
            clearInterval(interval);
            try {
                await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
            } catch (e) {}
        }
    }
};

module.exports = { startSearchAnimation };
