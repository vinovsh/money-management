import {NativeModules} from 'react-native';
import * as Backup from './backup';
import * as Store from './store';
import {CATEGORY_SEEDS,validateSnapshot} from './domain.cjs';
import type {Ledger,Snapshot} from './models';
const native=NativeModules.LocalFeatures;
type Status={accountId:string;email:string;ready:boolean;registered:boolean;lastBackup:string;error:string;nextBackup:string};
let running=false;let message='';const listeners=new Set<()=>void>();
export const subscribe=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};};
const emit=()=>listeners.forEach(fn=>fn());
export const syncStatus=()=>({running,message});
async function exclusive<T>(fn:()=>Promise<T>){if(running)throw new Error('Please wait for the Google backup operation to finish.');running=true;message='';emit();try{return await fn();}catch(e){message=e instanceof Error?e.message:'Google backup failed. Your local data is safe.';throw e;}finally{running=false;emit();}}
export async function state(currency:string):Promise<Status>{return JSON.parse(await native.googleBackupStatus(currency));}
export async function getAccount(currency:string){const s=await state(currency);return s.accountId?{id:s.accountId,email:s.email}:null;}
export function hasLocalData(ledger:Ledger){return !!(ledger.transactions.length||ledger.budgets.length||ledger.goals.length||ledger.notes.length||ledger.accounts.some(a=>a.opening!==0||!['cash','cash-default','card-default','bank-default'].includes(a.id))||ledger.categories.some(c=>{const seed=CATEGORY_SEEDS.find((s:{id:string})=>s.id===c.id);return !seed||seed.name!==c.name||seed.icon!==c.icon;})||(ledger.settings.templates||[]).length||(ledger.settings.recurring||[]).length||(ledger.settings.debts||[]).length);}
type Remote={fileId:string;revision:string;bundle:{format:string;version:number;updatedAt:string;activeCurrency:string;ledgers:Record<string,Snapshot>;legacyArchives:unknown[]}};
export async function connect(ledger:Ledger){return exclusive(async()=>{
 const a=await Backup.connectGoogle();await native.googleBackupConfigure(a.id,a.email,Store.activeLedgerDatabase(),ledger.settings.currency);
 const remote:Remote=JSON.parse(await native.googleSyncRead(a.id));const bundle=remote.bundle;
 if(bundle?.format!=='walletway-google-sync'||bundle.version!==1||!bundle.ledgers||typeof bundle.ledgers!=='object'||Array.isArray(bundle.ledgers))throw new Error('Unsupported Google sync data. No local records were changed.');
 const currencies=Object.keys(bundle.ledgers);
 for(const currency of currencies){validateSnapshot(bundle.ledgers[currency]);if(!['USD','INR','EUR','GBP','AUD','CAD'].includes(currency)||bundle.ledgers[currency].data.settings.currency!==currency)throw new Error('Google ledger currency does not match. No local records were changed.');}
 if(!currencies.length&&bundle.legacyArchives?.length&&!hasLocalData(ledger))throw new Error('This account only has an older encrypted archive. Connect from the phone that still has your records to migrate them. The archive is preserved.');
 const original=ledger.settings.currency;const saved:Record<string,Snapshot>={};let restored=false;
 if(currencies.length){
  const profiles=await Store.ledgerProfiles();
  try{
   // Validate every cloud ledger first, then protect every existing ledger before replacing any.
   for(const profile of profiles.items){await Store.switchLedger(profile.currency);saved[profile.currency]=await Store.snapshot();await Backup.safetySnapshot();}
   const current=await Backup.currentGoogle();if(!current||current.id!==a.id)throw new Error('Google account changed. Connect again.');
   for(const currency of currencies){await Store.switchLedger(currency);await Store.restore(bundle.ledgers[currency]);}
   restored=true;
  }catch(error){
   for(const [currency,snapshot] of Object.entries(saved)){await Store.switchLedger(currency);await Store.restore(snapshot);}
   await Store.switchLedger(original);throw error;
  }
 }
 await Store.switchLedger(currencies.includes(bundle.activeCurrency)?bundle.activeCurrency:original);
 const profiles=await Store.ledgerProfiles();const paths=Object.fromEntries(profiles.items.map(p=>[p.currency,p.id]));
 await native.googleSyncRegister(JSON.stringify(paths),(await Store.loadLedger()).settings.currency);
 await native.googleSyncFinish(remote.fileId,remote.revision,bundle.updatedAt||'');
 await native.googleBackupRun();return {restored};
 });}
export async function disconnect(){return exclusive(async()=>{await native.googleBackupDisconnect();await Backup.disconnectGoogle();});}
export async function automatic(ledger:Ledger){try{if(running)return;const info=await state(ledger.settings.currency);if(info.accountId){const profiles=await Store.ledgerProfiles();await native.googleSyncRegister(JSON.stringify(Object.fromEntries(profiles.items.map(p=>[p.currency,p.id]))),ledger.settings.currency);}await native.googleBackupReschedule();}catch{/* Local transactions do not depend on network availability. */}}
