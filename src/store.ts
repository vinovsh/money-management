import {NativeModules} from 'react-native';
import RNFS from 'react-native-fs';
import {dueOccurrences,nextOccurrence,validatePlanning} from './planning.cjs';
import type {EntryTemplate,RecurringRule,Debt} from './models';
import type {Ledger,Snapshot,Transaction,Account,Budget,Journal,Goal,Settings,Category} from './models';
import {CATEGORY_SEEDS, validateTransaction, validateSnapshot, reorderCategories,summary,accountBalance} from './domain.cjs';
const SQLite = require('react-native-sqlite-storage');
let database:any;let storeReady=false;
export function id():string{return NativeModules.LocalFeatures.uuid();}
function atomic(statements:{sql:string;args?:unknown[]}[]):Promise<void>{
 return new Promise((resolve,reject)=>database.transaction((tx:any)=>{for(const s of statements)tx.executeSql(s.sql,s.args||[]);},reject,resolve));
}
function read(sql:string,args:unknown[]=[]):Promise<any[]>{
 return new Promise((resolve,reject)=>database.executeSql(sql,args,(r:any)=>{const rows=[];for(let i=0;i<r.rows.length;i++)rows.push(r.rows.item(i));resolve(rows);},reject));
}
const tables=['accounts','categories','transactions','budgets','notes','goals'] as const;
function insert(table:string,item:any){return {sql:`INSERT OR REPLACE INTO ${table} (id,payload) VALUES (?,?)`,args:[item.id,JSON.stringify(item)]};}
export async function openStore():Promise<void>{
 if(database&&storeReady)return;
 if(!openingProfileOverride&&activeDatabaseName==='moneywise.db'&&await RNFS.exists(PROFILE_PATH)){const profiles=await ledgerProfiles();activeDatabaseName=profiles.active;}
 if(database){await new Promise<void>(resolve=>database.close(resolve,resolve));database=undefined;}
 await new Promise<void>((resolve,reject)=>{database=SQLite.openDatabase({name:activeDatabaseName,location:'default'},()=>resolve(),reject);});
 await read('PRAGMA foreign_keys = ON');
 await atomic([{sql:'CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)'},...tables.map(t=>({sql:`CREATE TABLE IF NOT EXISTS ${t} (id TEXT PRIMARY KEY, payload TEXT NOT NULL)`}))]);
 const schema=await read("SELECT value FROM metadata WHERE key='schema'");
 if(schema.length&&!['1','2'].includes(schema[0].value))throw new Error('This database requires a newer version of Walletway. Your data has been kept.');
 const settings=await read("SELECT value FROM metadata WHERE key='settings'");
 if(!settings.length){
 const defaults:Settings={currency:'USD',name:'Friend',onboarding:false,lastBackup:'',datasetId:id()};
 await atomic([{sql:"INSERT INTO metadata VALUES ('schema','1')"},{sql:"INSERT INTO metadata VALUES ('settings',?)",args:[JSON.stringify(defaults)]},insert('accounts',{id:'cash',name:'Cash',type:'Cash',opening:0,archived:false}),...CATEGORY_SEEDS.map(c=>insert('categories',c))]);
 }
 await atomic([{sql:'CREATE TABLE IF NOT EXISTS transaction_index (id TEXT PRIMARY KEY REFERENCES transactions(id) ON DELETE CASCADE, local_date TEXT NOT NULL, account_id TEXT NOT NULL REFERENCES accounts(id), category_id TEXT REFERENCES categories(id), updated_at TEXT NOT NULL)'},{sql:'CREATE INDEX IF NOT EXISTS tx_local_date ON transaction_index(local_date)'},{sql:'CREATE INDEX IF NOT EXISTS tx_account_date ON transaction_index(account_id,local_date)'},{sql:'CREATE INDEX IF NOT EXISTS tx_category_date ON transaction_index(category_id,local_date)'},{sql:'CREATE INDEX IF NOT EXISTS tx_updated ON transaction_index(updated_at)'},{sql:"INSERT OR REPLACE INTO metadata VALUES ('schema','2')"}]);
 const storedTransactions=await read('SELECT payload FROM transactions');
 if(storedTransactions.length)await atomic(storedTransactions.map(row=>indexTransaction(JSON.parse(row.payload))));
 const storedAccounts=await read('SELECT payload FROM accounts');
 const accounts=storedAccounts.map(a=>JSON.parse(a.payload));
 const defaults=[{id:'cash-default',name:'Cash',type:'Cash',opening:0,archived:false},{id:'card-default',name:'Card',type:'Card',opening:0,archived:false},{id:'bank-default',name:'Account',type:'Bank',opening:0,archived:false}];
 const missing=defaults.filter(a=>!accounts.some(item=>!item.archived&&item.type===a.type));
 if(missing.length)await atomic(missing.map(a=>insert('accounts',{...a,id:accounts.some(item=>item.id===a.id)?id():a.id})));storeReady=true;
}
// All tables are read inside one SQLite transaction for a consistent snapshot.
export function loadLedger():Promise<Ledger>{
 return new Promise((resolve,reject)=>{
 const data:any={};
 database.readTransaction((tx:any)=>{
 for(const t of tables)tx.executeSql(`SELECT payload FROM ${t}`,[],(_:any,r:any)=>{data[t]=[];for(let i=0;i<r.rows.length;i++)data[t].push(JSON.parse(r.rows.item(i).payload));});
 tx.executeSql("SELECT value FROM metadata WHERE key='settings'",[],(_:any,r:any)=>{data.settings=JSON.parse(r.rows.item(0).value);});
 },reject,()=>resolve(data));
 });
}
export async function saveTransaction(t:Transaction,ledger:Ledger){if((ledger.settings.debts||[]).some(d=>t.id==='debt:'+d.id||d.payments.some(p=>p.id===t.id)))throw new Error('This transfer belongs to a debt. Manage repayments under More → Debts.');validateTransaction(t,ledger.accounts,ledger.categories);const projected=[...ledger.transactions.filter(x=>x.id!==t.id),t];summary(projected);for(const account of ledger.accounts)accountBalance(account,projected);await atomic([insert('transactions',t),indexTransaction(t),{sql:"UPDATE metadata SET value=? WHERE key='settings'",args:[JSON.stringify({...ledger.settings,lastAccountId:t.accountId})]}]);}
export async function deleteTransaction(t:Transaction){const ledger=await loadLedger();if((ledger.settings.debts||[]).some(d=>t.id==='debt:'+d.id||d.payments.some(p=>p.id===t.id)))throw new Error('Debt transfers cannot be deleted from transaction history.');const updated={...t,deletedAt:new Date().toISOString(),updatedAt:new Date().toISOString()};await atomic([insert('transactions',updated),indexTransaction(updated)]);}
export async function undoTransaction(t:Transaction){const updated={...t,deletedAt:null,updatedAt:new Date().toISOString()};await atomic([insert('transactions',updated),indexTransaction(updated)]);}
export async function saveAccount(a:Account){const ledger=await loadLedger();if(ledger.accounts.some(existing=>existing.id===a.id&&existing.type==='Debt'))throw new Error('Manage receivable and liability accounts under More → Debts.');if(!a.name.trim()||a.name.length>80||!Number.isSafeInteger(a.opening))throw new Error('Enter a valid account name and balance.');await atomic([insert('accounts',a)]);}
export async function saveBudget(b:Budget){if(!b.name.trim()||b.amount<=0||!Number.isSafeInteger(b.amount))throw new Error('Enter a budget name and positive amount.');await atomic([insert('budgets',b)]);}
export async function saveNote(n:Journal){if(n.body.length>2000)throw new Error('Notes must be under 2,000 characters.');await atomic([insert('notes',n)]);}
export async function saveGoal(g:Goal){if(!g.name.trim()||g.target<=0||g.saved<0||!Number.isSafeInteger(g.target)||!Number.isSafeInteger(g.saved))throw new Error('Enter a valid goal and amounts.');await atomic([insert('goals',g)]);}
export async function saveSettings(s:Settings){const ledger=await loadLedger();validatePlanning(s,ledger.accounts,ledger.categories);await atomic([{sql:"UPDATE metadata SET value=? WHERE key='settings'",args:[JSON.stringify(s)]}]);}
export async function removeItem(table:'budgets'|'goals',itemId:string){await atomic([{sql:`DELETE FROM ${table} WHERE id=?`,args:[itemId]}]);}
export async function snapshot():Promise<Snapshot>{const original=await loadLedger();const data={...original,settings:{...original.settings,appLock:undefined,adsEnabled:undefined}};const attachments:Record<string,string>={};let total=0;for(const t of data.transactions){if(t.receipt&&!t.deletedAt){const stat=await RNFS.stat(t.receipt);total+=Number(stat.size);if(total>12*1024*1024)throw new Error('Receipts exceed the 12 MB backup limit. Remove large attachments before exporting.');attachments[t.id]=await RNFS.readFile(t.receipt,'base64');}}return {format:'moneywise-backup',version:2,createdAt:new Date().toISOString(),data,attachments};}
export async function restore(s:Snapshot){
 validateSnapshot(s);const current=await loadLedger();if(current.settings.currency!==s.data.settings.currency&&(activeDatabaseName!=='moneywise.db'||current.transactions.length||await RNFS.exists(PROFILE_PATH)))throw new Error('Open a '+s.data.settings.currency+' ledger before restoring this backup.');const created:string[]=[];const dir=RNFS.DocumentDirectoryPath+'/receipts';await RNFS.mkdir(dir);
 try{const transactions=await Promise.all(s.data.transactions.map(async t=>{const encoded=s.attachments?.[t.id];if(encoded){const path=dir+'/'+id()+'.jpg';await RNFS.writeFile(path,encoded,'base64');created.push(path);return {...t,receipt:path};}return {...t,receipt:undefined};}));
 const data={...s.data,transactions};
 await atomic([{sql:'DELETE FROM transaction_index'},...['transactions','accounts','categories','budgets','notes','goals'].map(t=>({sql:`DELETE FROM ${t}`})),...tables.flatMap(t=>data[t].map((item:any)=>insert(t,item))),...transactions.map(indexTransaction),{sql:"UPDATE metadata SET value=? WHERE key='settings'",args:[JSON.stringify({...data.settings,onboarding:true,appLock:!!current.settings.appLock,adsEnabled:!!current.settings.adsEnabled})]}]);
 }catch(error){await Promise.all(created.map(path=>RNFS.unlink(path).catch(()=>{})));throw error;}
}
function indexTransaction(t:Transaction){return {sql:'INSERT OR REPLACE INTO transaction_index VALUES (?,?,?,?,?)',args:[t.id,t.date,t.accountId,t.type==='transfer'?null:t.categoryId,t.updatedAt]};}
export async function saveTemplate(t:EntryTemplate,ledger:Ledger){validateTransaction({...t,date:new Date().toISOString().slice(0,10),createdAt:'',updatedAt:'',deletedAt:null},ledger.accounts,ledger.categories);if(!t.name.trim())throw new Error('Enter a template name.');await saveSettings({...ledger.settings,templates:[...(ledger.settings.templates||[]).filter(x=>x.id!==t.id),t]});}
export async function saveRule(r:RecurringRule,ledger:Ledger){const settings={...ledger.settings,recurring:[...(ledger.settings.recurring||[]).filter(x=>x.id!==r.id),r]};validatePlanning(settings,ledger.accounts,ledger.categories);await saveSettings(settings);}
export async function processRecurring(){const ledger=await loadLedger();const writes:{sql:string;args?:unknown[]}[]=[];let changed=false;const recurring=(ledger.settings.recurring||[]).map(r=>{if(r.mode!=='automatic')return r;const due=dueOccurrences(r);if(due.needsReview)return r;for(const date of due.dates){const transactionId='recurring:'+r.id+':'+date;if(!ledger.transactions.some(t=>t.id===transactionId)){const now=new Date().toISOString();const t:Transaction={...r,id:transactionId,date,time:ledger.settings.reminderTime||'20:00',recurrenceKey:transactionId,createdAt:now,updatedAt:now,deletedAt:null};validateTransaction(t,ledger.accounts,ledger.categories);writes.push(insert('transactions',t),indexTransaction(t));}}if(due.dates.length){changed=true;return {...r,nextDate:due.next};}return r;});if(changed){writes.push({sql:"UPDATE metadata SET value=? WHERE key='settings'",args:[JSON.stringify({...ledger.settings,recurring})]});await atomic(writes);}}
export async function recordOccurrence(rule:RecurringRule,date:string,ledger:Ledger,skip=false){if(date!==rule.nextDate)throw new Error('Review occurrences in date order.');const transactionId='recurring:'+rule.id+':'+date;const now=new Date().toISOString();const t:Transaction={...rule,id:transactionId,date,time:ledger.settings.reminderTime||'20:00',recurrenceKey:transactionId,createdAt:now,updatedAt:now,deletedAt:null};validateTransaction(t,ledger.accounts,ledger.categories);const settings={...ledger.settings,recurring:(ledger.settings.recurring||[]).map(r=>r.id===rule.id?{...r,nextDate:nextOccurrence(date,r.interval,r.anchorDay)}:r)};await atomic([...(!skip&&!ledger.transactions.some(t=>t.id===transactionId)?[insert('transactions',t),indexTransaction(t)]:[]),{sql:"UPDATE metadata SET value=? WHERE key='settings'",args:[JSON.stringify(settings)]}]);}
export async function saveDebt(d:Debt,ledger:Ledger){if(!d.name.trim()||!Number.isSafeInteger(d.amount)||d.amount<=0)throw new Error('Enter a name and positive principal.');const debtAccount:Account={id:d.debtAccountId,name:d.name+' · '+(d.direction==='lent'?'Receivable':'Liability'),type:'Debt',opening:0,archived:false};const now=new Date().toISOString();const t:Transaction={id:'debt:'+d.id,type:'transfer',amount:d.amount,date:d.date,accountId:d.direction==='lent'?d.accountId:d.debtAccountId,destinationId:d.direction==='lent'?d.debtAccountId:d.accountId,categoryId:'',note:d.name,tags:'debt',createdAt:now,updatedAt:now,deletedAt:null};validateTransaction(t,[...ledger.accounts,debtAccount],ledger.categories);const settings={...ledger.settings,debts:[...ledger.settings.debts||[],d]};validatePlanning(settings,[...ledger.accounts,debtAccount],ledger.categories);await atomic([insert('accounts',debtAccount),insert('transactions',t),indexTransaction(t),{sql:"UPDATE metadata SET value=? WHERE key='settings'",args:[JSON.stringify(settings)]}]);}
export async function repayDebt(debt:Debt,amount:number,date:string,ledger:Ledger){const remaining=debt.amount-debt.payments.reduce((n,p)=>n+p.amount,0);if(!Number.isSafeInteger(amount)||amount<=0||amount>remaining)throw new Error('Repayment must be positive and no greater than the remaining balance.');const payment={id:id(),amount,date};const now=new Date().toISOString();const t:Transaction={id:payment.id,type:'transfer',amount,date,accountId:debt.direction==='lent'?debt.debtAccountId:debt.accountId,destinationId:debt.direction==='lent'?debt.accountId:debt.debtAccountId,categoryId:'',note:debt.name+' repayment',tags:'debt',createdAt:now,updatedAt:now,deletedAt:null};validateTransaction(t,ledger.accounts,ledger.categories);const settings={...ledger.settings,debts:(ledger.settings.debts||[]).map(d=>d.id===debt.id?{...d,payments:[...d.payments,payment]}:d)};await atomic([insert('transactions',t),indexTransaction(t),{sql:"UPDATE metadata SET value=? WHERE key='settings'",args:[JSON.stringify(settings)]}]);}
export async function contributeGoal(goal:Goal,amount:number,date:string,ledger:Ledger){if(!Number.isSafeInteger(amount)||!amount||!Number.isSafeInteger(goal.saved+amount)||goal.saved+amount<0)throw new Error('Enter a valid allocation or withdrawal.');const settings={...ledger.settings,goalContributions:[...ledger.settings.goalContributions||[],{id:id(),goalId:goal.id,amount,date}]};await atomic([insert('goals',{...goal,saved:goal.saved+amount}),{sql:"UPDATE metadata SET value=? WHERE key='settings'",args:[JSON.stringify(settings)]}]);}
export async function deleteLocalData(){const ledger=await loadLedger();await atomic([{sql:'DELETE FROM transaction_index'},...['transactions','accounts','categories','budgets','notes','goals'].map(t=>({sql:`DELETE FROM ${t}`})),{sql:'DELETE FROM metadata'}]);const data=ledger.transactions.map(t=>t.receipt).filter((p):p is string=>!!p);await Promise.all(data.map(p=>RNFS.unlink(p).catch(()=>{})));const files=await RNFS.readDir(RNFS.DocumentDirectoryPath);await Promise.all(files.filter(f=>f.name.startsWith('pre-restore-'+ledger.settings.datasetId+'-')).map(f=>RNFS.unlink(f.path).catch(()=>{})));await new Promise<void>((resolve,reject)=>database.close(resolve,reject));database=undefined;storeReady=false;await openStore();const fresh=await loadLedger();await saveSettings({...fresh.settings,currency:ledger.settings.currency});}

export async function saveCategory(c:Category,ledger:Ledger){
 const name=c.name.trim();
 if(!name||name.length>40)throw new Error('Enter a category name under 40 characters.');
 if(!['expense','income'].includes(c.type)||!/^#[0-9a-f]{6}$/i.test(c.color))throw new Error('Choose a valid category type and color.');
 const existing=ledger.categories.find(item=>item.id===c.id);
 if(existing&&existing.type!==c.type)throw new Error('An existing category must keep its transaction type.');
 if(ledger.categories.some(item=>item.id!==c.id&&item.type===c.type&&item.name.toLocaleLowerCase()===name.toLocaleLowerCase()))throw new Error('This category name already exists.');
 await atomic([insert('categories',{...c,name,order:existing?.order??c.order??Math.max(-1,...ledger.categories.filter(item=>item.type===c.type).map(item=>item.order??ledger.categories.indexOf(item)))+1})]);
}

export async function saveCategoryOrder(ids:string[],ledger:Ledger){await atomic(reorderCategories(ledger.categories,ids).filter(c=>ids.includes(c.id)).map(c=>insert('categories',c)));}

const PROFILE_PATH=RNFS.DocumentDirectoryPath+'/ledger-profiles.json';
type Profiles={active:string;items:{id:string;currency:string;name:string}[]};
let activeDatabaseName='moneywise.db';let openingProfileOverride=false;
export async function ledgerProfiles():Promise<Profiles>{if(await RNFS.exists(PROFILE_PATH)){const result=JSON.parse(await RNFS.readFile(PROFILE_PATH,'utf8'));if(!Array.isArray(result.items)||!result.items.some((p:any)=>p.id===result.active)||result.items.some((p:any)=>!/^moneywise(?:-[A-Z]{3})?\.db$/.test(p.id)||!['USD','INR','EUR','GBP','AUD','CAD'].includes(p.currency)))throw new Error('Ledger selection needs recovery. Your databases are preserved.');return result;}const current=database?await loadLedger():null;return {active:'moneywise.db',items:[{id:'moneywise.db',currency:current?.settings.currency||'USD',name:'Main ledger'}]};}
export async function switchLedger(currency:string){if(!['USD','INR','EUR','GBP','AUD','CAD'].includes(currency))throw new Error('Unsupported ledger currency.');const profiles=await ledgerProfiles();let chosen=profiles.items.find(p=>p.currency===currency);if(!chosen){chosen={id:'moneywise-'+currency+'.db',currency,name:currency+' ledger'};profiles.items.push(chosen);}const old=activeDatabaseName;await new Promise<void>((resolve,reject)=>database.close(resolve,reject));database=undefined;storeReady=false;activeDatabaseName=chosen.id;openingProfileOverride=true;try{await openStore();const ledger=await loadLedger();if(!ledger.settings.onboarding)await saveSettings({...ledger.settings,currency,onboarding:true,locale:'en-IN'});profiles.active=chosen.id;const temp=PROFILE_PATH+'.tmp';await RNFS.writeFile(temp,JSON.stringify(profiles),'utf8');await RNFS.moveFile(temp,PROFILE_PATH);}catch(error){activeDatabaseName=old;database=undefined;storeReady=false;await openStore();throw error;}finally{openingProfileOverride=false;}}
