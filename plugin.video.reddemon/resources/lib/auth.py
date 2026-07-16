import time
import json
import requests
import xbmc
import xbmcvfs

DEVICE_CODE_URL = 'https://oauth2.googleapis.com/device/code'
TOKEN_URL = 'https://oauth2.googleapis.com/token'
SCOPE = 'https://www.googleapis.com/auth/youtube.force-ssl'

TOKEN_CACHE_PATH = 'special://temp/reddemon_token_cache.json'


def log(message, level=xbmc.LOGDEBUG):
    xbmc.log(f'[Reddemon] {message}', level)


class AuthError(Exception):
    pass


class Auth:
    def __init__(self, config):
        self.config = config

    # ---- Device flow: sign in ----

    def request_device_code(self):
        client_id = self.config.get_client_id()
        if not client_id:
            raise AuthError('Client ID is not set. Add it in Settings first.')

        response = requests.post(DEVICE_CODE_URL, data={
            'client_id': client_id,
            'scope': SCOPE
        }, timeout=15)

        if response.status_code != 200:
            raise AuthError(f'Could not start sign-in: {response.text}')

        return response.json()

    def poll_for_token(self, device_code, interval, expires_in):
        client_id = self.config.get_client_id()
        client_secret = self.config.get_client_secret()

        if not client_id or not client_secret:
            raise AuthError('Client ID and Client Secret must both be set in Settings first.')

        deadline = time.time() + expires_in

        while time.time() < deadline:
            time.sleep(interval)

            response = requests.post(TOKEN_URL, data={
                'client_id': client_id,
                'client_secret': client_secret,
                'device_code': device_code,
                'grant_type': 'urn:ietf:params:oauth:grant-type:device_code'
            }, timeout=15)

            data = response.json()

            if response.status_code == 200:
                refresh_token = data.get('refresh_token')
                access_token = data.get('access_token')
                expires_in_secs = data.get('expires_in', 3600)

                if refresh_token:
                    self.config.set_refresh_token(refresh_token)

                self._cache_access_token(access_token, expires_in_secs)
                return True

            error = data.get('error')

            if error == 'authorization_pending':
                continue
            elif error == 'slow_down':
                interval += 5
                continue
            elif error == 'access_denied':
                raise AuthError('Sign-in was denied.')
            elif error == 'expired_token':
                raise AuthError('The sign-in code expired. Please try again.')
            else:
                raise AuthError(f'Sign-in failed: {error}')

        raise AuthError('Sign-in timed out. Please try again.')

    def sign_out(self):
        self.config.set_refresh_token('')
        self.config.set_signed_in_account('')
        self._clear_token_cache()

    # ---- Access token management ----

    def get_access_token(self):
        cached = self._read_token_cache()
        if cached and cached.get('expires_at', 0) > time.time() + 60:
            return cached['access_token']

        return self._refresh_access_token()

    def _refresh_access_token(self):
        client_id = self.config.get_client_id()
        client_secret = self.config.get_client_secret()
        refresh_token = self.config.get_refresh_token()

        if not refresh_token:
            raise AuthError('Not signed in.')

        response = requests.post(TOKEN_URL, data={
            'client_id': client_id,
            'client_secret': client_secret,
            'refresh_token': refresh_token,
            'grant_type': 'refresh_token'
        }, timeout=15)

        if response.status_code != 200:
            raise AuthError('Session expired or was revoked. Please sign in again.')

        data = response.json()
        access_token = data.get('access_token')
        expires_in_secs = data.get('expires_in', 3600)

        self._cache_access_token(access_token, expires_in_secs)
        return access_token

    def _cache_access_token(self, access_token, expires_in_secs):
        try:
            cache = {
                'access_token': access_token,
                'expires_at': time.time() + expires_in_secs
            }
            real_path = xbmcvfs.translatePath(TOKEN_CACHE_PATH)
            f = xbmcvfs.File(real_path, 'w')
            f.write(json.dumps(cache))
            f.close()
        except Exception as e:
            log(f'Could not cache access token: {str(e)}')

    def _read_token_cache(self):
        try:
            real_path = xbmcvfs.translatePath(TOKEN_CACHE_PATH)
            if not xbmcvfs.exists(real_path):
                return None
            f = xbmcvfs.File(real_path)
            content = f.read()
            f.close()
            if not content:
                return None
            return json.loads(content)
        except Exception:
            return None

    def _clear_token_cache(self):
        try:
            real_path = xbmcvfs.translatePath(TOKEN_CACHE_PATH)
            if xbmcvfs.exists(real_path):
                xbmcvfs.delete(real_path)
        except Exception:
            pass
