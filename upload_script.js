require('dotenv').config();
const db = require('./base/db');
const { postToCloudChannels } = require('./src/automatic/channels/cloud');

const delay = ms => new Promise(res => setTimeout(res, ms));

(async () => {
    try {
        console.log('Starting upload...');
        
        const movies = (await db.execute('SELECT * FROM movies')).rows;
        console.log('Topildi: ' + movies.length + ' ta kino.');
        
        for (const movie of movies) {
            console.log('Yuklanmoqda: Kodi ' + movie.code);
            await postToCloudChannels(movie, 'movie');
            await delay(3000);
        }

        const episodes = (await db.execute('SELECT * FROM episodes')).rows;
        console.log('Topildi: ' + episodes.length + ' ta serial qismi.');
        
        if (episodes.length > 0) {
            const { getSeries } = require('./base/models/series.model');
            for (const ep of episodes) {
                console.log('Yuklanmoqda: Serial kodi ' + ep.series_code + ', Qism ' + ep.episode_num);
                const seriesInfo = await getSeries(ep.series_code);
                const item = {
                    code: ep.series_code,
                    epNum: ep.episode_num,
                    file_id: ep.file_id,
                    series: seriesInfo
                };
                await postToCloudChannels(item, 'episode');
                await delay(3000);
            }
        }

        console.log('Barcha bazadagi videolar muvaffaqiyatli yuklandi!');
        process.exit(0);
    } catch (e) {
        console.error('Xatolik yuz berdi:', e);
        process.exit(1);
    }
})();
