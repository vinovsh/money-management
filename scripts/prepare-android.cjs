const fs=require('node:fs');const path=require('node:path');
// Old-architecture libraries predate AGP 8's required namespace declaration.
// Apply only to this project's installed dependencies, never to the root SDK.
for(const moduleName of ['react-native-sqlite-storage','react-native-aes-crypto','react-native-fs','react-native-document-picker']){
 const dir=path.join(__dirname,'..','node_modules',moduleName,...(moduleName==='react-native-sqlite-storage'?['platforms','android']:['android']));const gradle=path.join(dir,'build.gradle');const manifest=path.join(dir,'src','main','AndroidManifest.xml');
 if(!fs.existsSync(gradle))throw new Error('Missing installed dependency '+moduleName);
 let content=fs.readFileSync(gradle,'utf8');const xml=fs.readFileSync(manifest,'utf8');const match=xml.match(/package="([^"]+)"/);
 if(!/\bnamespace\s*(?:=|['"])/.test(content)&&match){content=content.replace(/android\s*\{/,`android {\n    namespace "${match[1]}"`);fs.writeFileSync(gradle,content);}
 // AGP 8 no longer accepts package as namespace in source manifests.
 if(match)fs.writeFileSync(manifest,xml.replace(/\s+package="[^"]+"/,''));
}
