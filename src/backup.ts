import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import DocumentPicker from 'react-native-document-picker';
import {GoogleSignin} from '@react-native-google-signin/google-signin';
import {GOOGLE_ANDROID_CLIENT_ID,GOOGLE_WEB_CLIENT_ID,DRIVE_SCOPE} from './config';
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
let configured=false;
function configure(){if(configured)return;if(!GOOGLE_ANDROID_CLIENT_ID)throw new Error('Google account configuration is missing.');GoogleSignin.configure({scopes:[DRIVE_SCOPE],...(GOOGLE_WEB_CLIENT_ID?{webClientId:GOOGLE_WEB_CLIENT_ID}:{})});configured=true;}
export type GoogleAccount={id:string;email:string};
export async function currentGoogle():Promise<GoogleAccount|null>{configure();try{await GoogleSignin.signInSilently();const user=GoogleSignin.getCurrentUser();return user?{id:user.user.id,email:user.user.email}:null;}catch{return null;}}
export async function connectGoogle():Promise<GoogleAccount>{configure();await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog:true});const result=await GoogleSignin.signIn();if(result.type==='cancelled')throw new Error('Google sign-in was cancelled.');const user=GoogleSignin.getCurrentUser();if(!user)throw new Error('Google sign-in did not finish.');return {id:user.user.id,email:user.user.email};}
async function token(accountId:string){configure();const user=GoogleSignin.getCurrentUser();if(!user||user.user.id!==accountId)throw new Error('The Google account changed. Reconnect and review the selected account.');return (await GoogleSignin.getTokens()).accessToken;}
async function checked(response:Response){if(!response.ok){if(response.status===401||response.status===403)throw new Error('Google access expired or was denied. Reconnect Google, grant Drive backup permission and check that the Drive API is enabled.');throw new Error(`Google Drive request failed (${response.status}). Your local data is safe.`);}return response;}
async function driveRequest(accountId:string,url:string,options:RequestInit={}){const access=await token(accountId);const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),60000);try{return await checked(await fetch(url,{...options,signal:controller.signal,headers:{...options.headers,Authorization:`Bearer ${access}`}}));}finally{clearTimeout(timer);}}
export type DriveFile={id:string;name:string;createdTime:string;size?:string;appProperties?:{datasetId?:string;currency?:string}};
export async function googleBackup(password:string,accountId:string,captured?:Snapshot){
 const s=captured||await snapshot();const data=await encrypt(s,password);if(data.length>MAX_BYTES)throw new Error('Encrypted backup exceeds the 25 MB limit.');const boundary='moneywise_'+Date.now();
 const metadata={name:`walletway-${s.data.settings.currency}-${s.data.settings.datasetId}-${Date.now()}.json`,parents:['appDataFolder'],appProperties:{datasetId:s.data.settings.datasetId,currency:s.data.settings.currency,format:'moneywise-v1'}};
 const body=`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${data}\r\n--${boundary}--`;
 const created=await (await driveRequest(accountId,'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',{method:'POST',headers:{'Content-Type':`multipart/related; boundary=${boundary}`},body})).json();
 if(typeof created.id!=='string'||!created.id)throw new Error('Google did not return a backup file ID.');
 const remote=await (await driveRequest(accountId,`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(created.id)}?alt=media`)).text();
 if(remote!==data)throw new Error('Backup verification failed. The previous backups are unchanged.');
 return {createdAt:s.createdAt,id:String(created.id)};
}
export async function googleSnapshots(accountId:string){const q=encodeURIComponent("trashed = false and appProperties has { key='format' and value='moneywise-v1' }");const files:DriveFile[]=[];let next='';do{const result=await (await driveRequest(accountId,`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=nextPageToken,files(id,name,createdTime,size,appProperties)&orderBy=createdTime%20desc&pageSize=100${next?'&pageToken='+encodeURIComponent(next):''}`)).json();files.push(...(result.files||[]));next=result.nextPageToken||'';if(files.length>=1000)break;}while(next);return files;}
export async function readGoogleSnapshot(file:DriveFile,password:string,accountId:string){if(!file.size||!Number.isFinite(Number(file.size))||Number(file.size)>MAX_BYTES)throw new Error('Backup size is unavailable or exceeds the 25 MB limit.');const response=await driveRequest(accountId,`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`);return decrypt(await response.text(),password);}
export async function disconnectGoogle(){configure();await GoogleSignin.signOut();}
export async function safetySnapshot(){const backup=await snapshot();const path=`${RNFS.DocumentDirectoryPath}/pre-restore-${backup.data.settings.datasetId}-${Date.now()}.json`;await RNFS.writeFile(path,JSON.stringify(backup),'utf8');return path;}
export async function exportCSV(ledger:Snapshot['data']){
 const safe=(v:string)=>'"'+(/^[=+@\-\t\r]/.test(v)?"'"+v:v).replace(/"/g,'""')+'"';
 const rows=ledger.transactions.filter(t=>!t.deletedAt).map(t=>[t.date,t.time||'',t.type,(t.amount/100).toFixed(2),ledger.settings.currency,ledger.accounts.find(a=>a.id===t.accountId)?.name||'',ledger.accounts.find(a=>a.id===t.destinationId)?.name||'',ledger.categories.find(c=>c.id===t.categoryId)?.name||'',t.note,t.tags].map(safe).join(','));
 const path=`${RNFS.CachesDirectoryPath}/moneywise-report.csv`;await RNFS.writeFile(path,['Date,Time,Type,Amount,Currency,Account,Destination,Category,Note,Tags',...rows].join('\r\n'),'utf8');try{await Share.open({url:`file://${path}`,type:'text/csv',title:'Export financial data (unencrypted)',failOnCancel:false});}finally{await RNFS.unlink(path).catch(()=>{});}
}

export async function safetyCopies(){const files=await RNFS.readDir(RNFS.DocumentDirectoryPath);return files.filter(f=>f.name.startsWith('pre-restore-')&&f.name.endsWith('.json')).map(f=>({path:f.path,date:f.mtime?.toISOString()||f.name})).sort((a,b)=>b.date.localeCompare(a.date));}
export async function readSafetyCopy(path:string){if(!path.startsWith(RNFS.DocumentDirectoryPath+'/pre-restore-'))throw new Error('Invalid recovery path.');const stat=await RNFS.stat(path);if(Number(stat.size)>MAX_BYTES)throw new Error('Recovery copy exceeds the size limit.');return validateSnapshot(JSON.parse(await RNFS.readFile(path,'utf8')));}

// Password-free snapshots are private Google app-data, protected by account access.
// Keep the encrypted format APIs above for existing local and older archives.
export async function readSimpleGoogleSnapshot(file:DriveFile,accountId:string):Promise<Snapshot>{
 if(!file.size||!Number.isFinite(Number(file.size))||Number(file.size)>MAX_BYTES)throw new Error('Backup size is unavailable or exceeds the 25 MB limit.');
 const response=await driveRequest(accountId,`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`);
 const text=await response.text();if(text.length>MAX_BYTES)throw new Error('Backup exceeds the 25 MB limit.');
 try{return validateSnapshot(JSON.parse(text));}catch{throw new Error('This Google backup is damaged or needs a newer app. Your local data is unchanged.');}
}
