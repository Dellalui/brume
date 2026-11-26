"""Prepare the six original generated sheets as shared, transparent NPC frames."""
import hashlib
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile
from PIL import Image

NAMES = ('scout', 'villager', 'guard', 'merchant', 'bandit', 'mage')
archive = Path('brume-pnj-16-vues.zip')
assert hashlib.sha256(archive.read_bytes()).hexdigest() == '5346aec67d88fd0f231609cf9c3edcb58a8c3892bf7e51c4a6bb70349c0c72b9', 'Unexpected NPC source archive'
out = Path('dist/assets/npc')
out.mkdir(parents=True, exist_ok=True)
with ZipFile(archive) as z:
    assert sorted(z.namelist()) == sorted(n+'.png' for n in NAMES)
    for name in NAMES:
        sheet = Image.open(BytesIO(z.read(name+'.png'))).convert('RGBA')
        assert sheet.size == (1254, 1254)
        for i in range(16):
            col, row = i % 4, i // 4
            cell = sheet.crop((round(col*sheet.width/4),round(row*sheet.height/4),round((col+1)*sheet.width/4),round((row+1)*sheet.height/4)))
            alpha = cell.getchannel('A')
            bounds = alpha.point(lambda a: 255 if a >= 128 else 0).getbbox()
            assert bounds and bounds[3]-bounds[1] > 150
            l,t,r,b = bounds
            cell.putalpha(alpha.point(lambda a: 0 if a < 48 else a))
            cell = cell.crop((max(0,l-2),max(0,t-2),min(cell.width,r+2),min(cell.height,b+2)))
            scale = min(176/cell.width,244/cell.height)
            cell = cell.resize((round(cell.width*scale),round(cell.height*scale)),Image.Resampling.LANCZOS)
            frame = Image.new('RGBA',(192,256))
            frame.alpha_composite(cell,((192-cell.width)//2,252-cell.height))
            frame.save(out/f'{name}-{i:02}.webp','WEBP',quality=85,method=3,alpha_quality=100)
            with Image.open(out/f'{name}-{i:02}.webp') as check:
                assert check.size==(192,256) and check.mode=='RGBA' and check.getchannel('A').getextrema()==(0,255)
assert len(list(out.glob('*.webp'))) == 96
print('96 normalized transparent frames:',sum(p.stat().st_size for p in out.glob('*.webp')),'bytes')
