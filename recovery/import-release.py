#!/usr/bin/env python3
"""Materialize the browser-exported release only after checking every file."""
import hashlib
import json
import sys
from pathlib import Path, PurePosixPath
from zipfile import ZipFile

manifest = json.loads(Path("recovery/manifest.json").read_text(encoding="utf-8"))
paths = manifest["paths"]
if len(paths) != 164 or len(set(paths)) != len(paths):
    raise SystemExit("Invalid release manifest")
for name in paths:
    path = PurePosixPath(name)
    if not name.startswith("dist/") or path.is_absolute() or ".." in path.parts or "\\" in name:
        raise SystemExit(f"Unsafe release path: {name}")
with ZipFile(sys.argv[1]) as archive:
    infos = archive.infolist()
    if sorted(i.filename for i in infos) != sorted(paths):
        raise SystemExit("ZIP contents do not match the 164 expected files")
    if sum(i.file_size for i in infos) > 64 * 1024 * 1024:
        raise SystemExit("Unexpected ZIP size")
    files = {name: archive.read(name) for name in paths}
digest = hashlib.sha256()
for name in paths:
    digest.update((name + "\0" + hashlib.sha256(files[name]).hexdigest() + "\n").encode("utf-8"))
fingerprint = digest.hexdigest()
if fingerprint != manifest["target"]:
    raise SystemExit(f"Release SHA-256 mismatch: {fingerprint}")
for name, data in files.items():
    path = Path(name)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
print(f"Verified and imported {len(files)} files; SHA-256: {fingerprint}")
