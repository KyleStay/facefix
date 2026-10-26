import importlib.util
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('prepare_testflight',ROOT/'scripts/prepare-testflight.py')
prepare=importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)

class ReviewedNativeSources(unittest.TestCase):
    def test_changed_added_and_missing_native_sources_require_review(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            approved={'App.swift':hashlib.sha256(b'import WebKit').hexdigest()}
            report={'bundle_identifiers':['com.example.Facefix','com.example.Facefix.Extension']}
            with patch.object(prepare.json,'loads',return_value=approved):
                (root/'App.swift').write_text('// generated date\nimport WebKit\n')
                self.assertEqual(prepare.reviewed_sources(root,report),approved)
                for value in ['import WebKit\nlet date = Date()',None]:
                    if value is None: (root/'App.swift').unlink()
                    else: (root/'App.swift').write_text(value)
                    with self.assertRaisesRegex(ValueError,'differ'):
                        prepare.reviewed_sources(root,report)
                (root/'App.swift').write_text('import WebKit')
                for suffix in ['.m','.cc','.cxx','.hpp','.hh','.S']:
                    added=root/('Added'+suffix)
                    added.write_text('void added() {}')
                    with self.assertRaisesRegex(ValueError,'differ'):
                        prepare.reviewed_sources(root,report)
                    added.unlink()

    def test_identity_is_validated_before_template_normalization(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            source=root/'ViewController.swift'
            source.write_text('let extensionBundleIdentifier = "wrong.Extension"')
            with self.assertRaisesRegex(ValueError,'identity'):
                prepare.reviewed_sources(root,{'bundle_identifiers':['com.example.Facefix','com.example.Facefix.Extension']})

    def test_containing_identity_can_itself_end_in_extension(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            (root/'ViewController.swift').write_text('let extensionBundleIdentifier = "com.example.Extension.Extension"')
            value='let extensionBundleIdentifier = "REVIEWED_EXTENSION_ID"'
            approved={'ViewController.swift':hashlib.sha256(value.encode()).hexdigest()}
            with patch.object(prepare.json,'loads',return_value=approved):
                self.assertEqual(prepare.reviewed_sources(root,{'bundle_identifiers':['com.example.Extension.Extension','com.example.Extension']}),approved)

if __name__=='__main__': unittest.main()
