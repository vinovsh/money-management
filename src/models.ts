export type TxType = 'expense'|'income'|'refund'|'transfer';
export type Account = {id:string; name:string; type:string; opening:number; archived:boolean};
export type Category = {id:string; name:string; icon:string; color:string; type:'expense'|'income'; order?:number; archived?:boolean};
export type Transaction = {id:string; type:TxType; amount:number; date:string; time?:string; accountId:string; destinationId:string; categoryId:string; note:string; tags:string; createdAt:string; updatedAt:string; deletedAt:string|null; refundOfId?:string; occurredAt?:string; timezone?:string; receipt?:string; recurrenceKey?:string};
export type Budget = {id:string; name:string; amount:number; categoryId:string; period?:'monthly'|'weekly'|'custom'; startDate?:string; endDate?:string; rollover?:boolean; tag?:string; alerts?:boolean; warning?:number};
export type Journal = {id:string; date:string; body:string};
export type Goal = {id:string; name:string; target:number; saved:number};
export type Settings = {currency:string; name:string; onboarding:boolean; lastBackup:string; datasetId:string; theme?:'light'|'dark'|'system'; primaryColor?:string; locale?:string; weekStart?:number; hideBalances?:boolean; dashboardOrder?:string[]; eveningReminder?:boolean; reminderTime?:string; budgetAlerts?:boolean; appLock?:boolean; templates?:EntryTemplate[]; recurring?:RecurringRule[]; debts?:Debt[]; goalContributions?:GoalContribution[]; lastAccountId?:string; adsEnabled?:boolean};
export type Ledger = {accounts:Account[]; categories:Category[]; transactions:Transaction[]; budgets:Budget[]; notes:Journal[]; goals:Goal[]; settings:Settings};
export type Snapshot = {format:'moneywise-backup';version:1;createdAt:string;data:Ledger; attachments?:Record<string,string>};
export type Filter = {from?:string;to?:string;type?:string;accountId?:string;categoryId?:string;search?:string;min?:number;max?:number};

export type EntryTemplate = {id:string; name:string; type:TxType; amount:number; accountId:string; destinationId:string; categoryId:string; note:string; tags:string};
export type RecurringRule = EntryTemplate & {nextDate:string; interval:'daily'|'weekly'|'monthly'|'yearly'; mode:'reminder'|'automatic'; enabled:boolean; anchorDay:number; endDate?:string};
export type Debt = {id:string; name:string; direction:'lent'|'borrowed'; amount:number; accountId:string; debtAccountId:string; date:string; dueDate:string; payments:{id:string; amount:number; date:string}[]};
export type GoalContribution = {id:string; goalId:string; amount:number; date:string};
