const { createClient } = require('@libsql/client');
require('dotenv').config();

const db = createClient({
  url: process.env.BASE_URL,
  authToken: process.env.BASE_KEY,
});

module.exports = db;
