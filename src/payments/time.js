/**
 * Format the remaining time into a human-readable string.
 * @param {number} expire_at - Timestamp of expiration in ms
 * @returns {string} - Formatted remaining time
 */
const formatTimeLeft = (expire_at) => {
    const diff = expire_at - Date.now();
    if (diff <= 0) return "Tugagan";
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    
    let res = [];
    if (days > 0) res.push(`${days} kun`);
    if (hours > 0) res.push(`${hours} soat`);
    if (minutes > 0) res.push(`${minutes} daqiqa`);
    if (res.length === 0) return "1 daqiqadan kam";
    return res.join(" ");
};

/**
 * Calculate the new expiration time based on previous expiration and duration string.
 * @param {number|null} existingExpireAt - Existing expiration timestamp (or null)
 * @param {string} durationStr - Duration string, e.g. "1m" (1 minute), "24" (24 hours or days based on type)
 * @param {string} type - 'watch' (days) or 'download' (hours)
 * @returns {number} - New expiration timestamp
 */
const calculateExpiration = (existingExpireAt, durationStr, type) => {
    const now = Date.now();
    let baseTime = now;
    
    // Agar oldin sotib olgan obunasi tugamagan bo'lsa, o'sha qolgan vaqt ustiga qo'shamiz
    if (existingExpireAt && existingExpireAt > now) {
        baseTime = existingExpireAt;
    }
    
    let expire_at = baseTime;
    
    if (typeof durationStr === 'string' && durationStr.endsWith('m')) {
        expire_at += parseInt(durationStr) * 60 * 1000; 
    } else if (typeof durationStr === 'string' && durationStr.endsWith('h')) {
        expire_at += parseInt(durationStr) * 60 * 60 * 1000; 
    } else if (typeof durationStr === 'string' && durationStr.endsWith('d')) {
        expire_at += parseInt(durationStr) * 24 * 60 * 60 * 1000; 
    } else {
        // Fallback for old integer logic
        const duration = parseInt(durationStr);
        if (type === 'watch') {
            expire_at += duration * 24 * 60 * 60 * 1000; 
        } else if (type === 'download') {
            expire_at += duration * 60 * 60 * 1000; 
        }
    }

    return expire_at;
};

module.exports = {
    formatTimeLeft,
    calculateExpiration
};
