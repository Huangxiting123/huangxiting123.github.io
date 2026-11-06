from pathlib import Path
import hashlib, json
root = Path(__file__).resolve().parent
manifest = json.loads((root / 'manifest.json').read_text())
output = root / 'dist' / manifest['filename']
output.parent.mkdir(exist_ok=True)
combined = hashlib.sha256()
with output.open('wb') as target:
    for part in manifest['parts']:
        data = (root / 'parts' / part['name']).read_bytes()
        if len(data) != part['bytes'] or hashlib.sha256(data).hexdigest() != part['sha256']:
            raise RuntimeError('Part integrity mismatch: ' + part['name'])
        target.write(data)
        combined.update(data)
if output.stat().st_size != manifest['bytes'] or combined.hexdigest() != manifest['sha256']:
    raise RuntimeError('Combined archive integrity mismatch')
print('Verified release archive:', output.name, output.stat().st_size, combined.hexdigest())
