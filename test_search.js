const db = require('./base/db');
const { searchMoviesByName } = require('./base/models/movies.model');

async function test() {
    try {
        const result = await searchMoviesByName('a');
        console.log("Result:", result);
    } catch (e) {
        console.error(e);
    }
}
test();
