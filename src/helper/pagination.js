const generateEpisodePagination = (episodes, page, code, callbackPrefix) => {
    const ITEMS_PER_ROW = 5;
    const ROWS_PER_PAGE = 2;
    const ITEMS_PER_PAGE = ITEMS_PER_ROW * ROWS_PER_PAGE;
    
    const totalPages = Math.ceil(episodes.length / ITEMS_PER_PAGE) || 1;
    const currentPage = Math.max(1, Math.min(page, totalPages));
    
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const currentEpisodes = episodes.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    
    let inline_keyboard = [];
    let row = [];
    
    for (let ep of currentEpisodes) {
        let text = `${ep.episode_num}`;
        if (callbackPrefix && callbackPrefix.includes("del")) text = `🗑 ${text}`;
        
        let cbData = callbackPrefix ? `${callbackPrefix}_ep_${code}_${ep.episode_num}` : `ep_${code}_${ep.episode_num}`;
        
        row.push({ text: text, callback_data: cbData });
        if (row.length === ITEMS_PER_ROW) {
            inline_keyboard.push(row);
            row = [];
        }
    }
    if (row.length > 0) inline_keyboard.push(row);
    
    // Pagination row
    if (totalPages > 1) {
        let paginationRow = [];
        let pageCbPrefix = callbackPrefix ? `${callbackPrefix}_page` : `page`;
        
        if (currentPage > 1) {
            paginationRow.push({ text: "◀️", callback_data: `${pageCbPrefix}_${code}_${currentPage - 1}` });
        } else {
            paginationRow.push({ text: "🚫", callback_data: "ignore_pagination" });
        }
        
        paginationRow.push({ text: `[ ${currentPage} / ${totalPages} ]`, callback_data: "ignore_pagination" });
        
        if (currentPage < totalPages) {
            paginationRow.push({ text: "▶️", callback_data: `${pageCbPrefix}_${code}_${currentPage + 1}` });
        } else {
            paginationRow.push({ text: "🚫", callback_data: "ignore_pagination" });
        }
        inline_keyboard.push(paginationRow);
    }
    
    return inline_keyboard;
};

module.exports = {
    generateEpisodePagination
};