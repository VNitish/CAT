// Vercel serverless catch-all: every /api/* request is handled by the Express
// app defined in _express.js. Vercel auto-discovers this file because it lives
// in the top-level `api/` directory.
const app = require('./_express');
module.exports = (req, res) => app(req, res);
