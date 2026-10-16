import React,{useEffect,useState} from 'react';
import {Text,View,Image,Pressable} from 'react-native';
import {useApp} from './context';
import {Card,s,C} from './ui';
import * as Drive from './driveSync';
export function GoogleDrive(){
 const {ledger,act,busy}=useApp();const [info,setInfo]=useState<Awaited<ReturnType<typeof Drive.state>>|null>(null);const [status,setStatus]=useState(Drive.syncStatus());
 const currency=ledger.settings.currency;
 useEffect(()=>{let active=true;const refresh=()=>{if(!active)return;setStatus(Drive.syncStatus());Drive.state(currency).then(value=>{if(active)setInfo(value);}).catch(()=>{});};refresh();const off=Drive.subscribe(refresh);return()=>{active=false;off();};},[currency]);
 const blocked=busy||status.running;
 return <Card><View style={{flexDirection:'row',alignItems:'center',gap:12,marginBottom:16}}><View style={{padding:8,backgroundColor:'white',borderRadius:12}}><Image source={require('../assets/google-g.png')} style={{width:26,height:26}} accessibilityLabel="Google"/></View><View style={{flex:1}}><Text style={s.section}>Google sync</Text><Text style={[s.muted,{marginTop:4}]}>{info?.accountId?info.email:'Connect your Google account to sync your records'}</Text></View></View>
 {(!info?.accountId||!info.ready||!!info.error)?<Pressable disabled={blocked} accessibilityRole="button" accessibilityLabel="Continue with Google" onPress={()=>act(()=>Drive.connect(ledger))} style={{minHeight:48,borderWidth:1,borderColor:C.line,borderRadius:12,backgroundColor:'white',alignItems:'center',justifyContent:'center',flexDirection:'row',gap:12,opacity:blocked?0.5:1}}><Image source={require('../assets/google-g.png')} style={{width:20,height:20}}/><Text style={{color:'#1F1F1F',fontSize:14,fontWeight:'600'}}>Continue with Google</Text></Pressable>:<Text style={[s.text,{lineHeight:24}]}>Daily sync · 12:00 AM{'\n'}Last synced: {info.lastBackup?new Date(info.lastBackup).toLocaleString():'Waiting for first sync'}</Text>}
 {info?.accountId&&<Pressable disabled={blocked} accessibilityRole="button" onPress={()=>act(()=>Drive.disconnect())} style={{alignSelf:'flex-start',paddingVertical:14}}><Text style={{color:C.teal}}>Disconnect</Text></Pressable>}
 {(status.running||status.message||info?.error)?<Text accessibilityLiveRegion="polite" style={[s.muted,{lineHeight:22,marginTop:12}]}>{status.running?'Syncing your Google account…':status.message||info?.error}</Text>:null}
 <Text style={[s.muted,{fontSize:12,lineHeight:19,marginTop:12}]}>One Google sync file for all your ledgers. Saved data restores automatically when you connect. No separate password. Android may delay midnight sync while offline or saving battery.</Text></Card>;
}
