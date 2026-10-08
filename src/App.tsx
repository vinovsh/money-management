import React,{useState,useEffect,useRef} from 'react';
import {View,Text,SafeAreaView,StatusBar,Pressable,ActivityIndicator,Alert,BackHandler,Platform} from 'react-native';
import {AppContext} from './context';
import {C,s,applyTheme,Header,Icon,Sheet,Btn} from './ui';
import {TransactionForm} from './forms';
import {Home,Transactions,Statistics,Calendar,More,Accounts,Budgets,Goals,BackupScreen,Settings,Categories,Onboarding} from './screens';
import * as Store from './store';
import type {Ledger,Transaction} from './models';
const tabs=[['Home','home'],['Transactions','list'],['Calendar','calendar'],['Statistics','chart'],['More','dots']];
export default function App(){
 const [ledger,setLedger]=useState<Ledger|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const busyRef=useRef(false);const [tab,setTab]=useState('Home');const [subpage,setSubpage]=useState('');const [form,setForm]=useState(false);const [editing,setEditing]=useState<Transaction|undefined>();const [undo,setUndo]=useState<Transaction|null>(null);
 async function initialize(){setError('');try{await Store.openStore();setLedger(await Store.loadLedger());}catch(e){setError(e instanceof Error?e.message:'Could not open your data.');}}
 useEffect(()=>{initialize();},[]);
 useEffect(()=>{const subscription=BackHandler.addEventListener('hardwareBackPress',()=>{if(form){setForm(false);return true;}if(subpage){setSubpage('');return true;}if(tab!=='Home'){setTab('Home');return true;}return false;});return()=>subscription.remove();},[form,subpage,tab]);
 useEffect(()=>{if(!undo)return;const timer=setTimeout(()=>setUndo(null),12000);return()=>clearTimeout(timer);},[undo]);
 async function act(operation:()=>Promise<unknown>){if(busyRef.current)return false;busyRef.current=true;setBusy(true);try{await operation();setLedger(await Store.loadLedger());return true;}catch(e){Alert.alert('Could not complete this action',e instanceof Error?e.message:'Please try again. Your saved data has been kept.');return false;}finally{busyRef.current=false;setBusy(false);}}
 function add(){setEditing(undefined);setForm(true);}
 function edit(t:Transaction){setEditing(t);setForm(true);}
 function page(name:string){if(tabs.some(([t])=>t===name)){setTab(name);setSubpage('');}else setSubpage(name);}
 applyTheme(ledger?.settings.theme,ledger?.settings.primaryColor);
 const base={flex:1,backgroundColor:C.bg} as const;
 if(error)return <SafeAreaView style={base}><View style={{padding:26,flex:1,justifyContent:'center'}}><Text style={s.heading}>Your data needs attention</Text><Text style={[s.text,{lineHeight:24,marginVertical:18}]}>{error}</Text><Text style={[s.muted,{marginBottom:22}]}>Moneywise has not reset or erased your ledger.</Text><Btn title="Try again" onPress={initialize}/></View></SafeAreaView>;
 if(!ledger)return <SafeAreaView style={[base,{alignItems:'center',justifyContent:'center'}]}><ActivityIndicator color={C.teal} size="large"/><Text style={[s.muted,{marginTop:18}]}>Opening your money space…</Text></SafeAreaView>;
 const current=subpage||tab;
 const screen=({'Home':Home,'Transactions':Transactions,'Calendar':Calendar,'Statistics':Statistics,'More':More,'Accounts':Accounts,'Budgets':Budgets,'Savings goals':Goals,'Backup & restore':BackupScreen,'Settings':Settings,'Categories':Categories} as Record<string,React.ComponentType>)[current]||Home;
 const Screen=screen;
 return <AppContext.Provider value={{ledger,busy,act,add,edit,page,undo:setUndo}}><SafeAreaView style={base}><StatusBar backgroundColor={C.bg} barStyle={ledger.settings.theme==='dark'?'light-content':'dark-content'}/>{ledger.settings.onboarding?<>
 <Header title={current==='Home'?'Moneywise':current} subtitle={current==='Statistics'?'A clearer view of your money':undefined} onBack={subpage?()=>setSubpage(''):undefined} right={current==='Transactions'?<Pressable accessibilityLabel="Add transaction" onPress={add} style={[s.iconBox,{backgroundColor:C.teal}]}><Icon name="plus" color="white"/></Pressable>:busy?<ActivityIndicator color={C.teal}/>:undefined}/>
 <View style={{flex:1}}><Screen/></View>
 {undo&&<View style={[s.row,{backgroundColor:'#18243A',paddingHorizontal:20,paddingVertical:14}]}><Text style={{color:'white',fontSize:13}}>Transaction deleted</Text><Pressable onPress={async()=>{const t=undo;if(await act(()=>Store.undoTransaction(t)))setUndo(null);}} accessibilityRole="button" hitSlop={12}><Text style={{color:'#6FDDD2',fontWeight:'800'}}>Undo</Text></Pressable></View>}
 <View style={{flexDirection:'row',backgroundColor:C.surface,borderTopWidth:1,borderTopColor:C.line,paddingTop:10,paddingBottom:Platform.OS==='android'?12:5}}>{tabs.map(([name,icon])=><Pressable key={name} accessibilityRole="tab" accessibilityState={{selected:tab===name&&!subpage}} accessibilityLabel={name} onPress={()=>{setTab(name);setSubpage('');}} style={{flex:1,minHeight:48,alignItems:'center',justifyContent:'center',gap:6}}><Icon name={icon} color={tab===name&&!subpage?C.teal:C.muted}/><Text numberOfLines={1} style={{fontSize:name==='Transactions'?9:10,fontWeight:tab===name?'700':'500',color:tab===name&&!subpage?C.teal:C.muted}}>{name}</Text></Pressable>)}</View>
 <Sheet visible={form} title={editing?'Edit transaction':'Add transaction'} onClose={()=>{if(!busy)setForm(false);}}><TransactionForm key={editing?.id||'new'} existing={editing} onClose={()=>setForm(false)}/></Sheet>
 </>:<><Header title="Welcome"/><Onboarding/></>}
 {busy&&<View accessibilityLabel="Working" style={{position:'absolute',top:0,right:0,padding:8}}><ActivityIndicator size="small" color={C.teal}/></View>}
 </SafeAreaView></AppContext.Provider>;
}
