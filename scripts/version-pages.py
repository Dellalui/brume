"""Give each Pages build a coherent set of browser module/cache URLs."""
import json
import re
import sys
from pathlib import Path

def version_site(dist: Path, revision: str):
    if not re.fullmatch(r"[a-f0-9]{7,64}", revision):
        raise ValueError("Expected Git revision")
    index = dist / "index.html"
    html = index.read_text(encoding="utf-8")
    entry = '<script type="module" src="bootstrap.mjs"></script>'
    if html.count(entry) != 1:
        raise ValueError("Expected one unversioned bootstrap entry")
    # Import maps resolve relative imports against the module URL, so every
    # module in the main browser graph gets exactly one URL per deployment.
    # A query on bootstrap alone would leave editor.mjs and its imports cached.
    imports = {}
    for p in sorted(dist.rglob("*")):
        if p.is_file() and p.suffix in (".mjs", ".js"):
            url = "./" + p.relative_to(dist).as_posix()
            imports[url] = url + "?v=" + revision
    for required in ("./bootstrap.mjs", "./editor.mjs", "./canvas-hud.mjs", "./workspace-ui.mjs"):
        if required not in imports:
            raise ValueError("Missing module: " + required)
    mapping = json.dumps({"imports": imports}, separators=(",", ":")).replace("<", "\\u003c")
    html = html.replace(entry, '<script type="importmap">' + mapping + '</script>\n'
                        + '<script type="module" src="bootstrap.mjs?v=' + revision + '"></script>')
    for css in ("editor.css", "workspace.css"):
        old = 'href="' + css + '"'
        if old not in html:
            raise ValueError("Missing stylesheet: " + css)
        html = html.replace(old, 'href="' + css + '?v=' + revision + '"')
    html = html.replace("</head>", '<meta name="brume-revision" content="' + revision + '"></head>', 1)
    index.write_text(html, encoding="utf-8")

if __name__ == "__main__":
    version_site(Path(sys.argv[1]), sys.argv[2])
