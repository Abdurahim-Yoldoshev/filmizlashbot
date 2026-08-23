const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const bot = new TelegramBot(process.env.TOKEN, { 
    polling: {
        params: {
            allowed_updates: ['message', 'callback_query', 'message_reaction', 'message_reaction_count', 'my_chat_member', 'chat_member', 'channel_post']
        }
    } 
});

bot.on('polling_error', (error) => {
    console.log("Polling error (network issue):", error.code || error.message);
});

bot.on('error', (error) => {
    console.log("Bot general error:", error.code || error.message);
});

// --- Patch TelegramBot methods to fallback on delete and send ---
const patchMethod = (methodName) => {
    const original = bot[methodName].bind(bot);
    bot[methodName] = async function (...args) {
        try {
            return await original(...args);
        } catch (error) {
            const options = args[1];
            if (options && typeof options === 'object' && options.chat_id && options.message_id) {
                if (error.response && error.response.body && error.response.body.description && error.response.body.description.includes('not modified')) {
                    return; // Ignore "message is not modified" error
                }
                
                try {
                    await bot.deleteMessage(options.chat_id, options.message_id);
                } catch (delError) {}

                const sendOpts = { ...options };
                delete sendOpts.chat_id;
                delete sendOpts.message_id;

                if (methodName === 'editMessageText') {
                    const text = args[0];
                    return await bot.sendMessage(options.chat_id, text, sendOpts);
                } else if (methodName === 'editMessageCaption') {
                    const caption = args[0];
                    return await bot.sendMessage(options.chat_id, caption || "Ma'lumot yangilandi", sendOpts);
                } else if (methodName === 'editMessageMedia') {
                    const media = args[0];
                    if (media.caption) sendOpts.caption = media.caption;
                    if (media.parse_mode) sendOpts.parse_mode = media.parse_mode;
                    
                    if (media.type === 'photo') {
                        return await bot.sendPhoto(options.chat_id, media.media, sendOpts);
                    } else if (media.type === 'video') {
                        return await bot.sendVideo(options.chat_id, media.media, sendOpts);
                    } else if (media.type === 'document') {
                        return await bot.sendDocument(options.chat_id, media.media, sendOpts);
                    }
                } else if (methodName === 'editMessageReplyMarkup') {
                    return;
                }
            }
            throw error;
        }
    };
};

patchMethod('editMessageText');
patchMethod('editMessageCaption');
patchMethod('editMessageMedia');
patchMethod('editMessageReplyMarkup');

module.exports = bot;
require('./message');
require('./query');