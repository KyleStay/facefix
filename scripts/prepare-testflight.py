"""Add local TestFlight metadata to a newly generated, audited Safari project.

Does not register identities, provision, sign, upload, or invite anyone.
"""
import argparse
import hashlib
import json
import plistlib
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def reviewed_sources(native, report):
    expected = json.loads((ROOT/'scripts/reviewed-native-template.json').read_text())
    identifiers = report['bundle_identifiers']
    pairs = [(app,app+'.Extension') for app in identifiers if app+'.Extension' in identifiers]
    if len(identifiers) != 2 or len(pairs) != 1:
        raise ValueError('Native app/extension identity pair needs review')
    extension_identifier = pairs[0][1]
    actual = {}
    for source in native.rglob('*'):
        if source.suffix.lower() not in {'.swift','.m','.mm','.c','.cc','.cpp','.cxx','.h','.hh','.hpp','.hxx','.s'}:
            continue
        value = source.read_text()
        if source.name == 'ViewController.swift':
            identifier = extension_identifier
            if f'let extensionBundleIdentifier = "{identifier}"' not in value:
                raise ValueError('Native extension identity needs review')
            value = value.replace(f'let extensionBundleIdentifier = "{identifier}"',
                                  'let extensionBundleIdentifier = "REVIEWED_EXTENSION_ID"')
        normalized = '\n'.join(line.strip() for line in value.splitlines()
                               if line.strip() and not line.strip().startswith('//'))
        actual[str(source.relative_to(native))] = hashlib.sha256(normalized.encode()).hexdigest()
    if actual != expected:
        raise ValueError('Native sources differ from independently reviewed template; review privacy APIs and encryption before preparing')
    return actual


def prepare(destination):
    destination = Path(destination).resolve()
    report_path = destination / 'safari-build-input.json'
    report = json.loads(report_path.read_text())
    if report.get('runtime_resources_unchanged') is not True:
        raise ValueError('Use a new audited prepare-safari.py output')
    projects = list(destination.rglob('project.pbxproj'))
    if len(projects) != 1:
        raise ValueError('Expected one generated Safari project')
    project = projects[0]
    native = project.parent.parent
    sources = reviewed_sources(native, report)
    # Recheck the copied runtime instead of trusting a stale generator report.
    manifests = list(native.rglob('manifest.json'))
    if len(manifests) != 1:
        raise ValueError('Expected one extension runtime')
    for name, digest in report['resource_sha256'].items():
        if hashlib.sha256((manifests[0].parent/name).read_bytes()).hexdigest() != digest:
            raise ValueError('Runtime changed since Safari preparation')
    text = project.read_text()
    if 'PrivacyInfo.xcprivacy' in text:
        raise ValueError('Privacy resources already exist; inspect instead of overwriting')
    file_id = hashlib.sha256(b'facefix-privacy-file').hexdigest()[:24].upper()
    if file_id in text:
        raise ValueError('Generated project identifier collision')
    build_files = []
    def resource(match):
        build_id = hashlib.sha256(('facefix-privacy-' + match['id']).encode()).hexdigest()[:24].upper()
        if build_id in text:
            raise ValueError('Generated build identifier collision')
        build_files.append(f'\t\t{build_id} /* PrivacyInfo.xcprivacy in Resources */ = {{isa = PBXBuildFile; fileRef = {file_id} /* PrivacyInfo.xcprivacy */; }};\n')
        return match[0] + f'\n\t\t\t\t{build_id} /* PrivacyInfo.xcprivacy in Resources */,'
    text, count = re.subn(r'(?P<id>[A-F0-9]{24}) /\* Resources \*/ = \{\s*isa = PBXResourcesBuildPhase;\s*buildActionMask = [0-9]+;\s*files = \(', resource, text)
    if count != 4:
        raise ValueError('Expected four app/extension resource phases')
    for marker in ['/* End PBXBuildFile section */','/* End PBXFileReference section */']:
        if text.count(marker) != 1:
            raise ValueError('Unexpected native project structure')
    text = text.replace('/* End PBXBuildFile section */',''.join(build_files) + '/* End PBXBuildFile section */')
    text = text.replace('/* End PBXFileReference section */',f'\t\t{file_id} /* PrivacyInfo.xcprivacy */ = {{isa = PBXFileReference; lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = SOURCE_ROOT; }};\n/* End PBXFileReference section */')
    text, count = re.subn(r'(PRODUCT_BUNDLE_IDENTIFIER = [A-Za-z0-9.-]+;)',r'\1\n\t\t\t\tINFOPLIST_KEY_ITSAppUsesNonExemptEncryption = NO;',text)
    if count != 8:
        raise ValueError('Expected eight native target build configurations')
    privacy = {'NSPrivacyTracking':False,'NSPrivacyTrackingDomains':[],
               'NSPrivacyCollectedDataTypes':[],'NSPrivacyAccessedAPITypes':[]}
    # These declarations are bound to the exact independently reviewed template.
    icon = native / 'Shared (App)/Assets.xcassets/AppIcon.appiconset/universal-icon-1024@1x.png'
    subprocess.run(['xcrun','swift','-module-cache-path',str(destination/'swift-module-cache'),
                    str(ROOT/'scripts/encode-opaque-icon.swift'),str(icon)],check=True)
    (native/'PrivacyInfo.xcprivacy').write_bytes(plistlib.dumps(privacy))
    project.write_text(text)
    for name, mode in [('ExportOptions.TestFlight.plist','export'),('ExportOptions.TestFlightUpload.plist','upload')]:
        (destination/name).write_bytes(plistlib.dumps({'destination':mode,'method':'app-store-connect',
            'manageAppVersionAndBuildNumber':False,'signingStyle':'automatic','stripSwiftSymbols':True,
            'teamID':'TF2BG2VDPD','uploadSymbols':True}))
    report['testflight_metadata'] = {'privacy_manifest':privacy,'non_exempt_encryption':False,
        'reviewed_native_sources':sources,'upload_allowed':False,
        'production_identity_unverified':True,
        'icon':'1024 PNG, unused alpha removed; any nonopaque source pixel is refused',
        'signing_upload_tester_status':'unrun; verify Apple records and existing signing assets first'}
    report_path.write_text(json.dumps(report,indent=2)+'\n')
    return project.parent


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('project_location',type=Path)
    args=parser.parse_args()
    print(prepare(args.project_location))
