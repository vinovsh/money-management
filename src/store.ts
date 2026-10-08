import type {Ledger,Snapshot,Transaction,Account,Budget,Journal,Goal,Settings,Category} from './models';
import {CATEGORY_SEEDS, validateTransaction, validateSnapshot} from './domain.cjs';
const SQLite = require('react-native-sqlite-storage');
let database:any;
export function id():string{return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,12)}-${Math.random().toString(36).slice(2,8)}`;}
function atomic(statements:{sql:string;args?:unknown[]}[]):Promise<void>{
 return new Promise((resolve,reject)=>database.transaction((tx:any)=>{for(const s of statements)tx.executeSql(s.sql,s.args||[]);},reject,resolve));
}
function read(sql:string,args:unknown[]=[]):Promise<any[]>{
 return new Promise((resolve,reject)=>database.executeSql(sql,args,(r:any)=>{const rows=[];for(let i=0;i<r.rows.length;i++)rows.push(r.rows.item(i));resolve(rows);},reject));
}
const tables=['accounts','categories','transactions','budgets','notes','goals'] as const;
function insert(table:string,item:any){return {sql:`INSERT OR REPLACE INTO ${table} (id,payload) VALUES (?,?)`,args:[item.id,JSON.stringify(item)]};}
export async function openStore():Promise<void>{
 await new Promise<void>((resolve,reject)=>{database=SQLite.openDatabase({name:'moneywise.db',location:'default'},()=>resolve(),reject);});
 await atomic([{sql:'CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)'},...tables.map(t=>({sql:`CREATE TABLE IF NOT EXISTS ${t} (id TEXT PRIMARY KEY, payload TEXT NOT NULL)`}))]);
 const schema=await read("SELECT value FROM metadata WHERE key='schema'");
 if(schema.length&&schema[0].value!=='1')throw new Error('This database requires a newer version of Moneywise. Your data has been kept.');
 const settings=await read("SELECT value FROM metadata WHERE key='settings'");
 if(!settings.length){
 const defaults:Settings={currency:'USD',name:'Friend',onboarding:false,lastBackup:'',datasetId:id()};
 await atomic([{sql:"INSERT INTO metadata VALUES ('schema','1')"},{sql:"INSERT INTO metadata VALUES ('settings',?)",args:[JSON.stringify(defaults)]},insert('accounts',{id:'cash',name:'Cash',type:'Cash',opening:0,archived:false}),...CATEGORY_SEEDS.map(c=>insert('categories',c))]);
 }
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
export async function saveTransaction(t:Transaction,ledger:Ledger){validateTransaction(t,ledger.accounts,ledger.categories);await atomic([insert('transactions',t)]);}
export async function deleteTransaction(t:Transaction){await atomic([insert('transactions',{...t,deletedAt:new Date().toISOString(),updatedAt:new Date().toISOString()})]);}
export async function undoTransaction(t:Transaction){await atomic([insert('transactions',{...t,deletedAt:null,updatedAt:new Date().toISOString()})]);}
export async function saveAccount(a:Account){if(!a.name.trim()||a.name.length>80||!Number.isSafeInteger(a.opening))throw new Error('Enter a valid account name and balance.');await atomic([insert('accounts',a)]);}
export async function saveBudget(b:Budget){if(!b.name.trim()||b.amount<=0||!Number.isSafeInteger(b.amount))throw new Error('Enter a budget name and positive amount.');await atomic([insert('budgets',b)]);}
export async function saveNote(n:Journal){if(n.body.length>2000)throw new Error('Notes must be under 2,000 characters.');await atomic([insert('notes',n)]);}
export async function saveGoal(g:Goal){if(!g.name.trim()||g.target<=0||g.saved<0||!Number.isSafeInteger(g.target)||!Number.isSafeInteger(g.saved))throw new Error('Enter a valid goal and amounts.');await atomic([insert('goals',g)]);}
export async function saveSettings(s:Settings){await atomic([{sql:"UPDATE metadata SET value=? WHERE key='settings'",args:[JSON.stringify(s)]}]);}
export async function removeItem(table:'budgets'|'goals',itemId:string){await atomic([{sql:`DELETE FROM ${table} WHERE id=?`,args:[itemId]}]);}
export async function snapshot():Promise<Snapshot>{return {format:'moneywise-backup',version:1,createdAt:new Date().toISOString(),data:await loadLedger()};}
export async function restore(s:Snapshot){
 validateSnapshot(s);
 // SQLite commits the full replacement or preserves the old ledger on error.
 await atomic([...tables.map(t=>({sql:`DELETE FROM ${t}`})),...tables.flatMap(t=>s.data[t].map((item:any)=>insert(t,item))),{sql:"UPDATE metadata SET value=? WHERE key='settings'",args:[JSON.stringify({...s.data.settings,onboarding:true})]}]);
}

export async function saveCategory(c:Category,ledger:Ledger){
 const name=c.name.trim();
 if(!name||name.length>40)throw new Error('Enter a category name under 40 characters.');
 if(!['expense','income'].includes(c.type)||!/^#[0-9a-f]{6}$/i.test(c.color))throw new Error('Choose a valid category type and color.');
 const existing=ledger.categories.find(item=>item.id===c.id);
 if(existing&&existing.type!==c.type)throw new Error('An existing category must keep its transaction type.');
 if(ledger.categories.some(item=>item.id!==c.id&&item.type===c.type&&item.name.toLocaleLowerCase()===name.toLocaleLowerCase()))throw new Error('This category name already exists.');
 await atomic([insert('categories',{...c,name})]);
}
