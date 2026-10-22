"""Produce browser UI fixtures and honest, static store previews from the real popup markup."""
from pathlib import Path
import re
root=Path(__file__).resolve().parent.parent
popup=(root/'popup.html').read_text()
for name,source in [('browser-popup.html',popup),('browser-diagnostics.html',(root/'diagnostics.html').read_text())]:
    source=re.sub(r'src="([^"]+\.js)"',r'src="../\1"',source)
    source=source.replace('href="privacy.html"','href="../privacy.html"').replace('href="diagnostics.html"','href="browser-diagnostics.html"')
    source=source.replace('<script src=', '<script src="../diagnostics.js"></script><script src="ui-api.js"></script><script src=',1) if name=='browser-popup.html' else source.replace('<script src="../diagnostics.js"></script>','<script src="../diagnostics.js"></script><script src="ui-api.js"></script>')
    # Label simulated APIs visibly, outside the popup capture area.
    banner='<aside style="position:fixed;left:400px;top:24px;max-width:450px;padding:16px;border:1px solid #9bad9b;background:#fff;color:#193d32;font:14px/1.6 system-ui">Browser UI test using synthetic APIs. This is not a live Facebook session. <a href="browser-popup.html?mode=bridge-missing">Missing connection</a> · <a href="browser-popup.html?mode=guard-missing">Missing guard</a> · <a href="browser-popup.html?mode=outdated">Old guard</a> · <a href="browser-popup.html">Connected</a></aside>'
    if name=='browser-popup.html': source=source.replace('<h1>',banner+'<h1>',1)
    else: source=source.replace('<main>','<div style="padding:10px;text-align:center;background:#e5d7b2">Browser UI test · synthetic APIs · not a live Facebook session</div><main>',1)
    (root/'tests'/name).write_text(source)
# No scripted values or invented interventions in the store interface preview.
preview=re.sub(r'<script\b[^>]*>.*?</script>','',popup,flags=re.S)
helper=(root/'timers.js').read_text()
markup=re.search(r'markup: `(.*?)`,\n  css:',helper,re.S).group(1)
css=re.search(r'css: `(.*?)`,\n  render',helper,re.S).group(1)
markup=markup.replace('Connecting to this Facebook tab…','Waiting for your next tab return').replace('Waiting for tab status.','Zero means that window is inactive. It does not mean Facebook will reload.')
markup=markup.replace('data-timer="navigation">—','data-timer="navigation">0.0 s').replace('data-timer="recovery">—','data-timer="recovery">0.0 s')
preview=preview.replace('<section id="timers" aria-label="Live Facefix protection timers"></section>',f'<style>{css}</style><section id="timers" aria-label="Live Facefix protection timers">{markup}</section>')
preview=preview.replace('href="privacy.html"','href="../privacy.html"')
preview=preview.replace('<p id="version" style="margin:0;font-size:11px"></p>','<p style="margin:0;font-size:11px">Installed 1.4.0 · Page 1.4.0</p>')
(root/'store-assets/popup-preview.html').write_text(preview)

(root/'store-assets/popup-preview-diagnostics.html').write_text(preview.replace('<details id="diagnostics">','<details id="diagnostics" open>').replace('</style>','body{padding-bottom:240px}</style>',1))
