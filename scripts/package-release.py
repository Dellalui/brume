"""Package the tested static site, sources, tests and licenses; no dependencies/cache."""
import datetime
import os
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile
from zoneinfo import ZoneInfo
root = Path(__file__).resolve().parents[1]
version = json.loads((root / 'package.json').read_text())['version']
date = os.environ.get('BRUME_RELEASE_DATE') or datetime.datetime.now(ZoneInfo('Europe/Paris')).date().isoformat()
datetime.date.fromisoformat(date)
commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
files = set(subprocess.check_output(['git', 'ls-files', '--cached', '--others', '--exclude-standard'], cwd=root, text=True).splitlines())
# Old bundled releases in the repository are not recursively embedded.
files = sorted(f for f in files if not f.endswith('.zip') and not f.startswith(('releases/', '.github/', 'recovery/')) and (root / f).is_file())
out = root / 'releases' / f'brume-v{version}-{date}.zip'
out.parent.mkdir(exist_ok=True)
manifest = {'version': version, 'date': date, 'timezone': 'Europe/Paris', 'sourceCommit': commit,
            'workingTreeModified': bool(subprocess.check_output(['git', 'status', '--porcelain'], cwd=root, text=True).strip()),
            'sha256': {f: hashlib.sha256((root / f).read_bytes()).hexdigest() for f in files}}
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for f in files: z.write(root / f, f)
    z.writestr('RELEASE.json', json.dumps(manifest, indent=2, ensure_ascii=False) + '\n')
with zipfile.ZipFile(out) as z:
    assert z.testzip() is None
    for f, digest in manifest['sha256'].items(): assert hashlib.sha256(z.read(f)).hexdigest() == digest
print(out)
print(f'{len(files)} files; {out.stat().st_size} bytes; source {commit}')
