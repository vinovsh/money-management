import {NativeModules,PermissionsAndroid,Platform} from 'react-native';
import Share from 'react-native-share';
import RNFS from 'react-native-fs';
import type {Ledger,Transaction} from './models';
import {budgetUsage} from './planning.cjs';
import {today,summary,formatMoney} from './domain.cjs';
const native=NativeModules.LocalFeatures;
export async function requestNotifications(){if(Platform.OS!=='android')return false;if(Number(Platform.Version)>=33){const result=await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);if(result!==PermissionsAndroid.RESULTS.GRANTED)return false;}return native.notificationStatus() as Promise<boolean>;}
export async function syncReminders(ledger:Ledger){
 if(!native)return;const settings=ledger.settings;const alarms:{id:string;daily?:boolean;hour?:number;minute?:number;at?:number;title:string;body:string}[]=[];
 if(settings.eveningReminder){const [hour,minute]=(settings.reminderTime||'20:00').split(':').map(Number);alarms.push({id:'evening',daily:true,hour,minute,title:'Walletway · Evening reminder',body:'Take a moment to record today’s income and spending.'});}
 for(const r of settings.recurring||[]){if(r.enabled&&r.nextDate>=today()){const at=new Date(r.nextDate+'T'+(settings.reminderTime||'20:00')+':00').getTime();if(at>Date.now())alarms.push({id:'bill-'+r.id,at,title:'Walletway · Scheduled item',body:'Open Walletway to review your scheduled entries.'});}}
 for(const d of settings.debts||[]){if(d.payments.reduce((n,p)=>n+p.amount,0)<d.amount){const at=new Date(d.dueDate+'T'+(settings.reminderTime||'20:00')+':00').getTime();if(at>Date.now())alarms.push({id:'debt-'+d.id,at,title:'Walletway · Repayment reminder',body:'A repayment is due. Open Walletway to review it.'});}}
 const limited=[...alarms.filter(a=>a.daily),...alarms.filter(a=>!a.daily).sort((a,b)=>(a.at||0)-(b.at||0)).slice(0,63)];await native.schedule(JSON.stringify(limited));
 if(settings.budgetAlerts)for(const b of ledger.budgets){if(b.alerts===false)continue;const u=budgetUsage(b,ledger.transactions,today(),settings.weekStart);for(const threshold of [b.warning??80,100])if(u.ratio*100>=threshold)await native.notifyOnce(`budget-${settings.datasetId}-${b.id}-${u.from}-${threshold}`,'Walletway · Budget alert',threshold===100?'A budget has reached its limit. Open Walletway to review it.':'A budget is approaching its limit. Open Walletway to review it.');}
}
export async function pickReceipt():Promise<string|null>{return native.pickReceipt();}
export async function authenticate():Promise<boolean>{return native.authenticate();}
export async function clearReminders(){if(native)await native.clear();}
export async function pdfReport(ledger:Ledger,transactions:Transaction[],from:string,to:string){const total=summary(transactions);const currency=ledger.settings.currency;const lines=[`${from} to ${to}`,`Income: ${formatMoney(total.income,currency)}`,`Net spending: ${formatMoney(total.spending,currency)}`,`Net cash flow: ${formatMoney(total.net,currency)}`,'',...transactions.map(t=>`${t.date} ${t.time||''} | ${t.type} | ${formatMoney(t.amount,currency)} | ${ledger.categories.find(c=>c.id===t.categoryId)?.name||'Transfer'} | ${t.note}`)];const path=await native.exportPDF('Walletway · Money report',lines);try{await Share.open({url:'file://'+path,type:'application/pdf',title:'Export financial report (unencrypted)',failOnCancel:false});}finally{await RNFS.unlink(path).catch(()=>{});}}
