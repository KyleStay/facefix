import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

spec = importlib.util.spec_from_file_location('build', Path(__file__).resolve().parents[1] / 'build.py')
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)

class Packaging(unittest.TestCase):
    def test_modes_and_permissions(self):
        original = json.loads((build.ROOT / 'manifest.json').read_text())
        for mode in ['store','development','replacement']:
            key=build.ROOT/'identity/production-public-key.txt' if mode=='replacement' else None
            output = build.build(mode,key)
            first = output.read_bytes()
            self.assertEqual(first, build.build(mode,key).read_bytes())
            with ZipFile(output) as z:
                m=json.loads(z.read('manifest.json'))
                self.assertEqual(m['permissions'],original['permissions'])
                self.assertEqual(m['host_permissions'],original['host_permissions'])
                self.assertNotIn('management',m['permissions'])
                self.assertEqual('key' in m,mode!='store')
                self.assertNotIn('externally_connectable',m)
                self.assertFalse(any('ownership' in n for n in z.namelist()))
                if mode=='replacement':self.assertEqual(build.extension_id(m['key']),build.PRODUCTION_ID)
                self.assertFalse(any('private' in n or n.endswith('.pem') for n in z.namelist()))
                resources=list(m['icons'].values())+[m['background']['service_worker'],m['action']['default_popup']]
                for script in m['content_scripts']:resources+=script.get('js',[])+script.get('css',[])
                for n in resources:self.assertTrue(z.read(n))
                self.assertIsNone(z.testzip())
    def test_replacement_requires_verified_key(self):
        with self.assertRaises(ValueError):build.build('replacement')
        with self.assertRaises(ValueError):build.build('replacement',build.ROOT/'identity/development-public-key.txt')
    def test_version_numeric_ordering(self):
        self.assertGreater(build.version_parts('1.4.2'),build.version_parts('1.4.1'))
        self.assertGreater(build.version_parts('1.4.2'),build.version_parts('1.4.0'))
        self.assertGreater(build.version_parts('1.10'),build.version_parts('1.9.9999'))
        self.assertEqual(build.version_parts('1.4.2'),build.version_parts('1.4.2.0'))
        for value in ['01.2','0','1.65536','1.2.3.4.5','1.2rc1',None]:
            with self.assertRaises(ValueError):build.version_parts(value)
    def test_invalid_keys_rejected(self):
        for value in ['-----BEGIN PRIVATE KEY-----','not base64','']:
            with self.assertRaises(ValueError):build.extension_id(value)

if __name__=='__main__':unittest.main()
