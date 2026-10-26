"""Generate a NEW macOS + iOS/iPadOS Xcode project; never rewrite an existing identity."""
import argparse
import hashlib
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from zipfile import ZipFile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from build import build


def prepare(destination, bundle_identifier):
    destination = Path(destination).resolve()
    if destination.exists():
        raise ValueError('Output already exists; use a new folder. Existing Safari projects must retain their identifiers and signing configuration.')
    if not re.fullmatch(r'[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+', bundle_identifier):
        raise ValueError('Supply the containing app bundle identifier explicitly')
    archive = build('safari')
    # Copy only allowlisted runtime resources, not the repository or identity keys.
    with tempfile.TemporaryDirectory(prefix='facefix-safari-') as scratch:
        with ZipFile(archive) as source:
            expected_resources = {name: source.read(name) for name in source.namelist()}
            source.extractall(scratch)
        subprocess.run([
            'xcrun', 'safari-web-extension-converter', scratch,
            '--project-location', str(destination), '--app-name', 'Facefix',
            '--bundle-identifier', bundle_identifier, '--swift',
            '--copy-resources', '--no-open', '--no-prompt',
        ], check=True)
    # Safari 18 is available on macOS 13+. Its own minimum is in the manifest.
    projects = list(destination.rglob('project.pbxproj'))
    if len(projects) != 1:
        raise RuntimeError('Expected one generated Xcode project')
    project = projects[0]
    text = project.read_text()
    version = json.loads(expected_resources['manifest.json'])['version']
    text, version_count = re.subn(r'(MARKETING_VERSION = )[0-9.]+(;)', rf'\g<1>{version}\2', text)
    if not version_count:
        raise RuntimeError('Generated project is missing marketing versions')
    deployment_targets = {}
    for key, minimum in [('MACOSX_DEPLOYMENT_TARGET', 13), ('IPHONEOS_DEPLOYMENT_TARGET', 18)]:
        text = re.sub(rf'({key} = )([0-9.]+)(;)',
                      lambda m: m[1] + (str(minimum) + '.0' if int(m[2].split('.')[0]) < minimum else m[2]) + m[3], text)
        deployment_targets[key] = sorted(set(re.findall(rf'{key} = ([0-9.]+);', text)))
        if not deployment_targets[key]:
            raise RuntimeError(f'Generated project is missing {key}')
    project.write_text(text)
    manifests = list(destination.rglob('manifest.json'))
    if len(manifests) != 1:
        raise RuntimeError('Expected one copied extension manifest')
    resources = manifests[0].parent
    for name, expected in expected_resources.items():
        if (resources / name).read_bytes() != expected:
            raise RuntimeError(f'Converter changed extension resource: {name}')
    identifiers = sorted(set(re.findall(r'PRODUCT_BUNDLE_IDENTIFIER = ([A-Za-z0-9.-]+);', text)))
    if identifiers != sorted([bundle_identifier, bundle_identifier + '.Extension']):
        raise RuntimeError('Generated bundle identifiers do not match the explicit request')
    # Audit the contract without claiming runtime execution or hiding tool warnings.
    report = {
        'safari_minimum': '18.0',
        'required_native_floors': {'macos': '13.0', 'ios_ipados': '18.0'},
        'native_deployment_targets': deployment_targets,
        'bundle_identifiers': identifiers, 'version': version,
        'runtime_resources_unchanged': True, 'runtime_validation': 'unrun',
        'resource_sha256': {name: hashlib.sha256(data).hexdigest() for name, data in expected_resources.items()},
    }
    (destination / 'safari-build-input.json').write_text(json.dumps(report, indent=2) + '\n')
    return project.parent


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project-location', type=Path, required=True)
    parser.add_argument('--bundle-identifier', required=True)
    args = parser.parse_args()
    try:
        print(prepare(args.project_location, args.bundle_identifier))
    except (ValueError, OSError, RuntimeError, subprocess.CalledProcessError) as error:
        parser.error(str(error))
