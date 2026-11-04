from pathlib import Path
import subprocess, zipfile, sys, json, hashlib
root=Path(__file__).resolve().parent.parent
build=root/'desktop'/'build';build.mkdir(exist_ok=True)
payload=build/'payload.zip'
node=Path(sys.argv[1]).resolve()
with zipfile.ZipFile(payload,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
    archive.write(node,'node.exe')
    archive.write(root/'desktop'/'LICENSE-Node.txt','LICENSE-Node.txt')
    for name in ('Launcher.cs','build_exe.py','README.md'):
        archive.write(root/'desktop'/name,'build-source/'+name)
    for path in sorted(root.iterdir()):
        if path.is_file() and (path.suffix in ('.mjs','.js','.html') or path.name=='package.json') and not path.name.endswith('.test.mjs') and path.name!='tests.mjs':
            archive.write(path,'app/'+path.name)
output=root/'desktop'/'Stillhere-Preview.exe'
compiler=Path(r'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe')
command=[str(compiler),'/nologo','/target:winexe','/platform:x64','/optimize+', '/out:'+str(output),'/resource:'+str(payload)+',payload.zip','/r:System.Windows.Forms.dll','/r:System.Drawing.dll','/r:System.IO.Compression.dll','/r:System.IO.Compression.FileSystem.dll',str(root/'desktop'/'Launcher.cs')]
subprocess.run(command,check=True)
metadata={'name':output.name,'size':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'runtime':'Node.js 24.22.1 x64','kind':'Windows development preview','source_version':json.loads((root/'package.json').read_text())['version']}
(root/'desktop'/'build-info.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
print(json.dumps(metadata))
