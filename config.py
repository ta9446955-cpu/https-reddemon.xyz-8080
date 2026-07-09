import xbmcaddon


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
        return self.get('client_id').strip()

    def get_client_secret(self):
        return self.get('client_secret').strip()

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
