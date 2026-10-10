import type {Budget,Transaction,RecurringRule,Settings,Account,Category} from './models';
export function addDays(date:string,n:number):string;
export function nextOccurrence(date:string,interval:string,anchor?:number):string;
export function dueOccurrences(rule:RecurringRule,through?:string,limit?:number):{dates:string[];next:string;needsReview:boolean};
export function previousRange(from:string,to:string):{from:string;to:string};
export function budgetRange(b:Budget,date?:string,weekStart?:number):{from:string;to:string};
export function budgetUsage(b:Budget,txs:Transaction[],date?:string,weekStart?:number):{from:string;to:string;spent:number;limit:number;remaining:number;ratio:number};
export function validatePlanning(settings:Settings,accounts:Account[],categories:Category[]):void;
