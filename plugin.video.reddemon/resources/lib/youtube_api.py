import requests
import xbmc

API_BASE = 'https://www.googleapis.com/youtube/v3'


def log(message, level=xbmc.LOGDEBUG):
    xbmc.log(f'[Reddemon] {message}', level)


class YouTubeAPIError(Exception):
    pass


class YouTubeAPI:
    def __init__(self, auth, config):
        self.auth = auth
        self.config = config

    def _get(self, endpoint, params):
        access_token = self.auth.get_access_token()
        headers = {'Authorization': f'Bearer {access_token}'}

        response = requests.get(f'{API_BASE}/{endpoint}', headers=headers, params=params, timeout=15)

        if response.status_code == 401:
            raise YouTubeAPIError('Session expired. Please sign in again.')
        if response.status_code == 403:
            raise YouTubeAPIError('YouTube API access denied. Check your API quota in Google Cloud Console.')
        if response.status_code != 200:
            raise YouTubeAPIError(f'YouTube API error: {response.status_code} {response.text}')

        return response.json()

    def get_my_channel(self):
        data = self._get('channels', {
            'part': 'snippet',
            'mine': 'true'
        })
        items = data.get('items', [])
        if not items:
            return None
        return items[0]['snippet'].get('title')

    def get_my_playlists(self, page_token=None):
        params = {
            'part': 'snippet,contentDetails',
            'mine': 'true',
            'maxResults': self.config.get_page_size()
        }
        if page_token:
            params['pageToken'] = page_token

        data = self._get('playlists', params)

        playlists = []
        for item in data.get('items', []):
            snippet = item.get('snippet', {})
            content_details = item.get('contentDetails', {})
            thumbnails = snippet.get('thumbnails', {})
            thumb_url = ''
            for size in ('high', 'medium', 'default'):
                if size in thumbnails:
                    thumb_url = thumbnails[size].get('url', '')
                    break

            playlists.append({
                'id': item.get('id'),
                'title': snippet.get('title', 'Untitled Playlist'),
                'description': snippet.get('description', ''),
                'thumbnail': thumb_url,
                'item_count': content_details.get('itemCount', 0)
            })

        return {
            'playlists': playlists,
            'next_page_token': data.get('nextPageToken')
        }

    def get_playlist_items(self, playlist_id, page_token=None):
        params = {
            'part': 'snippet,contentDetails',
            'playlistId': playlist_id,
            'maxResults': self.config.get_page_size()
        }
        if page_token:
            params['pageToken'] = page_token

        data = self._get('playlistItems', params)

        videos = []
        for item in data.get('items', []):
            snippet = item.get('snippet', {})
            content_details = item.get('contentDetails', {})
            video_id = content_details.get('videoId')

            if not video_id:
                continue

            # Skip deleted/private videos which show up as placeholders
            title = snippet.get('title', '')
            if title in ('Deleted video', 'Private video'):
                continue

            thumbnails = snippet.get('thumbnails', {})
            thumb_url = ''
            for size in ('high', 'medium', 'default'):
                if size in thumbnails:
                    thumb_url = thumbnails[size].get('url', '')
                    break

            videos.append({
                'video_id': video_id,
                'title': title or 'Untitled Video',
                'description': snippet.get('description', ''),
                'thumbnail': thumb_url,
                'channel': snippet.get('videoOwnerChannelTitle', ''),
                'position': snippet.get('position', 0)
            })

        return {
            'videos': videos,
            'next_page_token': data.get('nextPageToken')
        }
