const bot = require("../../bot");

const postToCloudChannels = async (item, type) => {
    const watchChannelId = process.env.CLOUD_WATCH_CHANNEL_ID;
    const downloadChannelId = process.env.CLOUD_DOWNLOAD_CHANNEL_ID;
    
    let text = "";
    let fileId = "";
    
    if (type === "movie") {
        text = `🎬 <b>Kodi:</b> ${item.code}\n\n${item.caption}`;
        fileId = item.file_id;
    } else if (type === "episode") {
        let title = item.series && item.series.caption ? item.series.caption.split("\n")[0].replace("Serial nomi:", "Serial:") : "";
        text = `📺 <b>Kodi:</b> ${item.code}\n${title}\n🎬 <b>Qism: ${item.epNum}</b>`;
        fileId = item.file_id;
    }

    if (!fileId || fileId === "kutilyapti") return;

    if (watchChannelId) {
        try {
            await bot.sendVideo(watchChannelId, fileId, {
                caption: text,
                parse_mode: "HTML",
                protect_content: true
            });
        } catch (e) {
            console.error("Watch kanaliga yuborishda xato:", e);
        }
    }

    if (downloadChannelId) {
        try {
            await bot.sendVideo(downloadChannelId, fileId, {
                caption: text,
                parse_mode: "HTML",
                protect_content: false
            });
        } catch (e) {
            console.error("Download kanaliga yuborishda xato:", e);
        }
    }
};

module.exports = { postToCloudChannels };
