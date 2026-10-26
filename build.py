"""Package Chromium builds or Safari Web Extension conversion input."""
import argparse
import base64
import hashlib
import json
import re
import subprocess
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parent
PRODUCTION_ID = 'kckhpinnhkjfblkalloabaiihpdmklla'


def extension_id(key):
    raw = base64.b64decode(key, validate=True)
    parsed = subprocess.run(['node','-e',"require('node:crypto').createPublicKey({key:Buffer.from(process.argv[1],'base64'),format:'der',type:'spki'})",key],capture_output=True)
    if not raw or parsed.returncode:
        raise ValueError('Expected a base64-encoded DER SPKI public key')
    return ''.join(chr(97 + int(n, 16)) for n in hashlib.sha256(raw).hexdigest()[:32])


def version_parts(value):
    if not isinstance(value,str) or not re.fullmatch(r'(0|[1-9][0-9]*)(\.(0|[1-9][0-9]*)){0,3}',value):
        raise ValueError('Invalid Chromium version')
    parts=tuple(map(int,value.split('.')))
    if any(n>65535 for n in parts) or not any(parts):
        raise ValueError('Invalid Chromium version')
    return parts+(0,)*(4-len(parts))


def build(mode='store', public_key=None):
    if mode not in ['store','development','replacement','safari']:
        raise ValueError('Unknown package mode')
    manifest = json.loads((ROOT / 'manifest.json').read_text())
    version_parts(manifest['version'])
    if mode == 'safari':
        manifest.pop('minimum_chrome_version', None)
        # Native deployment targets do not constrain the installed Safari version.
        # MAIN-world declarative content scripts require Safari 18.
        manifest['browser_specific_settings'] = {'safari': {'strict_min_version': '18.0'}}
        manifest['permissions'] += ['declarativeNetRequestWithHostAccess', 'scripting']
        manifest['host_permissions'] += ['https://messenger.com/*', 'https://www.messenger.com/*', 'https://m.messenger.com/*']
        manifest['declarative_net_request'] = {'rule_resources': [{'id': 'messenger', 'enabled': True, 'path': 'rules/messenger.json'}]}
        manifest['content_scripts'][1]['js'] += ['messenger-config.js', 'messenger-layout.js']
        manifest['content_scripts'][1]['matches'] += ['https://messenger.com/*', 'https://www.messenger.com/*', 'https://m.messenger.com/*']
        manifest['content_scripts'][1]['css'] = ['messenger.css']
    if mode == 'development':
        manifest['key'] = (ROOT / 'identity/development-public-key.txt').read_text().strip()
        manifest['name'] += ' (Development)'
        manifest['version_name'] = manifest['version'] + ' development candidate'
        assert extension_id(manifest['key']) != PRODUCTION_ID
    elif mode == 'replacement':
        if not public_key:
            raise ValueError('Replacement requires --production-public-key from the existing store listing')
        manifest['key'] = Path(public_key).read_text().strip()
        if extension_id(manifest['key']) != PRODUCTION_ID:
            raise ValueError('Public key does not match the documented Facefix production ID')
    files = {
        'manifest.json', 'background.js', 'guard.js', 'settings.js', 'app-prompts.js',
        'popup.html', 'popup.js', 'privacy.html', 'timers.js', 'connection.js',
        'diagnostics.js', 'diagnostics.html', 'diagnostics-view.js',
        'messenger-config.js', 'messenger-popup.js',
        *manifest['icons'].values(),
    }
    if mode == 'safari':
        files.update({'messenger-background.js', 'messenger-identity.js', 'messenger-layout.js', 'messenger.css', 'rules/messenger.json'})
    output = ROOT / 'dist' / f"facefix-{manifest['version']}-{mode}.zip"
    output.parent.mkdir(exist_ok=True)
    with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
        for name in sorted(files):
            data = (json.dumps(manifest, indent=2) + '\n').encode() if name == 'manifest.json' else (ROOT / name).read_bytes()
            info = ZipInfo(name, (2026, 10, 23, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data)
    with ZipFile(output) as archive:
        assert archive.testzip() is None
        assert set(archive.namelist()) == files
        assert json.loads(archive.read('manifest.json')) == manifest
    return output


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mode', choices=['store', 'development', 'replacement', 'safari'], default='store')
    parser.add_argument('--production-public-key', type=Path)
    args = parser.parse_args()
    try:
        print(build(args.mode, args.production_public_key))
    except (ValueError, OSError) as error:
        parser.error(str(error))
