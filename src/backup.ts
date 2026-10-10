import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import DocumentPicker from 'react-native-document-picker';
import {GoogleSignin} from '@react-native-google-signin/google-signin';
import {GOOGLE_WEB_CLIENT_ID,DRIVE_SCOPE} from './config';
import {snapshot} from './store';
import {validateSnapshot} from './domain.cjs';
import type {Snapshot} from './models';
const AES=require('react-native-aes-crypto').default;
const MAX_BYTES=25*1024*1024;
type Envelope={format:'moneywise-encrypted';version:1;kdf:'PBKDF2-SHA256';iterations:number;salt:string;iv:string;ciphertext:string;mac:string};
const ITERATIONS=210000;
const authenticated=(e:Envelope)=>[e.format,e.version,e.kdf,e.iterations,e.salt,e.iv,e.ciphertext].join('|');
async function keys(password:string,salt:string,iterations:number){
 if(password.length<12)throw new Error('Use a recovery passphrase with at least 12 characters.');
 const result:string=await AES.pbkdf2(password,salt,iterations,512,'sha256');
 return {encryption:result.slice(0,64),authentication:result.slice(64,128)};
}
export async function encrypt(s:Snapshot,password:string):Promise<string>{
 const salt=await AES.randomKey(32),iv=await AES.randomKey(16);const key=await keys(password,salt,ITERATIONS);
 const e:Envelope={format:'moneywise-encrypted',version:1,kdf:'PBKDF2-SHA256',iterations:ITERATIONS,salt,iv,ciphertext:await AES.encrypt(JSON.stringify(s),key.encryption,iv,'aes-256-cbc'),mac:''};
 e.mac=await AES.hmac256(authenticated(e),key.authentication);return JSON.stringify(e);
}
function same(a:string,b:string){if(a.length!==b.length)return false;let difference=0;for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);return difference===0;}
export async function decrypt(text:string,password:string):Promise<Snapshot>{
 if(text.length>MAX_BYTES)throw new Error('Backup exceeds the 25 MB safety limit.');
 let e:Envelope;try{e=JSON.parse(text);}catch{throw new Error('This is not a valid backup file.');}
 if(e.format!=='moneywise-encrypted'||e.version!==1||e.kdf!=='PBKDF2-SHA256'||e.iterations!==ITERATIONS||!(/^[a-f0-9]{64}$/i.test(e.salt))||!(/^[a-f0-9]{32}$/i.test(e.iv))||typeof e.ciphertext!=='string'||!(/^[a-f0-9]{64}$/i.test(e.mac)))throw new Error('Unsupported or damaged backup.');
 const key=await keys(password,e.salt,e.iterations);const mac=await AES.hmac256(authenticated(e),key.authentication);
 if(!same(mac,e.mac))throw new Error('Wrong recovery passphrase or a damaged backup. No data was changed.');
 try{return validateSnapshot(JSON.parse(await AES.decrypt(e.ciphertext,key.encryption,e.iv,'aes-256-cbc')));}catch{throw new Error('Backup contents failed validation. No data was changed.');}
}
export async function exportBackup(password:string){
 const path=`${RNFS.CachesDirectoryPath}/moneywise-${Date.now()}.moneywise.json`;
 await RNFS.writeFile(path,await encrypt(await snapshot(),password),'utf8');
 try{await Share.open({url:`file://${path}`,type:'application/json',title:'Save your encrypted Walletway backup',failOnCancel:false});}finally{await RNFS.unlink(path).catch(()=>{});}
}
export async function importBackup(password:string):Promise<Snapshot|null>{
 try{
 const file=await DocumentPicker.pickSingle({type:[DocumentPicker.types.allFiles],copyTo:'cachesDirectory'});
 if(file.size&&file.size>MAX_BYTES)throw new Error('Backup exceeds the 25 MB safety limit.');
 const path=file.fileCopyUri||file.uri;
 try{const stat=await RNFS.stat(path);if(Number(stat.size)>MAX_BYTES)throw new Error('Backup exceeds the 25 MB safety limit.');return await decrypt(await RNFS.readFile(path,'utf8'),password);}finally{if(file.fileCopyUri)await RNFS.unlink(path).catch(()=>{});}
 }catch(e){if(DocumentPicker.isCancel(e))return null;throw e;}
}
function configure(){if(!GOOGLE_WEB_CLIENT_ID)throw new Error('Google backup needs an OAuth client ID. Local encrypted export and restore are available now.');GoogleSignin.configure({webClientId:GOOGLE_WEB_CLIENT_ID,scopes:[DRIVE_SCOPE]});}
export async function connectGoogle():Promise<string>{configure();await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog:true});await GoogleSignin.signIn();const user=GoogleSignin.getCurrentUser();if(!user)throw new Error('Google sign-in did not finish.');return user.user.email;}
async function token(){configure();return (await GoogleSignin.getTokens()).accessToken;}
async function checked(response:Response){if(!response.ok){if(response.status===401||response.status===403)throw new Error('Google access expired or was denied. Reconnect Google and grant backup permission.');throw new Error(`Google Drive request failed (${response.status}). Your local data is safe.`);}return response;}
export async function googleBackup(password:string){
 const s=await snapshot();const data=await encrypt(s,password);const access=await token();const boundary='moneywise_'+Date.now();
 const metadata={name:`moneywise-${s.data.settings.datasetId}-${Date.now()}.json`,parents:['appDataFolder'],appProperties:{datasetId:s.data.settings.datasetId,format:'moneywise-v1'}};
 const body=`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${data}\r\n--${boundary}--`;
 const created=await (await checked(await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',{method:'POST',headers:{Authorization:`Bearer ${access}`,'Content-Type':`multipart/related; boundary=${boundary}`},body}))).json();
 const remote=await (await checked(await fetch(`https://www.googleapis.com/drive/v3/files/${created.id}?alt=media`,{headers:{Authorization:`Bearer ${access}`}}))).text();
 if(remote!==data)throw new Error('Backup verification failed. The last good backup is unchanged.');
 return s.createdAt;
}
export async function googleSnapshots(){const access=await token();const q=encodeURIComponent("trashed = false and appProperties has { key='format' and value='moneywise-v1' }");return (await (await checked(await fetch(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,name,createdTime,size)&orderBy=createdTime%20desc&pageSize=50`,{headers:{Authorization:`Bearer ${access}`}}))).json()).files as {id:string;name:string;createdTime:string;size?:string}[];}
export async function readGoogleSnapshot(fileId:string,password:string){const access=await token();const response=await checked(await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,{headers:{Authorization:`Bearer ${access}`}}));return decrypt(await response.text(),password);}
export async function disconnectGoogle(){configure();await GoogleSignin.signOut();}
export async function safetySnapshot(){const backup=await snapshot();const path=`${RNFS.DocumentDirectoryPath}/pre-restore-${backup.data.settings.datasetId}-${Date.now()}.json`;await RNFS.writeFile(path,JSON.stringify(backup),'utf8');return path;}
export async function exportCSV(ledger:Snapshot['data']){
 const safe=(v:string)=>'"'+(/^[=+@\-\t\r]/.test(v)?"'"+v:v).replace(/"/g,'""')+'"';
 const rows=ledger.transactions.filter(t=>!t.deletedAt).map(t=>[t.date,t.time||'',t.type,(t.amount/100).toFixed(2),ledger.settings.currency,ledger.accounts.find(a=>a.id===t.accountId)?.name||'',ledger.accounts.find(a=>a.id===t.destinationId)?.name||'',ledger.categories.find(c=>c.id===t.categoryId)?.name||'',t.note,t.tags].map(safe).join(','));
 const path=`${RNFS.CachesDirectoryPath}/moneywise-report.csv`;await RNFS.writeFile(path,['Date,Time,Type,Amount,Currency,Account,Destination,Category,Note,Tags',...rows].join('\r\n'),'utf8');try{await Share.open({url:`file://${path}`,type:'text/csv',title:'Export financial data (unencrypted)',failOnCancel:false});}finally{await RNFS.unlink(path).catch(()=>{});}
}

export async function safetyCopies(){const files=await RNFS.readDir(RNFS.DocumentDirectoryPath);return files.filter(f=>f.name.startsWith('pre-restore-')&&f.name.endsWith('.json')).map(f=>({path:f.path,date:f.mtime?.toISOString()||f.name})).sort((a,b)=>b.date.localeCompare(a.date));}
export async function readSafetyCopy(path:string){if(!path.startsWith(RNFS.DocumentDirectoryPath+'/pre-restore-'))throw new Error('Invalid recovery path.');const stat=await RNFS.stat(path);if(Number(stat.size)>MAX_BYTES)throw new Error('Recovery copy exceeds the size limit.');return validateSnapshot(JSON.parse(await RNFS.readFile(path,'utf8')));}
