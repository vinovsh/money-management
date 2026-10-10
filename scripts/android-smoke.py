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

# Verify the reported initial modal scroll before changing any transaction field.
import xml.etree.ElementTree as ET
import re

def nodes():
    adb('shell', 'uiautomator', 'dump', '/sdcard/walletway.xml')
    return list(ET.fromstring(adb('shell', 'cat', '/sdcard/walletway.xml')).iter('node'))

def tap(node):
    x1, y1, x2, y2 = map(int, re.findall(r'\d+', node.attrib['bounds']))
    adb('shell', 'input', 'tap', str((x1 + x2) // 2), str((y1 + y2) // 2))

def find(text):
    return next((n for n in nodes() if n.attrib.get('text') == text or n.attrib.get('content-desc') == text), None)

def scroll_to(text, upwards=True):
    size = re.findall(r'(\d+)x(\d+)', adb('shell', 'wm', 'size'))[-1]
    width, height = map(int, size)
    for attempt in range(12):
        node = find(text)
        if node is not None:
            return node
        start, end = (int(height * .75), int(height * .3)) if upwards else (int(height * .3), int(height * .75))
        adb('shell', 'input', 'swipe', str(width // 2), str(start), str(width // 2), str(end), '450')
        time.sleep(.5)
    raise RuntimeError('Could not scroll to ' + text)

tap(scroll_to('Let’s get started'))
time.sleep(3)
tap(scroll_to('Add a transaction'))
time.sleep(2)
scroll_to('Save expense')
print('Initial Add Transaction modal scroll reaches Save before editing a field.')
node = scroll_to('Amount (INR)', upwards=False)
entry = next((n for n in nodes() if n.attrib.get('class') == 'android.widget.EditText'), None)
if entry is None:
    raise RuntimeError('Amount input was not visible.')
tap(entry)
adb('shell', 'input', 'text', '12.50')
adb('shell', 'input', 'keyevent', '4')
tap(scroll_to('Save expense'))
time.sleep(3)
if find('Add a transaction') is None and find('Walletway') is None:
    raise RuntimeError('Saving a transaction did not return to Home.')
logs = adb('logcat', '-d')
Path('dist/launch-smoke.log').write_text(logs)
if 'FATAL EXCEPTION' in logs or 'com.facebook.react.common.JavascriptException' in logs:
    raise RuntimeError('The emulator reported a transaction-flow crash.')
with Path('dist/transaction-smoke.png').open('wb') as image:
    subprocess.run(['adb', 'exec-out', 'screencap', '-p'], stdout=image, check=True, timeout=30)
print('Android onboarding, initial modal scroll and transaction save passed.')
