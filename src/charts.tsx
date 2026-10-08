import React from 'react';
import {View,Text} from 'react-native';
import Svg,{Circle,Path,Line} from 'react-native-svg';
import {C,s,Card,Progress} from './ui';
import {formatMoney,categoryTotals,dayCount,summary} from './domain.cjs';
import type {Transaction,Category} from './models';
export function Donut({transactions,categories,currency}:{transactions:Transaction[];categories:Category[];currency:string}){
 const rows=categoryTotals(transactions);const total=rows.reduce((sum,r)=>sum+r.amount,0);let offset=0;
 const circle=2*Math.PI*44;
 return <Card><Text style={s.section}>Where your money goes</Text>{rows.length===0?<Text style={[s.muted,{marginTop:16}]}>Your category breakdown appears after your first expense.</Text>:<>
 {total>0&&rows.every(r=>r.amount>=0)&&<View style={{alignItems:'center',marginVertical:20}} accessibilityLabel={`Total spending ${formatMoney(total,currency)}`}><Svg width={160} height={160} viewBox="0 0 120 120"><Circle cx={60} cy={60} r={44} stroke={C.line} strokeWidth={15} fill="none"/>{rows.map(r=>{const start=offset;offset+=r.amount/total*circle;return <Circle key={r.id} cx={60} cy={60} r={44} fill="none" stroke={categories.find(c=>c.id===r.id)?.color||C.teal} strokeWidth={15} strokeDasharray={`${r.amount/total*circle} ${circle}`} strokeDashoffset={-start} rotation={-90} origin="60,60"/>;})}</Svg><View pointerEvents="none" style={{position:'absolute',top:62}}><Text style={[s.muted,{textAlign:'center'}]}>Spending</Text><Text style={[s.amount,{textAlign:'center',fontSize:16}]}>{formatMoney(total,currency)}</Text></View></View>}
 {rows.map(r=>{const cat=categories.find(c=>c.id===r.id);return <View key={r.id} style={[s.row,{paddingVertical:8}]}><View style={{width:9,height:9,borderRadius:5,backgroundColor:cat?.color||C.teal}}/><Text style={[s.text,{flex:1,fontSize:13}]}>{cat?.name||'Other'}</Text><Text style={[s.text,{fontSize:13,fontWeight:'700'}]}>{formatMoney(r.amount,currency)}</Text><Text style={[s.muted,{width:38,textAlign:'right'}]}>{total>0&&r.amount>=0?`${Math.round(r.amount/total*100)}%`:'—'}</Text></View>;})}
 </>}</Card>;
}
export function Trend({transactions,from,to,currency}:{transactions:Transaction[];from:string;to:string;currency:string}){
 const count=dayCount(from,to);const stride=count>60?Math.ceil(count/30):1;
 const bins:number[]=Array(Math.ceil(count/stride)).fill(0);const base=Date.parse(from+'T00:00:00Z');
 for(const t of transactions){if(t.type==='expense'||t.type==='refund'){const day=Math.round((Date.parse(t.date+'T00:00:00Z')-base)/86400000);const index=Math.floor(day/stride);if(index>=0&&index<bins.length)bins[index]+=(t.type==='refund'?-1:1)*t.amount;}}
 const max=Math.max(100,...bins),min=Math.min(0,...bins);const height=120;
 const path=bins.map((v,i)=>`${i===0?'M':'L'}${12+(bins.length>1?i/(bins.length-1)*276:138)},${12+height-(v-min)/(max-min)*height}`).join(' ');
 return <Card><View style={s.row}><Text style={s.section}>Spending trend</Text><Text style={s.muted}>{stride>1?`${stride}-day totals`:'Daily totals'}</Text></View><Text style={[s.muted,{marginTop:12}]}>{formatMoney(max,currency)}</Text><Svg width="100%" height={160} viewBox="0 0 300 160">{[12,72,132].map(y=><Line key={y} x1={10} x2={290} y1={y} y2={y} stroke={C.line}/>)}<Path d={path} fill="none" stroke={C.red} strokeWidth={2.5} strokeLinejoin="round"/>{bins.length===1&&<Circle cx={150} cy={12+height-(bins[0]-min)/(max-min)*height} r={4} fill={C.red}/>}</Svg><View style={s.row}><Text style={s.muted}>{from}</Text><Text style={s.muted}>{to}</Text></View><Text style={[s.muted,{marginTop:10}]} accessibilityRole="text">Highest {stride>1?'period':'day'}: {formatMoney(Math.max(0,...bins),currency)} · refunds reduce totals</Text></Card>;
}
export function Comparison({transactions,currency}:{transactions:Transaction[];currency:string}){
 const totals=summary(transactions);const max=Math.max(totals.income,Math.abs(totals.spending),1);
 return <Card><Text style={[s.section,{marginBottom:18}]}>Income vs. expenses</Text>{[{name:'Income',value:totals.income,color:C.green},{name:'Net spending',value:totals.spending,color:C.red}].map(r=><View key={r.name} style={{marginBottom:15}}><View style={s.row}><Text style={s.text}>{r.name}</Text><Text style={s.amount}>{formatMoney(r.value,currency)}</Text></View><Progress value={Math.abs(r.value)/max} color={r.color}/></View>)}</Card>;
}
