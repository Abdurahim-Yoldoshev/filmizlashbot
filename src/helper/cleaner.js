function cleanCaption(text, { overrideSize, overrideDuration } = {}) {
    if (!text) return '';

    let lines = text.split('\n');
    
    const spamKeywords = [
        'obuna bo', 'bizning kanal', 'kanalimiz', 'telegram kanal', 
        'rasmiy kanal', 'do\'stlar', "do'stlar", "tarqat", 'ulashing', 
        'rek', 'admin', 't.me/', 'http://', 'https://', 'youtube.com',
        'kino kodi', 'kodni', 'botimiz', 'kino kodi', 'kodi:', 'kod:',
        '👉', '👇', 'obuna'
    ];

    let cleanLines = [];
    for (let line of lines) {
        let lower = line.toLowerCase();
        let isSpam = false;
        
        if (lower.match(/^[\s\p{Emoji}]*@[a-z0-9_]+[\s\p{Emoji}]*$/iu)) isSpam = true;

        for (const kw of spamKeywords) {
            if (lower.includes(kw)) {
                isSpam = true;
                break;
            }
        }
        
        if (!isSpam) {
            line = line.replace(/@[a-zA-Z0-9_]+/g, '');
            line = line.replace(/#[a-zA-Z0-9_]+/g, (match) => {
                const m = match.toLowerCase();
                if (m.includes('kanal') || m.includes('bot') || m.includes('rek')) return '';
                return match;
            });
            let trimmed = line.trim();
            if (trimmed) cleanLines.push(trimmed);
        }
    }
    
    let fields = { name: '', year: '', genre: '', language: '', quality: '', size: '', country: '', info: '', extra: [] };
    let currentField = 'extra';

    for (let line of cleanLines) {
        let lower = line.toLowerCase();
        
        if (lower.match(/^[\s\p{Emoji}]*(?:kino\s*)?(?:nomi|sarlavha)\s*:/iu)) {
            fields.name = line.replace(/^[\s\p{Emoji}]*(?:kino\s*)?(?:nomi|sarlavha)\s*:/iu, '').trim();
            currentField = 'name';
        } else if (lower.match(/^[\s\p{Emoji}]*(?:chiqqan\s*)?yili?\s*:/iu)) {
            fields.year = line.replace(/^[\s\p{Emoji}]*(?:chiqqan\s*)?yili?\s*:/iu, '').trim();
            currentField = 'year';
        } else if (lower.match(/^[\s\p{Emoji}]*janri?\s*:/iu)) {
            fields.genre = line.replace(/^[\s\p{Emoji}]*janri?\s*:/iu, '').trim();
            currentField = 'genre';
        } else if (lower.match(/^[\s\p{Emoji}]*(?:tarjima\s*|tili?\s*):/iu)) {
            fields.language = line.replace(/^[\s\p{Emoji}]*(?:tarjima\s*|tili?\s*):/iu, '').trim();
            currentField = 'language';
        } else if (lower.match(/^[\s\p{Emoji}]*(?:sifati?|format)\s*:/iu)) {
            fields.quality = line.replace(/^[\s\p{Emoji}]*(?:sifati?|format)\s*:/iu, '').trim();
            currentField = 'quality';
        } else if (lower.match(/^[\s\p{Emoji}]*(?:hajmi?|razmer)\s*:/iu)) {
            fields.size = line.replace(/^[\s\p{Emoji}]*(?:hajmi?|razmer)\s*:/iu, '').trim();
            currentField = 'size';
        } else if (lower.match(/^[\s\p{Emoji}]*(?:davlat|mamlakat)i?\s*:/iu)) {
            fields.country = line.replace(/^[\s\p{Emoji}]*(?:davlat|mamlakat)i?\s*:/iu, '').trim();
            currentField = 'country';
        } else if (lower.match(/^[\s\p{Emoji}]*(?:kino\s*)?(?:haqida|mazmuni|ma['`]?lumoti?)\s*:/iu)) {
            fields.info = line.replace(/^[\s\p{Emoji}]*(?:kino\s*)?(?:haqida|mazmuni|ma['`]?lumoti?)\s*:/iu, '').trim();
            currentField = 'info';
        } else {
            if (currentField === 'info') fields.info += '\n' + line;
            else if (currentField === 'name') fields.name += ' ' + line;
            else fields.extra.push(line);
        }
    }

    let reconstructed = [];
    if (fields.name) reconstructed.push(`🎬 Kino nomi: ${fields.name}`);
    if (fields.year) reconstructed.push(`📅 Yili: ${fields.year}`);
    if (fields.genre) reconstructed.push(`🎭 Janri: ${fields.genre}`);
    if (fields.language) reconstructed.push(`🌐 Tili: ${fields.language}`);
    if (fields.country) reconstructed.push(`🇺🇿 Davlati: ${fields.country}`);
    if (fields.quality) reconstructed.push(`💿 Sifati: ${fields.quality}`);
    
    let finalSize = overrideSize || fields.size;
    if (finalSize) reconstructed.push(`💾 Hajmi: ${finalSize}`);
    
    if (overrideDuration) reconstructed.push(`⏱ Vaqti: ${overrideDuration}`);
    
    if (fields.info) reconstructed.push(`\n📝 Ma'lumot:\n${fields.info}`);

    let extraText = fields.extra.join('\n').trim();
    if (extraText) {
        if (reconstructed.length === 0) {
            return extraText; // Agar hech qanday maxsus qator topilmasa, borini qaytaramiz
        } else {
            reconstructed.push(`\n📌 Qo'shimcha:\n${extraText}`);
        }
    }
    
    if (reconstructed.length > 0) {
        return reconstructed.join('\n').trim();
    }

    // Fallback
    let fallback = cleanLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (fallback.length < 5) {
        fallback = text.replace(/@[a-zA-Z0-9_]+/g, '')
                     .replace(/https?:\/\/[^\s]+/g, '')
                     .replace(/t\.me\/[^\s]+/g, '')
                     .replace(/\n{3,}/g, '\n\n')
                     .trim();
    }
    return fallback;
}

module.exports = {
    cleanCaption
};
