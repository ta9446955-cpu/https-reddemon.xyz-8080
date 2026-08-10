// index.js
// Reddemon YouTube Stremio Addon — Node.js/Express format for Render.com

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNEL_ID = 'UC0VZ-fNPzIpEUoBkk63ASZg';

// Cache playlists in memory
let cachedPlaylists = [];
let lastFetched = 0;

// ── Fetch ALL channel playlists with pagination ───────────────────────────────
async function getChannelPlaylists() {
    if (cachedPlaylists.length > 0 && Date.now() - lastFetched < 3600000) {
        return cachedPlaylists;
    }

    let allPlaylists = [];
    let nextPageToken = '';

    do {
        const pageParam = nextPageToken ? `&pageToken=${nextPageToken}` : '';
        const url = `https://www.googleapis.com/youtube/v3/playlists?part=snippet&channelId=${CHANNEL_ID}&maxResults=50&key=${YOUTUBE_API_KEY}${pageParam}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);
        const data = await res.json();

        const items = (data.items || []).map(item => ({
            id: item.id,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails?.medium?.url || null
        }));

        allPlaylists = allPlaylists.concat(items);
        nextPageToken = data.nextPageToken || '';
    } while (nextPageToken);

    cachedPlaylists = allPlaylists;
    lastFetched = Date.now();
    console.log(`Fetched ${cachedPlaylists.length} playlists`);
    return cachedPlaylists;
}

// ── Manifest ──────────────────────────────────────────────────────────────────
app.get('/manifest.json', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
        const playlists = await getChannelPlaylists();
        const catalogs = playlists.map(pl => ({
            type: 'movie',
            id: `yt-${pl.id}`,
            name: pl.title
        }));
        res.json({
            id: 'community.reddemon.youtube',
            version: '1.1.0',
            name: 'Reddemon YouTube',
            description: 'Your YouTube playlists in Stremio.',
            logo: 'https://www.youtube.com/favicon.ico',
            resources: ['catalog', 'meta', 'stream'],
            types: ['movie'],
            idPrefixes: ['yt-'],
            catalogs
        });
    } catch (e) {
        console.error('Manifest error:', e.message);
        res.json({
            id: 'community.reddemon.youtube',
            version: '1.1.0',
            name: 'Reddemon YouTube',
            description: 'Your YouTube playlists in Stremio.',
            logo: 'https://www.youtube.com/favicon.ico',
            resources: ['catalog', 'meta', 'stream'],
            types: ['movie'],
            idPrefixes: ['yt-'],
            catalogs: []
        });
    }
});

// ── Catalog: playlist videos ──────────────────────────────────────────────────
app.get('/catalog/movie/:catalogId.json', async (req, res) => {
    const { catalogId } = req.params;
    const playlistId = catalogId.replace(/^yt-/, '');

    try {
        let allVideos = [];
        let nextPageToken = '';

        do {
            const pageParam = nextPageToken ? `&pageToken=${nextPageToken}` : '';
            const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&key=${YOUTUBE_API_KEY}${pageParam}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`YouTube API error: ${response.status}`);
            const data = await response.json();

            const items = (data.items || [])
                .filter(item => item.snippet.resourceId?.kind === 'youtube#video')
                .map(item => ({
                    id: `yt-${item.snippet.resourceId.videoId}`,
                    type: 'movie',
                    name: item.snippet.title,
                    poster: item.snippet.thumbnails?.medium?.url || null,
                    background: item.snippet.thumbnails?.high?.url || null,
                    description: item.snippet.description
                }));

            allVideos = allVideos.concat(items);
            nextPageToken = data.nextPageToken || '';
        } while (nextPageToken);

        res.json({ metas: allVideos });
    } catch (e) {
        console.error('Catalog error:', e.message);
        res.json({ metas: [] });
    }
});

// ── Meta ──────────────────────────────────────────────────────────────────────
app.get('/meta/movie/:id.json', async (req, res) => {
    const videoId = req.params.id.replace(/^yt-/, '');
    try {
        const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        const item = data.items && data.items[0];
        if (!item) return res.json({ meta: {} });

        res.json({
            meta: {
                id: `yt-${videoId}`,
                type: 'movie',
                name: item.snippet.title,
                poster: item.snippet.thumbnails?.medium?.url || null,
                background: item.snippet.thumbnails?.maxres?.url || item.snippet.thumbnails?.high?.url || null,
                description: item.snippet.description,
                releaseInfo: item.snippet.publishedAt?.split('T')[0] || null
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
            {
                name: 'YouTube',
                title: 'Open in YouTube App',
                externalUrl: `vnd.youtube:${videoId}`
            },
            {
                name: 'YouTube',
                title: 'Open in Browser',
                externalUrl: `https://www.youtube.com/watch?v=${videoId}`
            }
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
        cachedPlaylists: cachedPlaylists.length
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Reddemon YouTube Addon running on port ${PORT}`);
    if (!YOUTUBE_API_KEY) console.warn('WARNING: YOUTUBE_API_KEY is not set');
});
