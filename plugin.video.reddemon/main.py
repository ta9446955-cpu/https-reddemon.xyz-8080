#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Reddemon Kodi Addon - Main Plugin Script
Browse your YouTube playlists using your signed-in account.
Playback is delegated to the official YouTube addon (plugin.video.youtube).
"""

import sys
import os
import xbmc
import xbmcgui
import xbmcplugin
import xbmcaddon
import xbmcvfs
from urllib.parse import urlencode, parse_qs

addon_dir = xbmcvfs.translatePath(os.path.dirname(__file__))
sys.path.insert(0, os.path.join(addon_dir, 'resources', 'lib'))

from config import Config
from auth import Auth, AuthError
from youtube_api import YouTubeAPI, YouTubeAPIError

handle = int(sys.argv[1])
base_url = sys.argv[0]

config = Config()
auth = Auth(config)
api = YouTubeAPI(auth, config)


def log(message, level=xbmc.LOGDEBUG):
    xbmc.log(f'[Reddemon] {message}', level)


def get_url(**kwargs):
    return f'{base_url}?{urlencode(kwargs)}'


def add_menu_item(label, action, is_folder=True, icon='DefaultVideo.png', extra_params=None):
    list_item = xbmcgui.ListItem(label=label)
    list_item.setArt({'icon': icon, 'thumb': icon})

    params = {'action': action}
    if extra_params:
        params.update(extra_params)

    url = get_url(**params)
    xbmcplugin.addDirectoryItem(handle=handle, url=url, listitem=list_item, isFolder=is_folder)


def show_error(message):
    xbmcgui.Dialog().ok('Reddemon', message)


def show_main_menu():
    log('Showing main menu')

    if config.is_signed_in():
        menu_items = [
            ('My Playlists', 'playlists'),
            ('Sign Out', 'signout'),
            ('Enter Your Own API Credentials', 'set_credentials'),
            ('Settings', 'settings'),
        ]
    else:
        menu_items = [
            ('Sign In to YouTube', 'signin'),
            ('Enter Your Own API Credentials', 'set_credentials'),
            ('Settings', 'settings'),
        ]

    for label, action in menu_items:
        add_menu_item(label=label, action=action, is_folder=True)

    xbmcplugin.setContent(handle, 'files')
    xbmcplugin.endOfDirectory(handle)


def set_credentials_dialog():
    """Enter your own Client ID / Secret via popup - works even if the
    Settings screen doesn't display the Account fields on your device."""
    dialog = xbmcgui.Dialog()

    current_id = config.get('client_id')
    new_id = dialog.input(
        'Enter your own Client ID (leave blank to use the built-in default)',
        defaultt=current_id
    )

    if new_id:
        config.set('client_id', new_id)

    current_secret = config.get('client_secret')
    new_secret = dialog.input(
        'Enter your own Client Secret',
        defaultt=current_secret
    )

    if new_secret:
        config.set('client_secret', new_secret)

    if new_id or new_secret:
        xbmcgui.Dialog().notification('Reddemon', 'Your credentials were saved', xbmcgui.NOTIFICATION_INFO, 3000)

    xbmcplugin.endOfDirectory(handle, succeeded=False, updateListing=False, cacheToDisc=False)


def do_sign_in():
    if not config.get_client_id() or not config.get_client_secret():
        show_error('No API credentials found. Either set up Client ID/Client Secret in the YouTube addon\'s '
                    'Settings > API tab, or enter your own in Reddemon\'s Settings.')
        xbmcplugin.endOfDirectory(handle, succeeded=False, updateListing=False, cacheToDisc=False)
        return

    if config.using_youtube_addon_credentials():
        log('Using API credentials from the YouTube addon')

    try:
        device_response = auth.request_device_code()
    except AuthError as e:
        show_error(str(e))
        xbmcplugin.endOfDirectory(handle, succeeded=False, updateListing=False, cacheToDisc=False)
        return

    user_code = device_response.get('user_code')
    verification_url = device_response.get('verification_url', 'https://www.google.com/device')
    device_code = device_response.get('device_code')
    interval = device_response.get('interval', 5)
    expires_in = device_response.get('expires_in', 1800)

    progress = xbmcgui.DialogProgress()
    progress.create('Sign In to YouTube',
                     f'On your phone or computer, go to:\n{verification_url}\n\n'
                     f'And enter this code:\n{user_code}')

    import threading
    result = {'success': False, 'error': None}

    def poll():
        try:
            auth.poll_for_token(device_code, interval, expires_in)
            result['success'] = True
        except AuthError as e:
            result['error'] = str(e)

    thread = threading.Thread(target=poll)
    thread.start()

    while thread.is_alive():
        if progress.iscanceled():
            break
        xbmc.sleep(500)

    progress.close()

    if result['error']:
        show_error(result['error'])
    elif result['success']:
        try:
            channel_name = api.get_my_channel()
            if channel_name:
                config.set_signed_in_account(channel_name)
        except Exception as e:
            log(f'Could not fetch channel name: {str(e)}')

        xbmcgui.Dialog().notification('Reddemon', 'Signed in successfully!',
                                       xbmcgui.NOTIFICATION_INFO, 3000)

    xbmcplugin.endOfDirectory(handle, succeeded=False, updateListing=False, cacheToDisc=False)


def do_sign_out():
    if xbmcgui.Dialog().yesno('Reddemon', 'Sign out of YouTube?'):
        auth.sign_out()
        xbmcgui.Dialog().notification('Reddemon', 'Signed out', xbmcgui.NOTIFICATION_INFO, 2000)
    xbmcplugin.endOfDirectory(handle, succeeded=False, updateListing=False, cacheToDisc=False)


def show_playlists(page_token=None):
    if not config.is_signed_in():
        show_error('Not signed in. Please sign in from the main menu first.')
        xbmcplugin.endOfDirectory(handle, succeeded=False)
        return

    try:
        result = api.get_my_playlists(page_token=page_token)
    except (AuthError, YouTubeAPIError) as e:
        show_error(str(e))
        xbmcplugin.endOfDirectory(handle, succeeded=False)
        return

    playlists = result['playlists']

    if not playlists and not page_token:
        show_error('No playlists found on your YouTube account.')

    for playlist in playlists:
        label = f"{playlist['title']} ({playlist['item_count']} videos)"
        list_item = xbmcgui.ListItem(label=label)
        list_item.setArt({'thumb': playlist['thumbnail'], 'icon': 'DefaultPlaylist.png'})
        list_item.setInfo('video', {'title': playlist['title'], 'plot': playlist['description']})

        url = get_url(action='playlist_items', playlist_id=playlist['id'])
        xbmcplugin.addDirectoryItem(handle=handle, url=url, listitem=list_item, isFolder=True)

    if result.get('next_page_token'):
        next_item = xbmcgui.ListItem(label='Next Page >>')
        next_item.setArt({'icon': 'DefaultFolder.png'})
        url = get_url(action='playlists', page_token=result['next_page_token'])
        xbmcplugin.addDirectoryItem(handle=handle, url=url, listitem=next_item, isFolder=True)

    xbmcplugin.setContent(handle, 'files')
    xbmcplugin.endOfDirectory(handle)


def show_playlist_items(playlist_id, page_token=None):
    if not config.is_signed_in():
        show_error('Not signed in. Please sign in from the main menu first.')
        xbmcplugin.endOfDirectory(handle, succeeded=False)
        return

    try:
        result = api.get_playlist_items(playlist_id, page_token=page_token)
    except (AuthError, YouTubeAPIError) as e:
        show_error(str(e))
        xbmcplugin.endOfDirectory(handle, succeeded=False)
        return

    videos = result['videos']

    if not videos and not page_token:
        show_error('No videos found in this playlist.')

    for video in videos:
        list_item = xbmcgui.ListItem(label=video['title'])
        list_item.setArt({'thumb': video['thumbnail'], 'icon': 'DefaultVideo.png'})
        list_item.setInfo('video', {
            'title': video['title'],
            'plot': video['description'],
            'studio': video['channel']
        })
        list_item.setProperty('IsPlayable', 'true')

        url = get_url(action='play', video_id=video['video_id'])
        xbmcplugin.addDirectoryItem(handle=handle, url=url, listitem=list_item, isFolder=False)

    if result.get('next_page_token'):
        next_item = xbmcgui.ListItem(label='Next Page >>')
        next_item.setArt({'icon': 'DefaultFolder.png'})
        url = get_url(action='playlist_items', playlist_id=playlist_id, page_token=result['next_page_token'])
        xbmcplugin.addDirectoryItem(handle=handle, url=url, listitem=next_item, isFolder=True)

    xbmcplugin.setContent(handle, 'videos')
    xbmcplugin.endOfDirectory(handle)


def play_video(video_id):
    """Delegate actual playback to the official YouTube addon"""
    try:
        xbmcaddon.Addon('plugin.video.youtube')
    except RuntimeError:
        show_error('The official YouTube addon (plugin.video.youtube) is not installed. '
                    'Please install it from the Kodi add-on repository first.')
        return

    youtube_url = f'plugin://plugin.video.youtube/play/?video_id={video_id}'
    list_item = xbmcgui.ListItem(path=youtube_url)
    xbmcplugin.setResolvedUrl(handle, True, list_item)


def open_settings():
    xbmcaddon.Addon().openSettings()
    xbmcplugin.endOfDirectory(handle, succeeded=False, updateListing=False, cacheToDisc=False)


def router():
    params = dict(parse_qs(sys.argv[2][1:]))
    params = {k: v[0] for k, v in params.items()}
    action = params.get('action')

    if action is None:
        show_main_menu()
    elif action == 'signin':
        do_sign_in()
    elif action == 'signout':
        do_sign_out()
    elif action == 'playlists':
        show_playlists(page_token=params.get('page_token'))
    elif action == 'playlist_items':
        show_playlist_items(params.get('playlist_id'), page_token=params.get('page_token'))
    elif action == 'play':
        play_video(params.get('video_id'))
    elif action == 'settings':
        open_settings()
    elif action == 'set_credentials':
        set_credentials_dialog()
    else:
        show_main_menu()


if __name__ == '__main__':
    try:
        router()
    except Exception as e:
        show_error(f'Addon error: {str(e)}')
        log(f'Fatal exception: {str(e)}', xbmc.LOGERROR)
