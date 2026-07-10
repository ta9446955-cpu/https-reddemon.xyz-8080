import xbmcaddon

# Baked-in defaults so Reddemon works immediately with no manual setup.
# These were provided directly by the addon owner (a "TVs and Limited Input
# devices" type OAuth client, which is required for the sign-in flow).
DEFAULT_CLIENT_ID = '898787809552-ue7c0jur5fgsm5lbtgos9v1ngaprrsaj.apps.googleusercontent.com'
DEFAULT_CLIENT_SECRET = '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'


class Config:
    def __init__(self):
        self.addon = xbmcaddon.Addon()

    def get(self, setting):
        try:
            return self.addon.getSetting(setting)
        except Exception:
            return ''

    def set(self, setting, value):
        try:
            self.addon.setSetting(setting, str(value))
            return True
        except Exception:
            return False

    def get_client_id(self):
        own_id = self.get('client_id').strip()
        if own_id:
            return own_id
        yt_id = self._get_youtube_addon_setting('youtube.api.id')
        if yt_id:
            return yt_id
        return DEFAULT_CLIENT_ID

    def get_client_secret(self):
        own_secret = self.get('client_secret').strip()
        if own_secret:
            return own_secret
        yt_secret = self._get_youtube_addon_setting('youtube.api.secret')
        if yt_secret:
            return yt_secret
        return DEFAULT_CLIENT_SECRET

    def using_youtube_addon_credentials(self):
        """True if we're relying on plugin.video.youtube's keys rather than our own"""
        return not self.get('client_id').strip() and bool(self._get_youtube_addon_setting('youtube.api.id'))

    def _get_youtube_addon_setting(self, setting_id):
        try:
            yt_addon = xbmcaddon.Addon('plugin.video.youtube')
            return yt_addon.getSetting(setting_id).strip()
        except Exception:
            return ''

    def get_refresh_token(self):
        return self.get('refresh_token').strip()

    def set_refresh_token(self, token):
        self.set('refresh_token', token or '')

    def get_signed_in_account(self):
        return self.get('signed_in_account').strip()

    def set_signed_in_account(self, name):
        self.set('signed_in_account', name or '')

    def is_signed_in(self):
        return bool(self.get_refresh_token())

    def get_page_size(self):
        try:
            size = int(self.get('playlist_page_size') or 50)
        except ValueError:
            size = 50
        return max(10, min(50, size))

    def is_debug_enabled(self):
        return self.get('enable_debug') == 'true'
