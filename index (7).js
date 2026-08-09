// index.js
// Reddemon YouTube Stremio Addon — Node.js/Express format for Render.com

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// In-memory token store
const tokenStore = {};

// ── Manifest builder ──────────────────────────────────────────────────────────
function buildManifest(userKey, playlists) {
    const catalogs = playlists.map(pl => ({
        type: 'movie',
        id: `yt-${pl.id}`,
        name: pl.title
    }));

    return {
        id: 'community.reddemon.youtube',
        version: '1.0.0',
        name: 'Reddemon YouTube',
        description: 'Your YouTube playlists as Stremio catalogs.',
        logo: 'https://www.youtube.com/favicon.ico',
        resources: ['catalog', 'stream'],
        types: ['movie'],
        idPrefixes: ['yt-'],
        catalogs
    };
}

// ── YouTube API helper ────────────────────────────────────────────────────────
async function ytGet(path, accessToken) {
    const res = await fetch(`https://www.googleapis.com/youtube/v3${path}`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
        }
    });
    if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);
    return res.json();
}

// ── Fetch user playlists ──────────────────────────────────────────────────────
async function getUserPlaylists(accessToken) {
    const data = await ytGet('/playlists?part=snippet&mine=true&maxResults=50', accessToken);
    return (data.items || []).map(item => ({
        id: item.id,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails?.medium?.url || null
    }));
}

// ── Landing page ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reddemon YouTube Addon</title>
  <style>
    body { font-family: Arial, sans-serif; background: #1a1a1a; color: white; text-align: center; padding: 40px 20px; max-width: 600px; margin: 0 auto; }
    h1 { color: #ff0000; }
    .btn { background: #ff0000; color: white; padding: 14px 28px; border: none; border-radius: 6px; font-size: 1.1em; cursor: pointer; display: inline-block; margin: 10px; }
    .btn:hover { background: #cc0000; }
    .btn-install { background: #7b5cff; }
    .btn-install:hover { background: #6245e0; }
    .box { background: #2a2a2a; border-radius: 10px; padding: 20px; margin: 20px 0; }
    .code { font-size: 2em; font-weight: bold; color: #ff0000; letter-spacing: 4px; margin: 15px 0; }
    .url-box { background: #111; padding: 12px; border-radius: 6px; word-break: break-all; font-family: monospace; font-size: 0.9em; margin: 10px 0; }
    #step1 { display: block; } #step2, #step3 { display: none; }
    .spinner { display: inline-block; width: 20px; height: 20px; border: 3px solid #444; border-top-color: #ff0000; border-radius: 50%; animation: spin 0.8s linear infinite; vertical-align: middle; margin-right: 8px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <h1>📺 Reddemon YouTube</h1>
  <p>Connect your YouTube account to watch your playlists in Stremio.</p>

  <div id="step1" class="box">
    <h2>Step 1 — Connect YouTube</h2>
    <p>Click below to get your YouTube authorization code.</p>
    <button class="btn" onclick="startAuth()">Connect YouTube Account</button>
  </div>

  <div id="step2" class="box">
    <h2>Step 2 — Authorize</h2>
    <p>Go to <strong><a href="https://google.com/device" target="_blank" style="color:#ff0000">google.com/device</a></strong> and enter this code:</p>
    <div class="code" id="userCode">------</div>
    <p><span class="spinner"></span> Waiting for authorization...</p>
    <p id="pollStatus" style="color:#ff6b6b;"></p>
  </div>

  <div id="step3" class="box">
    <h2>Step 3 — Install in Stremio</h2>
    <p>Your YouTube account is connected! Paste this URL into Stremio's addon install field:</p>
    <div class="url-box" id="manifestUrl"></div>
    <a class="btn btn-install" id="installBtn" href="#">Install in Stremio</a>
  </div>

  <script>
    const BASE_URL = '${baseUrl}';
    let pollInterval = null;

    async function startAuth() {
      document.getElementById('step1').style.display = 'none';
      document.getElementById('step2').style.display = 'block';
      try {
        const res = await fetch(BASE_URL + '/auth/start');
        const data = await res.json();
        if (data.error) { document.getElementById('pollStatus').textContent = 'Error: ' + data.error; return; }
        document.getElementById('userCode').textContent = data.user_code;
        pollInterval = setInterval(async () => {
          try {
            const poll = await fetch(BASE_URL + '/auth/poll?device_code=' + encodeURIComponent(data.device_code));
            const result = await poll.json();
            if (result.ready && result.key) { clearInterval(pollInterval); showInstall(result.key); }
            else if (result.error) { clearInterval(pollInterval); document.getElementById('pollStatus').textContent = 'Error: ' + result.error + '. Please refresh and try again.'; }
          } catch(e) { clearInterval(pollInterval); document.getElementById('pollStatus').textContent = 'Network error. Please refresh.'; }
        }, 5000);
      } catch(e) { document.getElementById('pollStatus').textContent = 'Failed to connect. Please refresh.'; }
    }

    function showInstall(userKey) {
      document.getElementById('step2').style.display = 'none';
      document.getElementById('step3').style.display = 'block';
      const manifestUrl = BASE_URL + '/' + userKey + '/manifest.json';
      document.getElementById('manifestUrl').textContent = manifestUrl;
      document.getElementById('installBtn').href = 'stremio://' + manifestUrl.replace('https://', '').replace('http://', '');
    }
  </script>
</body>
</html>`);
});

// ── Auth: start device flow ───────────────────────────────────────────────────
app.get('/auth/start', async (req, res) => {
    if (!GOOGLE_CLIENT_ID) return res.json({ error: 'GOOGLE_CLIENT_ID not set' });
    try {
        const response = await fetch('https://oauth2.googleapis.com/device/code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: GOOGLE_CLIENT_ID,
                scope: 'https://www.googleapis.com/auth/youtube.readonly'
            })
        });
        const text = await response.text();
        if (!response.ok) {
            console.error(`Google device code error ${response.status}: ${text}`);
            return res.json({ error: `Google returned ${response.status}` });
        }
        const data = JSON.parse(text);
        res.json({
            device_code: data.device_code,
            user_code: data.user_code,
            verification_url: data.verification_url,
            expires_in: data.expires_in,
            interval: data.interval
        });
    } catch (e) {
        console.error('Auth start error:', e.message);
        res.json({ error: e.message });
    }
});

// ── Auth: poll for token ──────────────────────────────────────────────────────
app.get('/auth/poll', async (req, res) => {
    const deviceCode = req.query.device_code;
    if (!deviceCode) return res.json({ error: 'missing device_code' });
    try {
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                device_code: deviceCode,
                grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
            })
        });

        if (response.status === 200) {
            const tokens = await response.json();
            const userKey = crypto.randomBytes(8).toString('hex');

            // Fetch user playlists immediately after auth
            let playlists = [];
            try {
                playlists = await getUserPlaylists(tokens.access_token);
            } catch (e) {
                console.error('Failed to fetch playlists:', e.message);
            }

            tokenStore[userKey] = {
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expires_at: Date.now() + (tokens.expires_in * 1000),
                playlists
            };

            console.log(`New user authenticated: ${userKey} with ${playlists.length} playlists`);
            return res.json({ ready: true, key: userKey });
        } else if (response.status === 428) {
            // authorization_pending
            return res.json({ ready: false });
        } else {
            const errText = await response.text();
            console.error(`Google poll error ${response.status}: ${errText}`);
            return res.json({ ready: false, error: `Google ${response.status}` });
        }
    } catch (e) {
        console.error('Poll error:', e.message);
        return res.json({ ready: false, error: e.message });
    }
});

// ── User manifest ─────────────────────────────────────────────────────────────
app.get('/:userKey/manifest.json', (req, res) => {
    const { userKey } = req.params;
    const userData = tokenStore[userKey];
    if (!userData) return res.status(404).json({ error: 'User not found. Please reconnect.' });
    res.json(buildManifest(userKey, userData.playlists));
});

// ── Catalog: playlist videos ──────────────────────────────────────────────────
app.get('/:userKey/catalog/movie/:catalogId.json', async (req, res) => {
    const { userKey, catalogId } = req.params;
    const userData = tokenStore[userKey];
    if (!userData) return res.json({ metas: [] });

    const playlistId = catalogId.replace(/^yt-/, '');

    try {
        const data = await ytGet(
            `/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50`,
            userData.access_token
        );

        const metas = (data.items || [])
            .filter(item => item.snippet.resourceId?.kind === 'youtube#video')
            .map(item => ({
                id: `yt-${item.snippet.resourceId.videoId}`,
                type: 'movie',
                name: item.snippet.title,
                poster: item.snippet.thumbnails?.medium?.url || null,
                background: item.snippet.thumbnails?.high?.url || null,
                description: item.snippet.description
            }));

        res.json({ metas });
    } catch (e) {
        console.error('Catalog error:', e.message);
        res.json({ metas: [] });
    }
});

// ── Stream: YouTube video URL ─────────────────────────────────────────────────
app.get('/:userKey/stream/movie/:id.json', (req, res) => {
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

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        users: Object.keys(tokenStore).length,
        google: GOOGLE_CLIENT_ID ? 'set' : 'NOT SET'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Reddemon YouTube Addon running on port ${PORT}`);
    if (!GOOGLE_CLIENT_ID) console.warn('WARNING: GOOGLE_CLIENT_ID is not set');
    if (!GOOGLE_CLIENT_SECRET) console.warn('WARNING: GOOGLE_CLIENT_SECRET is not set');
});
