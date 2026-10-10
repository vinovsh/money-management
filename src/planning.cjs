const {today,dayCount,monthBounds,filterTransactions,summary,validDate,safeAdd}=require('./domain.cjs');
function addDays(date,n){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function nextOccurrence(date,interval,anchor=Number(date.slice(8))){
 if(interval==='daily')return addDays(date,1);if(interval==='weekly')return addDays(date,7);
 const d=new Date(date+'T12:00:00Z');const y=d.getUTCFullYear()+(interval==='yearly'?1:0);const m=d.getUTCMonth()+(interval==='monthly'?1:0);
 const first=new Date(Date.UTC(y,m,1));const end=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();return todayUTC(new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),Math.min(anchor,end))));
}
function todayUTC(d){return d.toISOString().slice(0,10);}
function dueOccurrences(rule,through=today(),limit=31){const dates=[];let next=rule.nextDate;while(rule.enabled&&next<=through&&(!rule.endDate||next<=rule.endDate)&&dates.length<limit){dates.push(next);next=nextOccurrence(next,rule.interval,rule.anchorDay);}return {dates,next,needsReview:dates.length===limit&&next<=through};}
function previousRange(from,to){const count=dayCount(from,to);return {from:addDays(from,-count),to:addDays(from,-1)};}
function budgetRange(b,date=today(),weekStart=1){if(b.period==='custom')return {from:b.startDate||date,to:b.endDate||date};if(b.period==='weekly'){const dow=new Date(date+'T12:00:00Z').getUTCDay();const from=addDays(date,-((dow-weekStart+7)%7));return {from,to:addDays(from,6)};}return monthBounds(date);}
function eligible(b,txs,range){return filterTransactions(txs,{...range,categoryId:b.categoryId||undefined}).filter(t=>!b.tag||(t.tags||'').split(',').map(x=>x.trim().toLowerCase()).includes(b.tag.toLowerCase()));}
function budgetUsage(b,txs,date=today(),weekStart=1){const range=budgetRange(b,date,weekStart);const spent=summary(eligible(b,txs,range)).spending;let carry=0;
 if(b.rollover&&b.startDate&&b.period!=='custom'&&b.startDate<range.from){const first=budgetRange(b,b.startDate,weekStart);const periods=b.period==='weekly'?dayCount(first.from,addDays(range.from,-1))/7:(Number(range.from.slice(0,4))-Number(first.from.slice(0,4)))*12+Number(range.from.slice(5,7))-Number(first.from.slice(5,7));carry=periods*b.amount-summary(eligible(b,txs,{from:first.from,to:addDays(range.from,-1)})).spending;}
 const limit=safeAdd(b.amount,carry);return {...range,spent,limit,remaining:limit-spent,ratio:limit>0?spent/limit:spent>0?1:0};}
function validatePlanning(settings,accounts,categories){
 for(const key of ['templates','recurring','debts','goalContributions']){if(settings[key]!==undefined&&(!Array.isArray(settings[key])||settings[key].length>10000))throw new Error('Invalid planning records.');const ids=new Set();for(const item of settings[key]||[]){if(!item||typeof item.id!=='string'||!item.id||ids.has(item.id))throw new Error('Invalid planning IDs.');ids.add(item.id);}}
 for(const t of [...settings.templates||[],...settings.recurring||[]]){require('./domain.cjs').validateTransaction({...t,date:t.nextDate||today()},accounts,categories);if(typeof t.name!=='string'||!t.name.trim()||t.name.length>80)throw new Error('Invalid template name.');}
 for(const r of settings.recurring||[]){if(!validDate(r.nextDate)||!['daily','weekly','monthly','yearly'].includes(r.interval)||!['reminder','automatic'].includes(r.mode)||typeof r.enabled!=='boolean'||!Number.isInteger(r.anchorDay)||r.anchorDay<1||r.anchorDay>31||(r.endDate&&!validDate(r.endDate)))throw new Error('Invalid recurring schedule.');}
 for(const d of settings.debts||[]){if(!['lent','borrowed'].includes(d.direction)||!Number.isSafeInteger(d.amount)||d.amount<=0||!validDate(d.date)||!validDate(d.dueDate)||!accounts.some(a=>a.id===d.accountId)||!accounts.some(a=>a.id===d.debtAccountId)||!Array.isArray(d.payments)||d.payments.some(p=>!Number.isSafeInteger(p.amount)||p.amount<=0||!validDate(p.date)))throw new Error('Invalid debt.');if(d.payments.reduce((n,p)=>n+p.amount,0)>d.amount)throw new Error('Debt repayments exceed principal.');}
 for(const c of settings.goalContributions||[]){if(!Number.isSafeInteger(c.amount)||c.amount===0||!validDate(c.date))throw new Error('Invalid goal contribution.');}
 for(const key of ['hideBalances','eveningReminder','budgetAlerts','appLock','adsEnabled'])if(settings[key]!==undefined&&typeof settings[key]!=='boolean')throw new Error('Invalid preference.');
 if(settings.locale!==undefined&&!['en-IN','en-US','en-GB'].includes(settings.locale))throw new Error('Invalid locale.');
 if(settings.dashboardOrder!==undefined&&(!Array.isArray(settings.dashboardOrder)||settings.dashboardOrder.length!==4||new Set(settings.dashboardOrder).size!==4||settings.dashboardOrder.some(k=>!['month','today','budget','recent'].includes(k))))throw new Error('Invalid dashboard order.');
 if(settings.weekStart!==undefined&&![0,1,6].includes(settings.weekStart))throw new Error('Invalid week start.');
 if(settings.reminderTime!==undefined&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(settings.reminderTime))throw new Error('Invalid reminder time.');
}
module.exports={addDays,nextOccurrence,dueOccurrences,previousRange,budgetRange,budgetUsage,validatePlanning};
