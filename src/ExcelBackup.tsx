import React from 'react';
import {Alert,Text} from 'react-native';
import {useApp} from './context';
import {Btn,Card,s} from './ui';
import * as Backup from './backup';
import * as Store from './store';

export function ExcelBackup(){
 const {ledger,act,busy,excelDraft,setExcelDraft}=useApp();
 const {currency,datasetId:ledgerId}=ledger.settings;
 const draft=excelDraft?.ledgerId===ledgerId&&excelDraft.currency===currency?excelDraft:null;
 const preview=draft?.preview??null;
 const status=draft?.status??'';
 async function save(){
  setExcelDraft(null);
  await act(async()=>{
   if(await Backup.exportExcel())setExcelDraft({ledgerId,currency,preview:null,status:'Excel backup saved.'});
  });
 }
 async function pick(){
  setExcelDraft(null);
  await act(async()=>{
   const file=await Backup.importExcel();
   if(!file)return;
   if(file.data.settings.currency!==currency)throw new Error('Open the '+file.data.settings.currency+' ledger in Settings before importing this backup.');
   setExcelDraft({ledgerId,currency,preview:file,status:''});
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
     if(current.settings.currency!==currency||current.settings.datasetId!==ledgerId)throw new Error('The active ledger changed. Open the workbook again.');
     await Backup.safetySnapshot();
     await Store.restore(selected);
    })){setExcelDraft(null);Alert.alert('Import complete',currency+' ledger restored.');}
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
   <Btn title="Cancel import" secondary disabled={busy} onPress={()=>setExcelDraft(null)}/>
  </Card>}
 </Card>;
}
