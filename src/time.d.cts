export function currentTime():string;
export function parseTime(value:string):{hour:number;minute:number;period:'AM'|'PM'};
export function to24Hour(hour:number,minute:number,period:'AM'|'PM'):string;
export function formatTime(value:string):string;
export function clockValue(x:number,y:number,mode:'hour'|'minute'):number;
