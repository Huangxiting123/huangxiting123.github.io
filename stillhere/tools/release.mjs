import {readFile,writeFile,copyFile,mkdir,stat} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const [version,archive,notes]=process.argv.slice(2);
if(!/^v\d+\.\d+\.\d+$/.test(version||'')||!archive||!notes){console.error('Usage: node tools/release.mjs v0.6.0 ABSOLUTE_ZIP_PATH ABSOLUTE_NOTES_JSON_PATH');process.exit(1);}
const info=JSON.parse(await readFile(resolve(notes),'utf8'));if(!info.title||!Array.isArray(info.changes)||!info.changes.every(s=>typeof s==='string')||!info.date||!info.limitations)throw Error('Notes JSON requires title, changes[], date, limitations');
const bytes=await readFile(resolve(archive));if(bytes[0]!==0x50||bytes[1]!==0x4b)throw Error('Archive must be ZIP');
const digest=createHash('sha256').update(bytes).digest('hex');const manifestPath=join(root,'releases.json');const manifest=JSON.parse(await readFile(manifestPath,'utf8'));if(manifest.releases.some(r=>r.version===version))throw Error('Version already exists; publish a new version instead of overwriting history');
await mkdir(join(root,'releases'),{recursive:true});const target=join(root,'releases',`stillhere-${version}.zip`);try{await stat(target);throw Error('Release file already exists');}catch(e){if(e.code!=='ENOENT')throw e;}
await copyFile(resolve(archive),target);const noteName=`releases/${version}.md`;await writeFile(join(root,noteName),`# 续在 ${version}\n\n${info.title}\n\n${info.changes.map(s=>'- '+s).join('\n')}\n\n## 使用与限制\n\n${info.limitations}\n\nSHA-256: ${digest}\n`,'utf8');
manifest.releases.push({version,...info,file:null,publicDownload:false,archiveName:`stillhere-${version}.zip`,notes:'./'+noteName,sha256:digest,size:bytes.length});manifest.releases.sort((a,b)=>{const x=a.version.slice(1).split('.').map(Number),y=b.version.slice(1).split('.').map(Number);return y[0]-x[0]||y[1]-x[1]||y[2]-x[2];});await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n','utf8');console.log('Prepared '+version+'. Run node tools/check.mjs, then commit and push the stillhere directory to the website repository.');
