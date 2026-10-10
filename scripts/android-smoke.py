"""Fresh-install launch smoke check; no user financial records are present."""
import subprocess
import time
from pathlib import Path

def adb(*args):
    return subprocess.check_output(['adb', *args], text=True, timeout=60)

adb('install', '-r', 'android/app/build/outputs/apk/release/app-release.apk')
adb('logcat', '-c')
adb('shell', 'am', 'start', '-W', '-n', 'com.moneywise/.MainActivity')
Path('dist').mkdir(exist_ok=True)
for attempt in range(12):
    time.sleep(3)
    try:
        adb('shell', 'uiautomator', 'dump', '/sdcard/walletway.xml')
        xml = adb('shell', 'cat', '/sdcard/walletway.xml')
        if 'Meet Walletway' in xml:
            Path('dist/launch-smoke.xml').write_text(xml)
            break
    except subprocess.CalledProcessError:
        pass
else:
    raise RuntimeError('Walletway onboarding did not appear on the Android emulator.')
logs = adb('logcat', '-d')
Path('dist/launch-smoke.log').write_text(logs)
if 'FATAL EXCEPTION' in logs or 'com.facebook.react.common.JavascriptException' in logs:
    raise RuntimeError('The emulator reported a launch crash.')
with Path('dist/launch-smoke.png').open('wb') as image:
    subprocess.run(['adb', 'exec-out', 'screencap', '-p'], stdout=image, check=True, timeout=30)
print('Android fresh-install onboarding smoke check passed.')
