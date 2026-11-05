import React,{useState} from 'react';
import {Alert,Text} from 'react-native';
import {useApp} from './context';
import {Btn,Card,s} from './ui';
import * as Backup from './backup';
import * as Store from './store';
import type {Snapshot} from './models';

export function ExcelBackup(){
 const {ledger,act,busy}=useApp();
 const [preview,setPreview]=useState<Snapshot|null>(null);
 const [status,setStatus]=useState('');
 const currency=ledger.settings.currency;
 async function save(){
  setStatus('');let saved=false;
  const ok=await act(async()=>{saved=await Backup.exportExcel();});
  if(ok&&saved)setStatus('Excel backup saved.');
 }
 async function pick(){
  setPreview(null);setStatus('');
  await act(async()=>{
   const file=await Backup.importExcel();
   if(!file)return;
   if(file.data.settings.currency!==currency)throw new Error('Open the '+file.data.settings.currency+' ledger in Settings before importing this backup.');
   setPreview(file);
  });
 }
 function confirm(){
  if(!preview)return;
  const selected=preview;
  Alert.alert('Replace '+currency+' ledger?', 'Import replaces the records in this ledger with the records from the workbook.',[
   {text:'Cancel',style:'cancel'},
   {text:'Replace ledger',style:'destructive',onPress:async()=>{
    if(await act(async()=>{
     const current=await Store.loadLedger();
     if(current.settings.currency!==currency||current.settings.datasetId!==ledger.settings.datasetId)throw new Error('The active ledger changed. Open the workbook again.');
     await Backup.safetySnapshot();
     await Store.restore(selected);
    })){setPreview(null);Alert.alert('Import complete',currency+' ledger restored.');}
   }},
  ]);
 }
 return <Card>
  <Text accessibilityRole="header" style={s.section}>Excel backup</Text>
  <Text style={[s.muted,{marginVertical:12,lineHeight:22}]}>Save or restore the current {currency} ledger as a Walletway .xlsx file. The file contains financial data and is not password protected.</Text>
  <Btn title="Export Excel backup" icon="export" disabled={busy} onPress={save}/>
  <Btn title="Import Excel backup" secondary disabled={busy} onPress={pick}/>
  {busy&&<Text accessibilityLiveRegion="polite" style={s.muted}>Working…</Text>}
  {status!==''&&<Text accessibilityLiveRegion="polite" style={s.muted}>{status}</Text>}
  {preview&&<Card>
   <Text accessibilityRole="header" style={s.section}>Import preview</Text>
   <Text style={[s.text,{marginVertical:12,lineHeight:23}]}>{currency} ledger · {preview.data.transactions.filter(t=>!t.deletedAt).length} transactions · {preview.data.accounts.length} accounts{'\n'}Saved {new Date(preview.createdAt).toLocaleString()}</Text>
   <Btn title="Review replacement" danger disabled={busy} onPress={confirm}/>
   <Btn title="Cancel import" secondary disabled={busy} onPress={()=>setPreview(null)}/>
  </Card>}
 </Card>;
}
