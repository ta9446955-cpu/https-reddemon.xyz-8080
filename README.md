# 📺 Reddemon YouTube Addon

A Stremio addon that displays your YouTube playlists as catalogs in Stremio. Click any video to open it directly in the YouTube app or browser.

## Install

Paste this URL into Stremio's addon install field:

```
https://https-reddemon-xyz-8080.onrender.com/manifest.json
```

Or visit the [addon page](https://https-reddemon-xyz-8080.onrender.com) and click **Install in Stremio**.

## How It Works

- Your public YouTube playlists automatically appear as catalogs in Stremio's Discover tab
- Click any video thumbnail to open it in the YouTube app or your browser
- No login required — playlists are fetched directly from your YouTube channel
- Playlist list refreshes every hour automatically

## Notes

- Only **Public** playlists appear — Private and Unlisted playlists are not shown
- Hosted on Render.com free tier — first request after inactivity may take 30-60 seconds to wake up
- If playlists stop showing, trigger a manual redeploy on Render to refresh the cache

## Tech Stack

- Node.js / Express
- Hosted on Render.com
- YouTube Data API v3
