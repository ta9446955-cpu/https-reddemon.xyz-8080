// index.js
// Reddemon YouTube Stremio Addon (Node.js/Express, for Render.com)
//
// Environment variables:
//   YOUTUBE_API_KEY   (required) your YouTube Data API key
//   CHANNEL_ID        (optional) channel whose public playlists become catalogs
//   EXTRA_PLAYLISTS   (optional) extra playlists to add, comma separated, written as
//                     PLAYLIST_ID|Name   e.g.  PLabc123|Best Songs,PLdef456|Chill Mix

const express = require('express');
const cors = require('cors');
const fetch = globalThis.fetch || require('node-fetch');

const app = express();
app.use(cors());

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNEL_ID = process.env.CHANNEL_ID || 'UC0VZ-fNPzIpEUoBkk63ASZg';
const PAGE = 100; // titles returned per catalog page

const EXTRA = (process.env.EXTRA_PLAYLISTS || '')
    .split(',').map(s => s.trim()).filter(Boolean)
    .map(s => {
        const i = s.indexOf('|');
        return i > 0
            ? { id: s.slice(0, i).trim(), title: s.slice(i + 1).trim() || s.slice(0, i).trim() }
            : { id: s, title: s };
    });

async function getJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);
    return res.json();
}

// ── Channel playlists (cached 1 hour) ─────────────────────────────────────────
let cachedPlaylists = [];
let lastFetched = 0;

async function getChannelPlaylists() {
    if (cachedPlaylists.length > 0 && Date.now() - lastFetched < 3600000) return cachedPlaylists;

    let all = [];
    let token = '';
    do {
        const pg = token ? `&pageToken=${token}` : '';
        const data = await getJSON(
            `https://www.googleapis.com/youtube/v3/playlists?part=snippet&channelId=${CHANNEL_ID}&maxResults=50&key=${YOUTUBE_API_KEY}${pg}`
        );
        all = all.concat((data.items || []).map(i => ({ id: i.id, title: i.snippet.title })));
        token = data.nextPageToken || '';
    } while (token);

    cachedPlaylists = all;
    lastFetched = Date.now();
    console.log(`Fetched ${all.length} playlists`);
    return all;
}

// Extra playlists first, then the channel's, without duplicates
async function allPlaylists() {
    let channel = [];
    try { channel = await getChannelPlaylists(); }
    catch (e) { console.error('Playlists error:', e.message); }
    const seen = new Set();
    return [...EXTRA, ...channel].filter(p => !seen.has(p.id) && seen.add(p.id));
}

// ── Playlist videos (fetched page by page, cached 30 minutes) ────────────────
const itemCache = new Map();

async function loadItems(pid, need) {
    let c = itemCache.get(pid);
    if (!c || Date.now() - c.t > 1800000) {
        c = { items: [], ids: new Set(), next: '', done: false, t: Date.now() };
        itemCache.set(pid, c);
    }
    while (!c.done && c.items.length < need) {
        const pg = c.next ? `&pageToken=${c.next}` : '';
        const data = await getJSON(
            `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${encodeURIComponent(pid)}&maxResults=50&key=${YOUTUBE_API_KEY}${pg}`
        );
        for (const it of data.items || []) {
            const sn = it.snippet;
            if (!sn || !sn.resourceId || sn.resourceId.kind !== 'youtube#video') continue;
            if (sn.title === 'Private video' || sn.title === 'Deleted video') continue;
            const id = `yt-${sn.resourceId.videoId}`;
            if (c.ids.has(id)) continue;
            c.ids.add(id);
            c.items.push({
                id,
                type: 'movie',
                name: sn.title,
                poster: (sn.thumbnails && (sn.thumbnails.medium || {}).url) || undefined,
                background: (sn.thumbnails && (sn.thumbnails.high || {}).url) || undefined,
                description: (sn.description || '').slice(0, 300)
            });
        }
        c.next = data.nextPageToken || '';
        if (!c.next) c.done = true;
    }
    return c;
}

function manifestBody(catalogs) {
    return {
        id: 'community.reddemon.youtube',
        version: '1.2.0',
        name: 'Reddemon YouTube',
        description: 'Your YouTube playlists in Stremio.',
        logo: 'https://www.youtube.com/favicon.ico',
        resources: ['catalog', 'meta', 'stream'],
        types: ['movie'],
        idPrefixes: ['yt-'],
        catalogs
    };
}

// ── Manifest ──────────────────────────────────────────────────────────────────
app.get('/manifest.json', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    const playlists = await allPlaylists();
    res.json(manifestBody(playlists.map(pl => ({
        type: 'movie',
        id: `yt-${pl.id}`,
        name: pl.title,
        extra: [{ name: 'skip' }]
    }))));
});

// ── Catalog (supports paging with skip) ───────────────────────────────────────
app.get(['/catalog/:type/:catalogId.json', '/catalog/:type/:catalogId/:extra.json'], async (req, res) => {
    const { type, catalogId, extra } = req.params;
    if (type !== 'movie') return res.json({ metas: [] });

    const playlistId = catalogId.replace(/^yt-/, '');
    const skip = parseInt(new URLSearchParams(extra || '').get('skip') || '0', 10) || 0;

    try {
        const c = await loadItems(playlistId, skip + PAGE);
        res.json({ metas: c.items.slice(skip, skip + PAGE) });
    } catch (e) {
        console.error('Catalog error:', e.message);
        res.json({ metas: [] });
    }
});

// ── Meta ──────────────────────────────────────────────────────────────────────
app.get('/meta/movie/:id.json', async (req, res) => {
    const videoId = req.params.id.replace(/^yt-/, '');
    try {
        const data = await getJSON(
            `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${encodeURIComponent(videoId)}&key=${YOUTUBE_API_KEY}`
        );
        const item = data.items && data.items[0];
        if (!item) return res.json({ meta: {} });
        const t = item.snippet.thumbnails || {};
        res.json({
            meta: {
                id: `yt-${videoId}`,
                type: 'movie',
                name: item.snippet.title,
                poster: (t.medium || {}).url,
                background: (t.maxres || t.high || {}).url,
                description: item.snippet.description,
                releaseInfo: (item.snippet.publishedAt || '').split('T')[0] || undefined
            }
        });
    } catch (e) {
        console.error('Meta error:', e.message);
        res.json({ meta: {} });
    }
});

// ── Stream ────────────────────────────────────────────────────────────────────
app.get('/stream/movie/:id.json', (req, res) => {
    const videoId = req.params.id.replace(/^yt-/, '');
    res.json({
        streams: [
            { name: 'YouTube', title: 'Play (YouTube player)', ytId: videoId },
            { name: 'YouTube', title: 'Open in YouTube App', externalUrl: `vnd.youtube:${videoId}` },
            { name: 'YouTube', title: 'Open in Browser', externalUrl: `https://www.youtube.com/watch?v=${videoId}` }
        ]
    });
});

// ── Landing page ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
    const host = req.get('host');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reddemon YouTube Addon</title>
  <style>
    body { font-family: Arial, sans-serif; background: #1a1a1a; color: white; text-align: center; padding: 40px 20px; max-width: 600px; margin: 0 auto; }
    h1 { color: #ff0000; }
    .btn { background: #7b5cff; color: white; padding: 14px 28px; border-radius: 6px; font-size: 1.1em; text-decoration: none; display: inline-block; margin: 10px; }
    .url-box { background: #111; padding: 12px; border-radius: 6px; word-break: break-all; font-family: monospace; font-size: 0.9em; margin: 20px 0; }
  </style>
</head>
<body>
  <h1>📺 Reddemon YouTube</h1>
  <p>Watch your YouTube playlists in Stremio.</p>
  <div class="url-box">https://${host}/manifest.json</div>
  <a class="btn" href="stremio://${host}/manifest.json">Install in Stremio</a>
</body>
</html>`);
});

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        youtube: YOUTUBE_API_KEY ? 'set' : 'NOT SET',
        cachedPlaylists: cachedPlaylists.length,
        extraPlaylists: EXTRA.length
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Reddemon YouTube Addon running on port ${PORT}`);
    if (!YOUTUBE_API_KEY) console.warn('WARNING: YOUTUBE_API_KEY is not set');
});
