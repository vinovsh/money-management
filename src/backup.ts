import {NativeModules} from 'react-native';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import {snapshot} from './store';
import {validateSnapshot} from './domain.cjs';
import type {Snapshot} from './models';
const MAX_BYTES=25*1024*1024;

export async function exportExcel():Promise<boolean>{
 const data=await snapshot();
 const name='Walletway-'+data.data.settings.currency+'-'+data.createdAt.replace(/[:.]/g,'-')+'.xlsx';
 return (await NativeModules.LocalFeatures.saveExcelBackup(name,JSON.stringify(data)))===true;
}
export async function importExcel():Promise<Snapshot|null>{
 const text=await NativeModules.LocalFeatures.openExcelBackup();
 if(text===null)return null;
 if(typeof text!=='string'||text.length>MAX_BYTES)throw new Error('Backup exceeds the import size limit.');
 try{return validateSnapshot(JSON.parse(text));}
 catch{throw new Error('The Walletway backup is damaged or requires a newer version. No data was changed.');}
}
export async function safetySnapshot(){const backup=await snapshot();const path=`${RNFS.DocumentDirectoryPath}/pre-restore-${backup.data.settings.datasetId}-${Date.now()}.json`;await RNFS.writeFile(path,JSON.stringify(backup),'utf8');return path;}
export async function exportCSV(ledger:Snapshot['data']){
 const safe=(v:string)=>'"'+(/^[=+@\-\t\r]/.test(v)?"'"+v:v).replace(/"/g,'""')+'"';
 const rows=ledger.transactions.filter(t=>!t.deletedAt).map(t=>[t.date,t.time||'',t.type,(t.amount/100).toFixed(2),ledger.settings.currency,ledger.accounts.find(a=>a.id===t.accountId)?.name||'',ledger.accounts.find(a=>a.id===t.destinationId)?.name||'',ledger.categories.find(c=>c.id===t.categoryId)?.name||'',t.note,t.tags].map(safe).join(','));
 const path=`${RNFS.CachesDirectoryPath}/moneywise-report.csv`;await RNFS.writeFile(path,['Date,Time,Type,Amount,Currency,Account,Destination,Category,Note,Tags',...rows].join('\r\n'),'utf8');try{await Share.open({url:`file://${path}`,type:'text/csv',title:'Export financial data (unencrypted)',failOnCancel:false});}finally{await RNFS.unlink(path).catch(()=>{});}
}

export async function safetyCopies(){const files=await RNFS.readDir(RNFS.DocumentDirectoryPath);return files.filter(f=>f.name.startsWith('pre-restore-')&&f.name.endsWith('.json')).map(f=>({path:f.path,date:f.mtime?.toISOString()||f.name})).sort((a,b)=>b.date.localeCompare(a.date));}
export async function readSafetyCopy(path:string){if(!path.startsWith(RNFS.DocumentDirectoryPath+'/pre-restore-'))throw new Error('Invalid recovery path.');const stat=await RNFS.stat(path);if(Number(stat.size)>MAX_BYTES)throw new Error('Recovery copy exceeds the size limit.');return validateSnapshot(JSON.parse(await RNFS.readFile(path,'utf8')));}
