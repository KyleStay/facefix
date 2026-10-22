"""Create the Chrome Web Store upload ZIP using only bundled runtime files."""
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(__file__).resolve().parent
manifest = json.loads((root / 'manifest.json').read_text())
files = {
    'manifest.json', 'background.js', 'guard.js', 'settings.js',
    'popup.html', 'popup.js', 'privacy.html', 'timers.js', 'connection.js',
    'diagnostics.js', 'diagnostics.html', 'diagnostics-view.js',
    *manifest['icons'].values(),
}
output = root / 'dist' / f"facefix-{manifest['version']}-store.zip"
output.parent.mkdir(exist_ok=True)
with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
    for name in sorted(files):
        archive.write(root / name, name)
with ZipFile(output) as archive:
    assert archive.testzip() is None
    assert 'manifest.json' in archive.namelist()
    assert json.loads(archive.read('manifest.json'))['version'] == manifest['version']
print(output)
