"""Update the existing Facefix Safari resources without replacing its product identity."""
import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from build import build

PROJECT = ROOT/'apple/Facefix/Facefix.xcodeproj/project.pbxproj'
RESOURCES = ROOT/'apple/Facefix/Shared (Extension)/Resources'
AUDIT = ROOT/'apple/safari-build-input.json'
IDENTIFIERS = ['co.staytech.facefix.safari', 'co.staytech.facefix.safari.Extension']


def objects(text):
    parsed = subprocess.run(['plutil', '-convert', 'json', '-o', '-', '--', '-'], input=text,
                            text=True, capture_output=True, check=True)
    return json.loads(parsed.stdout)['objects']


def append_list(text, identifier, field, additions):
    block = re.compile(r'(^\t\t' + re.escape(identifier) + r' /\*[^\n]*\*/ = \{\n)(.*?)(^\t\t\};)', re.M | re.S)
    def edit(match):
        content, count = re.subn(r'(\t\t\t' + field + r' = \(\n)(.*?)(\t\t\t\);)',
            lambda item: item[1] + item[2] + ''.join('\t\t\t\t' + value + ',\n' for value in additions) + item[3], match[2], count=1, flags=re.S)
        if count != 1: raise ValueError(f'Missing {identifier}.{field}')
        return match[1] + content + match[3]
    text, count = block.subn(edit, text, count=1)
    if count != 1: raise ValueError(f'Missing project object {identifier}')
    return text


def synchronize(check=False, native_build=None):
    text = PROJECT.read_text()
    identifiers = sorted(set(re.findall(r'PRODUCT_BUNDLE_IDENTIFIER = ([A-Za-z0-9.-]+);', text)))
    if identifiers != IDENTIFIERS: raise ValueError('Existing Facefix product identities differ; refusing replacement')
    with ZipFile(build('safari')) as archive:
        payload = {name: archive.read(name) for name in archive.namelist()}
    manifest = json.loads(payload['manifest.json'])
    version = manifest['version']
    tree = objects(text)
    manifest_ref = next(key for key, value in tree.items() if value.get('isa') == 'PBXFileReference' and Path(value.get('path', '')).name == 'manifest.json')
    prefix = Path(tree[manifest_ref]['path']).parent
    group = next(key for key, value in tree.items() if value.get('isa') == 'PBXGroup' and manifest_ref in value.get('children', []))
    targets = [value for value in tree.values() if value.get('productType') == 'com.apple.product-type.app-extension']
    phases = [phase for target in targets for phase in target['buildPhases'] if tree[phase]['isa'] == 'PBXResourcesBuildPhase']
    if len(phases) != 2: raise ValueError('Expected iOS and macOS extension resource phases')
    names = sorted({name.split('/')[0] for name in payload})
    for name in names:
        reference = next((key for key in tree[group]['children'] if Path(tree[key].get('path', '')).name == name), None)
        if not reference:
            if check: raise ValueError(f'Native project does not include {name}; run scripts/sync-safari.py')
            reference = hashlib.sha256(('facefix-resource:' + name).encode()).hexdigest()[:24].upper()
            kind = 'folder' if any(item.startswith(name + '/') for item in payload) else 'text.css' if name.endswith('.css') else 'sourcecode.javascript'
            line = f'\t\t{reference} /* {name} */ = {{isa = PBXFileReference; lastKnownFileType = {kind}; name = "{name}"; path = "{prefix/name}"; sourceTree = "<group>"; }};\n'
            text = text.replace('/* End PBXFileReference section */', line + '/* End PBXFileReference section */')
            text = append_list(text, group, 'children', [f'{reference} /* {name} */'])
        for phase in phases:
            included = any(tree.get(item, {}).get('fileRef') == reference for item in tree[phase]['files'])
            if included: continue
            if check: raise ValueError(f'{name} missing from native extension phase {phase}')
            build_id = hashlib.sha256((phase + ':' + name).encode()).hexdigest()[:24].upper()
            line = f'\t\t{build_id} /* {name} in Resources */ = {{isa = PBXBuildFile; fileRef = {reference} /* {name} */; }};\n'
            text = text.replace('/* End PBXBuildFile section */', line + '/* End PBXBuildFile section */')
            text = append_list(text, phase, 'files', [f'{build_id} /* {name} in Resources */'])
    versions = set(re.findall(r'MARKETING_VERSION = ([0-9.]+);', text))
    if check:
        if versions != {version}: raise ValueError('Native marketing version differs from Safari input')
        for name, data in payload.items():
            if not (RESOURCES/name).exists() or (RESOURCES/name).read_bytes() != data:
                raise ValueError(f'Stale copied Safari resource: {name}')
    else:
        text = re.sub(r'(MARKETING_VERSION = )[0-9.]+;', lambda match: match[1] + version + ';', text)
        if native_build is not None:
            if native_build < 1: raise ValueError('Native build must be positive')
            text = re.sub(r'(CURRENT_PROJECT_VERSION = )[0-9]+;', lambda match: match[1] + str(native_build) + ';', text)
        objects(text)  # Parse the complete edited project before writing.
        PROJECT.write_text(text)
        for name, data in payload.items():
            destination = RESOURCES/name
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(data)
        report = json.loads(AUDIT.read_text())
        if 'historical_beta' not in report:
            report['historical_beta'] = {'version': report['version'], 'native_builds': report.get('native_builds', {}),
                'upload': 'Previously uploaded once; current processing/tester availability is unverified. Do not reupload.',
                'app_store_connect_id': report.get('testflight_metadata', {}).get('app_store_connect_id')}
        report.update({'version': version, 'resource_sha256': {name: hashlib.sha256(data).hexdigest() for name, data in payload.items()},
            'runtime_resources_unchanged': True, 'runtime_validation': 'unrun for this candidate', 'current_candidate_uploaded': False})
        if native_build is not None: report['native_builds'] = {'ios': str(native_build), 'macos': str(native_build)}
        AUDIT.write_text(json.dumps(report, indent=2) + '\n')
    expected = {name: hashlib.sha256(data).hexdigest() for name, data in payload.items()}
    audit = json.loads(AUDIT.read_text())
    if audit['resource_sha256'] != expected or audit['version'] != version: raise ValueError('Safari input audit is stale')
    print(f'Facefix {version}: {len(payload)} Safari runtime files verified; existing app and extension identities retained.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--build', type=int)
    options = parser.parse_args()
    try: synchronize(options.check, options.build)
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
