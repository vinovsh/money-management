"""Fresh-install launch smoke check; no user financial records are present."""
import subprocess
import time
import os
import sys
from pathlib import Path

def adb(*args):
    return subprocess.check_output(['adb', *args], text=True, timeout=60)

adb('install', '-r', os.environ.get('SOURCE_APK', 'android/app/build/outputs/apk/release/app-release.apk'))
adb('logcat', '-c')
adb('shell', 'am', 'start', '-W', '-n', 'com.moneywise/.MainActivity')
Path('dist').mkdir(exist_ok=True)

def capture_failure(kind, value, traceback):
    try:
        adb('shell', 'uiautomator', 'dump', '/sdcard/walletway.xml')
        xml = adb('shell', 'cat', '/sdcard/walletway.xml')
        logs = adb('logcat', '-d')
        Path('dist/flow-failure.xml').write_text(xml)
        Path('dist/flow-failure.log').write_text(logs)
        print('FAILURE UI:', xml, flush=True)
        print('FAILURE LOG:', '\n'.join(line for line in logs.splitlines() if any(word in line for word in ['ReactNative', 'FATAL', 'SQLite', 'Exception', 'moneywise'])), flush=True)
        with Path('dist/flow-failure.png').open('wb') as image:
            subprocess.run(['adb', 'exec-out', 'screencap', '-p'], stdout=image, check=True, timeout=30)
    finally:
        sys.__excepthook__(kind, value, traceback)

sys.excepthook = capture_failure
for attempt in range(20):
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
    logs = adb('logcat', '-d')
    Path('dist/startup-failure.log').write_text(logs)
    Path('dist/startup-failure.xml').write_text(locals().get('xml', 'no XML'))
    print('STARTUP UI:', locals().get('xml', 'no XML'), flush=True)
    print('STARTUP LOG:', '\n'.join(line for line in logs.splitlines() if any(word in line for word in ['ReactNative', 'FATAL', 'moneywise', 'SQLite', 'Exception'])), flush=True)
    with Path('dist/startup-failure.png').open('wb') as image:
        subprocess.run(['adb', 'exec-out', 'screencap', '-p'], stdout=image, check=True, timeout=30)
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
    height = int(re.findall(r'(\d+)x(\d+)', adb('shell', 'wm', 'size'))[-1][1])
    candidates = [n for n in nodes() if n.attrib.get('text') == text or n.attrib.get('content-desc') == text]
    candidates.sort(key=lambda n: n.attrib.get('clickable') != 'true')
    for node in candidates:
        x1, y1, x2, y2 = map(int, re.findall(r'\d+', node.attrib['bounds']))
        if y2 > y1 + 4 and y1 > 55 and y2 < height - 45:
            return node
    return None

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
for key in ['1', '2', '.', '5', '0']:
    tap(scroll_to(key, upwards=False))
tap(scroll_to('Save expense'))
time.sleep(3)
if not any(n.attrib.get('text') == 'Walletway' for n in nodes()):
    raise RuntimeError('Saving a transaction did not return to Home.')
logs = adb('logcat', '-d')
Path('dist/launch-smoke.log').write_text(logs)
if 'FATAL EXCEPTION' in logs or 'com.facebook.react.common.JavascriptException' in logs:
    raise RuntimeError('The emulator reported a transaction-flow crash.')
with Path('dist/transaction-smoke.png').open('wb') as image:
    subprocess.run(['adb', 'exec-out', 'screencap', '-p'], stdout=image, check=True, timeout=30)
print('Android onboarding, initial modal scroll and transaction save passed.')

# Check the new offline guide and the visible demo ad fallback.
scroll_to('Advertisement · demo / test only')
tap(scroll_to('More'))
tap(scroll_to('Guide'))
if not any(n.attrib.get('text') == 'Your Walletway guide' for n in nodes()):
    raise RuntimeError('Guide did not open from More.')
tap(scroll_to('Back up and recover'))
scroll_to('Walletway 0.4.1 · Guide')
with Path('dist/guide-smoke.png').open('wb') as image:
    subprocess.run(['adb', 'exec-out', 'screencap', '-p'], stdout=image, check=True, timeout=30)
logs = adb('logcat', '-d')
Path('dist/launch-smoke.log').write_text(logs)
if 'FATAL EXCEPTION' in logs or 'com.facebook.react.common.JavascriptException' in logs:
    raise RuntimeError('The emulator reported a guide-flow crash.')
print('Offline guide navigation and demo advertising space passed.')
