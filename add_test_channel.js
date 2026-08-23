require('dotenv').config();
const { addChannel } = require('./base/models/channel.model');

async function run() {
    const chat_id = '-1004368125013';
    const name = "Test Kanal";
    const link = "https://t.me/+o2Rj-8G5cYMwNmIy"; // Placeholder
    
    await addChannel(chat_id, name, link);
    console.log("Added channel successfully!");
    process.exit(0);
}

run();
