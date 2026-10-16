import {NativeModules} from 'react-native';
import * as Backup from './backup';
import * as Store from './store';
import {CATEGORY_SEEDS} from './domain.cjs';
import type {Ledger,Snapshot} from './models';
const native=NativeModules.LocalFeatures;
type Status={accountId:string;email:string;ready:boolean;registered:boolean;lastBackup:string;error:string;nextBackup:string};
export type Selection={snapshot:Snapshot;accountId:string;fileId:string};
let running=false;let message='';const listeners=new Set<()=>void>();
export const subscribe=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};};
const emit=()=>listeners.forEach(fn=>fn());
export const syncStatus=()=>({running,message});
async function exclusive<T>(fn:()=>Promise<T>){if(running)throw new Error('Please wait for the Google backup operation to finish.');running=true;message='';emit();try{return await fn();}catch(e){message=e instanceof Error?e.message:'Google backup failed. Your local data is safe.';throw e;}finally{running=false;emit();}}
export async function state(currency:string):Promise<Status>{return JSON.parse(await native.googleBackupStatus(currency));}
export async function getAccount(currency:string){const s=await state(currency);return s.accountId?{id:s.accountId,email:s.email}:null;}
export function hasLocalData(ledger:Ledger){return !!(ledger.transactions.length||ledger.budgets.length||ledger.goals.length||ledger.notes.length||ledger.accounts.some(a=>a.opening!==0||!['cash','cash-default','card-default','bank-default'].includes(a.id))||ledger.categories.some(c=>{const seed=CATEGORY_SEEDS.find((s:{id:string})=>s.id===c.id);return !seed||seed.name!==c.name||seed.icon!==c.icon;})||(ledger.settings.templates||[]).length||(ledger.settings.recurring||[]).length||(ledger.settings.debts||[]).length);}
async function files(accountId:string,currency:string):Promise<Backup.DriveFile[]>{return JSON.parse(await native.googleBackupList(accountId,currency));}
async function restoreSelected(selected:Selection){const a=await Backup.currentGoogle();if(!a||a.id!==selected.accountId)throw new Error('Google account changed. Connect again.');const ledger=await Store.loadLedger();if(ledger.settings.currency!==selected.snapshot.data.settings.currency)throw new Error('Switch to the backup currency before restoring.');await native.googleBackupPause(ledger.settings.currency);await Backup.safetySnapshot();await Store.restore(selected.snapshot);await native.googleBackupAccept(ledger.settings.currency,selected.fileId,selected.snapshot.createdAt);}
export async function connect(ledger:Ledger){return exclusive(async()=>{
 const a=await Backup.connectGoogle();await native.googleBackupConfigure(a.id,a.email,Store.activeLedgerDatabase(),ledger.settings.currency);
 const found=(await files(a.id,ledger.settings.currency)).find(f=>f.appProperties?.currency===ledger.settings.currency);
 if(found){await native.googleBackupPause(ledger.settings.currency);const selected={snapshot:await Backup.readSimpleGoogleSnapshot(found,a.id),accountId:a.id,fileId:found.id};
  if(!hasLocalData(await Store.loadLedger())){await restoreSelected(selected);return {restored:true,selection:null,legacy:false};}
  return {restored:false,selection:selected,legacy:false};
 }
 // Old passphrase archives cannot be decrypted on a new device without their key.
 const legacy=(await Backup.googleSnapshots(a.id)).some(f=>f.appProperties?.currency===ledger.settings.currency||(!f.appProperties?.currency&&f.name.includes(ledger.settings.datasetId)));
 if(legacy){await native.googleBackupPause(ledger.settings.currency);return {restored:false,selection:null,legacy:true};}
 await native.googleBackupAccept(ledger.settings.currency,'','');await native.googleBackupRun();return {restored:false,selection:null,legacy:false};
 });}
export async function discover(ledger:Ledger){return exclusive(async()=>{const s=await state(ledger.settings.currency);if(!s.accountId)return null;const found=(await files(s.accountId,ledger.settings.currency)).find(f=>f.appProperties?.currency===ledger.settings.currency);if(!found)return null;return {snapshot:await Backup.readSimpleGoogleSnapshot(found,s.accountId),accountId:s.accountId,fileId:found.id};});}
export async function restore(selected:Selection){return exclusive(()=>restoreSelected(selected));}
export async function keepLocal(ledger:Ledger,selected:Selection|null){return exclusive(async()=>{const s=await state(ledger.settings.currency);if(!s.accountId)throw new Error('Connect Google first.');if(selected&&selected.accountId!==s.accountId)throw new Error('Google account changed. Connect again.');if(!selected&&(await files(s.accountId,ledger.settings.currency)).some(f=>f.appProperties?.currency===ledger.settings.currency))throw new Error('A Google backup exists. Tap Restore from Google to review it first.');await native.googleBackupAccept(ledger.settings.currency,selected?.fileId||'',selected?.snapshot.createdAt||'');await native.googleBackupRun();});}
export async function upload(){return exclusive(()=>native.googleBackupRun());}
export async function disconnect(){return exclusive(async()=>{await native.googleBackupDisconnect();await Backup.disconnectGoogle();});}
export async function automatic(_ledger:Ledger){try{await native.googleBackupReschedule();}catch{/* Existing local transactions never depend on scheduling. */}}
