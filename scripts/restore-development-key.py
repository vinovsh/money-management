"""Reuse a prior development artifact key so UAT APK updates stay compatible."""
import io
import json
import os
import urllib.error
import urllib.request
import urllib.parse
import zipfile
from pathlib import Path

repo = os.environ['GITHUB_REPOSITORY']
token = os.environ['GITHUB_TOKEN']
headers = {'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json'}

class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, new_url):
        redirected = super().redirect_request(request, fp, code, message, headers, new_url)
        if redirected and urllib.parse.urlsplit(request.full_url).netloc != urllib.parse.urlsplit(new_url).netloc:
            redirected.remove_header('Authorization')
        return redirected

opener = urllib.request.build_opener(SafeRedirect())

def get(url):
    # Do not forward GitHub authentication to the artifact storage redirect.
    request = urllib.request.Request(url, headers=headers)
    return opener.open(request, timeout=60).read()

try:
    data = json.loads(get('https://api.github.com/repos/' + repo + '/actions/artifacts?per_page=100'))
    candidates = [a for a in data['artifacts'] if not a['expired'] and a['name'] in ('Walletway-Android-APK', 'Walletway-UAT-APK', 'Moneywise-Android-APK')]
    for artifact in sorted(candidates, key=lambda a: a['created_at'], reverse=True):
        try:
            archive = zipfile.ZipFile(io.BytesIO(get(artifact['archive_download_url'])))
            keys = [n for n in archive.namelist() if n.endswith('moneywise-development.keystore')]
            if keys:
                Path('android/app/moneywise-dev.keystore').write_bytes(archive.read(keys[0]))
                print('Reused the previous development signing key.')
                break
        except (urllib.error.HTTPError, zipfile.BadZipFile, OSError):
            continue
    else:
        print('No previous development key is available; a new key will be generated.')
except (urllib.error.HTTPError, OSError, ValueError):
    print('Previous development key was unavailable; a new key will be generated.')
