const pad=n=>String(n).padStart(2,'0');
function currentTime(){const now=new Date();return `${pad(now.getHours())}:${pad(now.getMinutes())}`;}
function parseTime(value){if(typeof value!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))throw new Error('Invalid time.');const [h,m]=value.split(':').map(Number);return {hour:h%12||12,minute:m,period:h>=12?'PM':'AM'};}
function to24Hour(hour,minute,period){if(!Number.isInteger(hour)||hour<1||hour>12||!Number.isInteger(minute)||minute<0||minute>59||!['AM','PM'].includes(period))throw new Error('Invalid clock selection.');return `${pad(hour%12+(period==='PM'?12:0))}:${pad(minute)}`;}
function formatTime(value){if(!value)return 'Choose time';const {hour,minute,period}=parseTime(value);return `${hour}:${pad(minute)} ${period}`;}
function clockValue(x,y,mode){const angle=(Math.atan2(x,-y)+Math.PI*2)%(Math.PI*2);const count=mode==='hour'?12:60;const v=Math.round(angle/(Math.PI*2)*count)%count;return mode==='hour'?(v||12):v;}
module.exports={currentTime,parseTime,to24Hour,formatTime,clockValue};
