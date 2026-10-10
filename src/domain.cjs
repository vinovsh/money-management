const CATEGORY_SEEDS = [
  ['food','Food & groceries','basket','#F47C69','expense'],
  ['coffee','Coffee & dining','cup','#DBA46C','expense'],
  ['transport','Transport','car','#E9B949','expense'],
  ['shopping','Shopping','bag','#27A7A5','expense'],
  ['bills','Bills & home','home','#8F83D4','expense'],
  ['health','Health','heart','#E88EA5','expense'],
  ['fun','Entertainment','star','#619BC5','expense'],
  ['other','Other','dots','#96A2AE','expense'],
  ['salary','Salary','work','#39A77C','income'],
  ['freelance','Freelance','work','#55B3A0','income'],
  ['gift','Gifts & other','gift','#8EAF78','income'],
].map(([id,name,icon,color,type])=>({id,name,icon,color,type}));
function today(date=new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y,m,d]=value.split('-').map(Number); const dt=new Date(Date.UTC(y,m-1,d));
  return y>=1900 && y<=2200 && dt.getUTCFullYear()===y && dt.getUTCMonth()===m-1 && dt.getUTCDate()===d;
}
function moneyToMinor(text) {
  const s=String(text).trim();
  if(!/^\d{1,12}(\.\d{0,2})?$/.test(s)) throw new Error('Enter a positive amount with at most two decimal places.');
  const [whole,decimal='']=s.split('.'); const result=Number(whole)*100+Number(decimal.padEnd(2,'0'));
  if (!Number.isSafeInteger(result) || result<=0) throw new Error('Amount must be greater than zero.');
  return result;
}
function signedMoneyToMinor(text) {
  if(String(text).trim()==='' || /^-?0(?:\.0{0,2})?$/.test(String(text).trim())) return 0;
  const negative=String(text).trim().startsWith('-');
  return (negative?-1:1)*moneyToMinor(negative?String(text).trim().slice(1):text);
}
function minorToInput(value){return (value/100).toFixed(2);}
let moneyLocale='en-IN';
function setMoneyLocale(locale){moneyLocale=['en-IN','en-US','en-GB'].includes(locale)?locale:'en-IN';}
function formatMoney(value,currency='USD') {
  return new Intl.NumberFormat(moneyLocale,{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(value/100);
}
function monthBounds(value=today()) {
  const [y,m]=value.split('-').map(Number);
  return {from:`${y}-${String(m).padStart(2,'0')}-01`,to:`${y}-${String(m).padStart(2,'0')}-${new Date(y,m,0).getDate()}`};
}
function dayCount(from,to) {return Math.round((Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/86400000)+1;}
function filterTransactions(txs,f={}) {
  const search=(f.search||'').toLowerCase().trim();
  return txs.filter(t=>!t.deletedAt && (!f.from||t.date>=f.from) && (!f.to||t.date<=f.to) && (!f.type||t.type===f.type) && (!f.accountId||t.accountId===f.accountId||t.destinationId===f.accountId) && (!f.categoryId||t.categoryId===f.categoryId) && (!search||`${t.note||''} ${t.categoryId} ${t.tags||''}`.toLowerCase().includes(search)) && (f.min===undefined||t.amount>=f.min) && (f.max===undefined||t.amount<=f.max)).sort((a,b)=>b.date.localeCompare(a.date)||(b.time||'').localeCompare(a.time||'')||b.createdAt.localeCompare(a.createdAt));
}
function safeAdd(a,b){const value=a+b;if(!Number.isSafeInteger(value))throw new Error('The total exceeds the supported money range.');return value;}
function summary(txs) {
  let expenses=0,income=0,refunds=0;
  for(const t of txs){if(t.deletedAt)continue;if(t.type==='expense')expenses=safeAdd(expenses,t.amount); if(t.type==='income')income=safeAdd(income,t.amount);if(t.type==='refund')refunds=safeAdd(refunds,t.amount);}
  return {expenses,refunds,spending:safeAdd(expenses,-refunds),income,net:safeAdd(safeAdd(income,-expenses),refunds)};
}
function accountBalance(account,txs) {
  let value=account.opening;
  for(const t of txs){if(t.deletedAt)continue;if(t.accountId===account.id)value=safeAdd(value,(t.type==='income'||t.type==='refund')?t.amount:-t.amount);if(t.type==='transfer'&&t.destinationId===account.id)value=safeAdd(value,t.amount);}
  return value;
}
function categoryTotals(txs) {
  const map={};for(const t of txs){if(t.deletedAt||!['expense','refund'].includes(t.type))continue;map[t.categoryId]=safeAdd(map[t.categoryId]||0,t.type==='refund'?-t.amount:t.amount);}
  return Object.entries(map).map(([id,amount])=>({id,amount})).sort((a,b)=>b.amount-a.amount);
}
function validateTransaction(t,accounts,categories) {
  if(!t.id||!['expense','income','refund','transfer'].includes(t.type))throw new Error('Invalid transaction type.');
  if(!Number.isSafeInteger(t.amount)||t.amount<=0)throw new Error('Invalid transaction amount.');
  if(t.time!==undefined&&(typeof t.time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(t.time)))throw new Error('Choose a valid transaction time.');
  if(!validDate(t.date))throw new Error('Choose a valid date (YYYY-MM-DD).');
  if(!accounts.some(a=>a.id===t.accountId))throw new Error('Choose an account.');
  if(t.type==='transfer') {
    if(t.accountId===t.destinationId||!accounts.some(a=>a.id===t.destinationId))throw new Error('Choose a different destination account.');
  } else {
    const category=categories.find(c=>c.id===t.categoryId);
    if(!category || category.type!==(t.type==='income'?'income':'expense'))throw new Error('Choose a category for this transaction type.');
  }
  if(t.refundOfId&&(t.type!=='refund'||typeof t.refundOfId!=='string'))throw new Error('Invalid refund link.');
  if(typeof t.note!=='string'||t.note.length>2000)throw new Error('Notes must be under 2,000 characters.');
  if(typeof t.tags!=='string'||t.tags.length>300)throw new Error('Tags must be under 300 characters.');
}
function validateSnapshot(s) {
  if(!s||s.format!=='moneywise-backup'||![1,2].includes(s.version)||!s.data)throw new Error('This file is not a compatible Walletway backup.');
  const d=s.data;
  for(const key of ['accounts','categories','transactions','budgets','notes','goals']){
    if(!Array.isArray(d[key])||d[key].length>100000)throw new Error('Backup is incomplete or exceeds the record limit.');
    const ids=new Set();for(const item of d[key]){if(!item||typeof item.id!=='string'||!item.id||ids.has(item.id))throw new Error('Backup contains invalid or duplicate records.');ids.add(item.id);}
  }
  if(!d.accounts.length||!d.categories.length)throw new Error('Backup needs an account and categories.');
  if(!['USD','INR','EUR','GBP','AUD','CAD'].includes(d.settings?.currency))throw new Error('Unsupported backup currency.');
  if(typeof d.settings.name!=='string'||d.settings.name.length>60)throw new Error('Invalid profile in backup.');
  if(d.settings.theme!==undefined&&!['light','dark','system'].includes(d.settings.theme))throw new Error('Invalid backup theme.');
  if(d.settings.primaryColor!==undefined&&(typeof d.settings.primaryColor!=='string'||!/^#[0-9a-f]{6}$/i.test(d.settings.primaryColor)))throw new Error('Invalid backup primary color.');
  for(const a of d.accounts){if(typeof a.name!=='string'||a.name.length>80||!Number.isSafeInteger(a.opening)||typeof a.archived!=='boolean')throw new Error('Invalid backup account.');}
  for(const c of d.categories){if(c.order!==undefined&&(!Number.isSafeInteger(c.order)||c.order<0))throw new Error('Invalid category order.');if(typeof c.name!=='string'||!['income','expense'].includes(c.type)||typeof c.color!=='string'||!/^#[0-9a-f]{6}$/i.test(c.color)||typeof c.icon!=='string')throw new Error('Invalid backup category.');}
  for(const t of d.transactions){validateTransaction(t,d.accounts,d.categories);if(typeof t.createdAt!=='string'||typeof t.updatedAt!=='string')throw new Error('Invalid transaction metadata.');}
  for(const b of d.budgets){if(b.period!==undefined&&!['monthly','weekly','custom'].includes(b.period)||(b.startDate&&!validDate(b.startDate))||(b.endDate&&!validDate(b.endDate))||(b.period==='custom'&&(!b.startDate||!b.endDate||b.startDate>b.endDate))||(b.warning!==undefined&&(!Number.isInteger(b.warning)||b.warning<1||b.warning>=100)))throw new Error('Invalid budget period.');if(!Number.isSafeInteger(b.amount)||b.amount<=0||typeof b.name!=='string'||(b.categoryId&&!d.categories.some(c=>c.id===b.categoryId&&c.type==='expense')))throw new Error('Invalid backup budget.');}
  for(const n of d.notes){if(!validDate(n.date)||typeof n.body!=='string'||n.body.length>2000)throw new Error('Invalid journal entry.');}
  for(const g of d.goals){if(typeof g.name!=='string'||!Number.isSafeInteger(g.target)||g.target<=0||!Number.isSafeInteger(g.saved)||g.saved<0)throw new Error('Invalid savings goal.');}
  summary(d.transactions);let balance=0;for(const account of d.accounts)balance=safeAdd(balance,accountBalance(account,d.transactions));
  for(const t of d.transactions)if(t.refundOfId&&!d.transactions.some(original=>original.id===t.refundOfId&&original.type==='expense'))throw new Error('Invalid refund reference.');
  require('./planning.cjs').validatePlanning(d.settings,d.accounts,d.categories);
  if(s.attachments!==undefined){if(!s.attachments||typeof s.attachments!=='object'||Array.isArray(s.attachments))throw new Error('Invalid receipt archive.');let bytes=0;for(const [id,data] of Object.entries(s.attachments)){if(!d.transactions.some(t=>t.id===id)||typeof data!=='string'||!data.length||data.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(data)||data.length>7*1024*1024)throw new Error('Invalid receipt attachment.');bytes+=data.length;}if(bytes>17*1024*1024)throw new Error('Receipt archive is too large.');}
  return s;
}
module.exports={CATEGORY_SEEDS,today,validDate,moneyToMinor,signedMoneyToMinor,minorToInput,formatMoney,monthBounds,dayCount,filterTransactions,summary,accountBalance,categoryTotals,validateTransaction,validateSnapshot};

function reorderCategories(categories,ids){
 if(ids.length!==new Set(ids).size||ids.some(id=>!categories.some(c=>c.id===id)))throw new Error('Invalid category order.');
 const selected=categories.filter(c=>ids.includes(c.id));
 if(selected.length&&selected.some(c=>c.type!==selected[0].type))throw new Error('Reorder one category type at a time.');
 if(selected.length&&categories.filter(c=>c.type===selected[0].type).length!==ids.length)throw new Error('Include every category of this type.');
 return categories.map(c=>ids.includes(c.id)?{...c,order:ids.indexOf(c.id)}:c);
}
module.exports.reorderCategories=reorderCategories;

module.exports.setMoneyLocale=setMoneyLocale;

module.exports.safeAdd=safeAdd;
