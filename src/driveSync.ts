import {NativeModules} from 'react-native';
import * as Backup from './backup';
import * as Store from './store';
import type {Ledger} from './models';
const AES=require('react-native-aes-crypto').default;
const native=NativeModules.LocalFeatures;
type RecordState={auto:boolean;passphrase?:string;lastBackup?:string;hash?:string;remoteId?:string};
let account:Backup.GoogleAccount|null=null;let loaded=false;let running=false;
let message='';const listeners=new Set<()=>void>();
export const subscribe=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};};
const emit=()=>listeners.forEach(fn=>fn());
export const syncStatus=()=>({running,message});
async function exclusive<T>(fn:()=>Promise<T>){if(running)throw new Error('A Google backup operation is already running. Please wait.');running=true;message='';emit();try{return await fn();}catch(e){message=e instanceof Error?e.message:'Google backup failed. Local data is safe.';throw e;}finally{running=false;emit();}}
const key=(a:string,d:string)=>'drive:'+a+':'+d;
async function read(a:string,d:string):Promise<RecordState>{const raw=await native.driveSecretGet(key(a,d));return raw?JSON.parse(raw):{auto:false};}
async function write(a:string,d:string,value:RecordState){const indexKey='drive-index:'+a;const raw=await native.driveSecretGet(indexKey);const ids:string[]=raw?JSON.parse(raw):[];if(!ids.includes(d))await native.driveSecretSet(indexKey,JSON.stringify([...ids,d]));await native.driveSecretSet(key(a,d),JSON.stringify(value));emit();}
export async function getAccount(){if(!loaded){account=await Backup.currentGoogle();loaded=true;}return account;}
export async function connect(){return exclusive(async()=>{account=await Backup.connectGoogle();loaded=true;return account;});}
export async function state(datasetId:string){const a=await getAccount();const value=a?await read(a.id,datasetId):{auto:false};return {account:a,auto:value.auto,lastBackup:value.lastBackup};}
export async function disconnect(){return exclusive(async()=>{const a=await getAccount();if(a){const raw=await native.driveSecretGet('drive-index:'+a.id);for(const d of raw?JSON.parse(raw):[])await native.driveSecretSet(key(a.id,d),null);await native.driveSecretSet('drive-index:'+a.id,null);}await Backup.disconnectGoogle();account=null;loaded=true;emit();});}
export async function disableAuto(datasetId:string){return exclusive(async()=>{const a=await getAccount();if(!a)return;const old=await read(a.id,datasetId);await write(a.id,datasetId,{...old,auto:false,passphrase:undefined});});}
export async function upload(ledger:Ledger,password?:string,auto?:boolean){return exclusive(async()=>{
 const a=await getAccount();if(!a){if(password)throw new Error('Connect your Google account first.');return;}
 const datasetId=ledger.settings.datasetId;const old=await read(a.id,datasetId);const automatic=password===undefined;
 if(automatic&&!old.auto)return;
 const pass=password??old.passphrase;if(!pass||pass.length<12)throw new Error('Enter your recovery passphrase (at least 12 characters).');
 const captured=await Store.snapshot();if(captured.data.settings.datasetId!==datasetId)throw new Error('The selected ledger changed. Try again.');
 // Ignore backup timestamps; do not generate another snapshot merely for metadata.
 const data={...captured.data,settings:{...captured.data.settings,lastBackup:''}};
 const hash=await AES.sha256(JSON.stringify({data,attachments:captured.attachments}));
 if(automatic&&hash===old.hash)return;
 const files=await Backup.googleSnapshots(a.id);const latest=files.find(f=>f.appProperties?.datasetId===datasetId);
 if(old.remoteId&&latest&&latest.id!==old.remoteId)throw new Error('This ledger has a newer Google backup from another device. Automatic backup is paused. Review and restore that backup, or reconnect before creating a separate snapshot.');
 if(latest&&!old.remoteId)await Backup.readGoogleSnapshot(latest,pass,a.id);
 const result=await Backup.googleBackup(pass,a.id,captured);const enabled=auto??old.auto;
 await write(a.id,datasetId,{auto:enabled,passphrase:enabled?pass:undefined,lastBackup:result.createdAt,hash,remoteId:result.id});
 });}
export async function list(){return exclusive(async()=>{const a=await getAccount();if(!a)throw new Error('Connect Google first.');return Backup.googleSnapshots(a.id);});}
export async function preview(file:Backup.DriveFile,pass:string){return exclusive(async()=>{const a=await getAccount();if(!a)throw new Error('Connect Google first.');return {snapshot:await Backup.readGoogleSnapshot(file,pass,a.id),accountId:a.id,fileId:file.id};});}
export async function restore(selection:{snapshot:import('./models').Snapshot;accountId:string;fileId:string}){return exclusive(async()=>{const a=await getAccount();if(!a||a.id!==selection.accountId)throw new Error('Google account changed. Preview the backup again.');const current=await Store.loadLedger();if(current.settings.currency!==selection.snapshot.data.settings.currency)throw new Error('Switch to the backup currency ledger before restoring.');await disableRecord(a.id,current.settings.datasetId);await Backup.safetySnapshot();await Store.restore(selection.snapshot);await disableRecord(a.id,selection.snapshot.data.settings.datasetId);});}
async function disableRecord(a:string,d:string){const old=await read(a,d);await write(a,d,{...old,auto:false,passphrase:undefined,remoteId:undefined,hash:undefined});}
export async function automatic(ledger:Ledger){if(running)return;try{await upload(ledger);}catch{/* Surface the error in Settings; local writes never depend on the network. */}}
