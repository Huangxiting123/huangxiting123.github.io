import {readFile,stat} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');const manifest=JSON.parse(await readFile(join(root,'releases.json'),'utf8'));const seen=new Set();
for(const r of manifest.releases){assert.ok(/^v\d+\.\d+\.\d+$/.test(r.version));assert.ok(!seen.has(r.version));seen.add(r.version);assert.ok(typeof r.publicDownload==='boolean');if(r.publicDownload)assert.ok(typeof r.file==='string'&&r.file.startsWith('./releases/')&&!r.file.includes('..'));else assert.equal(r.file,null);assert.ok(r.notes.startsWith('./releases/')&&!r.notes.includes('..'));if(r.publicDownload){const bytes=await readFile(join(root,r.file));assert.equal(bytes.length,r.size);assert.equal(createHash('sha256').update(bytes).digest('hex'),r.sha256);}else assert.match(r.sha256,/^[a-f0-9]{64}$/);assert.ok((await stat(join(root,r.notes))).isFile());}
const html=await readFile(join(root,'index.html'),'utf8');const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));for(const m of html.matchAll(/href="#([^"]+)"/g))assert.ok(ids.has(m[1]),'Missing anchor '+m[1]);for(const m of html.matchAll(/(?:src|href)="\.\/([^"#?]+)"/g))assert.ok((await stat(join(root,m[1]))).isFile(),'Missing file '+m[1]);
console.log(`PASS: ${manifest.releases.length} release records, publication flags, notes, assets and internal links.`);
