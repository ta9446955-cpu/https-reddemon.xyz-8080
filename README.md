# Reddemon - YouTube Playlists in Kodi

Sign in with your YouTube account and browse your own playlists directly in Kodi. Actual video playback is handled by the official YouTube addon (plugin.video.youtube), so streaming stays reliable and up to date.

## Downloads

| File | Direct Download |
|---|---|
| 🗂️ **Repository zip** (recommended - enables auto-updates) | [repository.reddemon.zip](https://raw.githubusercontent.com/ta9446955-cpu/https-reddemon.xyz-8080/main/repository.reddemon/repository.reddemon.zip) |
| 📦 **Addon zip** (v1.0.3, install directly, no auto-updates) | [plugin.video.reddemon-1.0.3.zip](https://raw.githubusercontent.com/ta9446955-cpu/https-reddemon.xyz-8080/main/plugin.video.reddemon/plugin.video.reddemon-1.0.3.zip) |

On Android/mobile, open the link in your browser to download the zip, then in Kodi use **Settings > Add-ons > Install from zip file** and pick it from your Downloads folder.

## Requirements

- The official **YouTube addon** (plugin.video.youtube) must already be installed in Kodi - Reddemon uses it to actually play videos.
- API credentials to sign in - **but you probably already have these**, see below.

## Installation

### Option 1: Install Repository (Recommended)

1. **Download** the repository zip using the link above
2. **Go to**: Kodi > Settings > Add-ons > Install from zip file
3. **Select** the downloaded `repository.reddemon.zip`
4. **Restart** Kodi
5. **Go to**: Settings > Add-ons > Install from repository > Reddemon Repository > Video Add-ons > Reddemon
6. **Click** Install

### Option 2: Install Addon Directly

1. **Download** the addon zip using the link above
2. **Go to**: Kodi > Settings > Add-ons > Install from zip file
3. **Select** the downloaded `plugin.video.reddemon-1.0.3.zip`
4. **Restart** Kodi

## About API Credentials

YouTube sign-in requires a Client ID and Client Secret from Google. There are two ways to get these:

### Option A: You already have the YouTube addon set up (most people)

If you've ever configured **Personal API Keys** in the official YouTube addon (Settings > API), Reddemon will **automatically detect and reuse those same keys** - you don't need to do anything else. Just install Reddemon and go straight to **Sign In to YouTube** from the main menu.

### Option B: You don't have any YouTube API keys yet

If the YouTube addon has never had personal API keys set up, you'll need to create your own (free, from Google). This takes about 5 minutes and only needs to be done once - and once done, it can be used by both the YouTube addon and Reddemon.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and sign in with your Google account.
2. Create a new project (top-left project dropdown > New Project). Name it anything, e.g. "Reddemon".
3. Go to **APIs & Services > Library**, search for **YouTube Data API v3**, and click **Enable**.
4. Go to **APIs & Services > OAuth consent screen**.
   - User Type: **External**
   - Fill in the app name, your email for support and developer contact
   - Add scope: `https://www.googleapis.com/auth/youtube.readonly`
   - Add yourself as a **test user**
   - **Important**: once everything works, come back here and click **Publish App**. This moves the app out of "Testing" status, which is what prevents your sign-in from expiring every 7 days.
5. Go to **APIs & Services > Credentials > Create Credentials > OAuth Client ID**.
   - Application type: **TVs and Limited Input devices**
   - Give it a name, click Create
6. Copy the **Client ID** and **Client Secret** shown.
7. Enter these either in the YouTube addon's Settings > API tab (recommended, so Reddemon picks them up automatically), or directly in Reddemon's own Settings if you prefer to keep them separate.
8. From the Reddemon main menu, select **Sign In to YouTube**, follow the on-screen code and link.

## After Installation

1. Open the **Reddemon** addon
2. If not signed in, select **Sign In to YouTube** and follow the on-screen instructions
3. Select **My Playlists** to browse your YouTube playlists
4. Tap any video to play it (via the YouTube addon)

## Troubleshooting

### "The official YouTube addon is not installed"
Install `plugin.video.youtube` from Kodi's official add-on repository first.

### "No API credentials found"
Neither the YouTube addon nor Reddemon has any keys configured. Follow Option B above to create free ones.

### Sign-in code expires before I can enter it
Try again - you have several minutes, but a slow connection can eat into that. Make sure you're going to the exact URL shown.

### Having to sign in again every week
This means your Google Cloud OAuth app is still in "Testing" status. Go back to the OAuth consent screen in Google Cloud Console and click **Publish App**.

### Need Help?
- Check: https://github.com/ta9446955-cpu/https-reddemon.xyz-8080/issues

## Support

- **GitHub**: https://github.com/ta9446955-cpu/https-reddemon.xyz-8080
- **Issues**: https://github.com/ta9446955-cpu/https-reddemon.xyz-8080/issues

---

**Version**: 1.0.3
**Last Updated**: 2026-07-10
**License**: GPL-2.0
