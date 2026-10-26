import importlib.util
import json
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('prepare_safari', Path(__file__).resolve().parents[1] / 'scripts/prepare-safari.py')
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)


class SafariProject(unittest.TestCase):
    def test_new_project_only_and_explicit_identity(self):
        with tempfile.TemporaryDirectory() as scratch:
            with self.assertRaises(ValueError):
                prepare.prepare(Path(scratch), 'com.example.Facefix')
            with self.assertRaises(ValueError):
                prepare.prepare(Path(scratch)/'new', 'not an identity')

    def test_platforms_minima_versions_and_allowlisted_resources(self):
        paths = []
        def converter(command, check):
            source = Path(command[2])
            paths.append(source)
            manifest = json.loads((source/'manifest.json').read_text())
            self.assertEqual(manifest['content_scripts'][0]['world'],'MAIN')
            self.assertNotIn('key',manifest)
            self.assertNotIn('minimum_chrome_version',manifest)
            self.assertTrue((source/'app-prompts.js').is_file())
            self.assertFalse((source/'.git').exists())
            self.assertFalse((source/'identity').exists())
            self.assertNotIn('--macos-only',command)
            self.assertNotIn('--ios-only',command)
            self.assertNotIn('--force',command)
            self.assertEqual(command[command.index('--bundle-identifier')+1],'com.example.Facefix')
            output = Path(command[command.index('--project-location')+1])/'Facefix.xcodeproj'
            output.mkdir(parents=True)
            shutil.copytree(source, output.parent/'Resources')
            (output/'project.pbxproj').write_text('MACOSX_DEPLOYMENT_TARGET = 11.0;\nIPHONEOS_DEPLOYMENT_TARGET = 15.0;\nMARKETING_VERSION = 1.0;\nPRODUCT_BUNDLE_IDENTIFIER = com.example.Facefix;\nPRODUCT_BUNDLE_IDENTIFIER = com.example.Facefix.Extension;')
        with tempfile.TemporaryDirectory() as scratch, patch.object(prepare.subprocess,'run',side_effect=converter):
            project = prepare.prepare(Path(scratch)/'new','com.example.Facefix')
            text = (project/'project.pbxproj').read_text()
            self.assertIn('MACOSX_DEPLOYMENT_TARGET = 13.0;',text)
            self.assertIn('IPHONEOS_DEPLOYMENT_TARGET = 18.0;',text)
            self.assertIn('MARKETING_VERSION = '+json.loads((Path(__file__).resolve().parents[1]/'manifest.json').read_text())['version']+';',text)
            self.assertIn('PRODUCT_BUNDLE_IDENTIFIER = com.example.Facefix;',text)
            report = json.loads((project.parent/'safari-build-input.json').read_text())
            self.assertEqual(report['safari_minimum'],'18.0')
            self.assertEqual(report['native_deployment_targets'],{'MACOSX_DEPLOYMENT_TARGET':['13.0'],'IPHONEOS_DEPLOYMENT_TARGET':['18.0']})
            self.assertTrue(report['runtime_resources_unchanged'])
            self.assertEqual(report['runtime_validation'],'unrun')
        self.assertFalse(paths[0].exists(),'converter staging is cleaned')

    def test_rejects_changed_execution_world_or_bundle_identity(self):
        for change in ['world', 'identity']:
            with self.subTest(change=change), tempfile.TemporaryDirectory() as scratch:
                def converter(command, check):
                    source = Path(command[2])
                    output = Path(command[command.index('--project-location')+1])/'Facefix.xcodeproj'
                    output.mkdir(parents=True)
                    resources = output.parent/'Resources'
                    shutil.copytree(source,resources)
                    (output/'project.pbxproj').write_text('MACOSX_DEPLOYMENT_TARGET = 13.0;\nIPHONEOS_DEPLOYMENT_TARGET = 18.0;\nMARKETING_VERSION = 1.0;\nPRODUCT_BUNDLE_IDENTIFIER = com.example.Facefix;\nPRODUCT_BUNDLE_IDENTIFIER = '+('wrong.Extension' if change=='identity' else 'com.example.Facefix.Extension')+';')
                    if change == 'world':
                        manifest = json.loads((resources/'manifest.json').read_text())
                        manifest['content_scripts'][0].pop('world')
                        (resources/'manifest.json').write_text(json.dumps(manifest))
                with patch.object(prepare.subprocess,'run',side_effect=converter), self.assertRaisesRegex(RuntimeError,'changed extension resource|bundle identifiers'):
                    prepare.prepare(Path(scratch)/'new','com.example.Facefix')

    def test_reports_higher_converter_defaults_and_rejects_missing_version_targets(self):
        for omit in [None,'MARKETING_VERSION','MACOSX_DEPLOYMENT_TARGET','IPHONEOS_DEPLOYMENT_TARGET']:
            with self.subTest(omit=omit), tempfile.TemporaryDirectory() as scratch:
                def converter(command, check):
                    source = Path(command[2])
                    output = Path(command[command.index('--project-location')+1])/'Facefix.xcodeproj'
                    output.mkdir(parents=True)
                    shutil.copytree(source,output.parent/'Resources')
                    values={'MACOSX_DEPLOYMENT_TARGET':'14.0','IPHONEOS_DEPLOYMENT_TARGET':'19.0','MARKETING_VERSION':'1.0'}
                    text='\n'.join(f'{key} = {value};' for key,value in values.items() if key != omit)
                    (output/'project.pbxproj').write_text(text+'\nPRODUCT_BUNDLE_IDENTIFIER = com.example.Facefix;\nPRODUCT_BUNDLE_IDENTIFIER = com.example.Facefix.Extension;')
                with patch.object(prepare.subprocess,'run',side_effect=converter):
                    if omit:
                        with self.assertRaisesRegex(RuntimeError,'missing'):
                            prepare.prepare(Path(scratch)/'new','com.example.Facefix')
                    else:
                        project=prepare.prepare(Path(scratch)/'new','com.example.Facefix')
                        report=json.loads((project.parent/'safari-build-input.json').read_text())
                        self.assertEqual(report['native_deployment_targets'],{'MACOSX_DEPLOYMENT_TARGET':['14.0'],'IPHONEOS_DEPLOYMENT_TARGET':['19.0']})


if __name__ == '__main__':
    unittest.main()
