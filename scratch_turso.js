const db = require('./base/db');

async function clearMoviesAndSeries() {
    try {
        console.log("Kino va seriallarni tozalash boshlandi...");
        
        await db.execute('DELETE FROM movies');
        console.log(" Kinolar (movies) jadvali tozalandi.");
        
        await db.execute('DELETE FROM series');
        console.log(" Seriallar (series) jadvali tozalandi.");
        
        await db.execute('DELETE FROM episodes');
        console.log(" Serial qismlari (episodes) jadvali tozalandi.");
        
        console.log("Tozalash muvaffaqiyatli yakunlandi!");
    } catch (error) {
        console.error("Xatolik yuz berdi:", error);
    }
    process.exit(0);
}

clearMoviesAndSeries();
