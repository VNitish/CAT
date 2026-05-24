// Local dev entrypoint: starts the Express app on PORT (default 4000) so
// `next dev` can proxy /api/* to it via the rewrites in next.config.ts.
// Not used in production — Vercel routes directly to [...all].js.
const app = require('./_express');
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
