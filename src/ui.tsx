import React from 'react';
import {View,Text,Pressable,TextInput,StyleSheet,ScrollView,Modal,KeyboardAvoidingView,Platform,Keyboard,Image} from 'react-native';
import Svg,{Path,Circle,Rect,Line} from 'react-native-svg';
export const C={bg:'#F5F7F8',surface:'#FFFFFF',ink:'#18243A',muted:'#788497',line:'#E8EDF0',teal:'#315ACB',tealLight:'#EDF2FF',red:'#F17866',green:'#32A77D',greenLight:'#EBF8F0',purple:'#9685D5',amber:'#E8B342'};
export const EXTRA_ICONS=['plane','train','bike','fuel','phone','wifi','school','book','music','game','pet','baby','doctor','fitness','restaurant','grocery','rent','electric','water','insurance','tax','investment','salary','subscription'];
const paths:Record<string,string>={
 clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7v5l4 2',
 plane:'M2 12l8-2V3l2-1 2 8 8 2v2l-8 1v5l-2 2-2-2v-5l-8-1z',
 train:'M5 3h14v15H5zM5 10h14M9 3v7M15 3v7M8 14h1M15 14h1M8 18l-3 4M16 18l3 4',
 bike:'M6 14a4 4 0 1 0 0 8 4 4 0 0 0 0-8M18 14a4 4 0 1 0 0 8 4 4 0 0 0 0-8M6 18l5-9 7 9M11 9H6M14 5h3l1 13M11 9l3 9H6',
 fuel:'M4 3h9v18H4zM4 9h9M13 10h3v7h3V8l-3-3M2 21h13',
 phone:'M7 2h10v20H7zM10 18h4',wifi:'M2 7c6-6 14-6 20 0M6 11c4-4 8-4 12 0M10 15c1-1 3-1 4 0M12 19h.01',
 school:'M2 8l10-5 10 5-10 5zM6 10v7c4 4 8 4 12 0v-7M22 8v9',book:'M12 5C8 2 4 2 2 4v16c4-2 7-1 10 1 3-2 6-3 10-1V4c-2-2-6-2-10 1v16',
 music:'M10 17V4l10-2v13M10 7l10-2M10 17c0 5-8 5-8 1s8-5 8-1M20 15c0 5-8 5-8 1s8-5 8-1',game:'M6 7h12l4 12-4 2-4-5h-4l-4 5-4-2zM5 12h6M8 9v6M16 11h.1M19 14h.1',
 pet:'M8 13c-7 4-5 10 4 7 9 3 11-3 4-7-2-3-6-3-8 0M4 5a2 3 0 1 0 0 6 2 3 0 0 0 0-6M10 2a2 3 0 1 0 0 6 2 3 0 0 0 0-6M16 2a2 3 0 1 0 0 6 2 3 0 0 0 0-6M21 6a2 3 0 1 0 0 6 2 3 0 0 0 0-6',
 baby:'M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0M8 10h.1M16 10h.1M8 15c2 3 6 3 8 0M12 3c-3 3 0 5 2 3',doctor:'M4 6h16v15H4zM8 6V3h8v3M12 10v7M9 13h6',fitness:'M2 8v8M5 6v12M5 12h14M19 6v12M22 8v8',
 restaurant:'M4 2v7h6V2M7 2v20M18 22V2c-5 3-5 10 0 10',grocery:'M2 3h3l3 13h11l3-10H6M9 21h.1M18 21h.1',rent:'M3 10l9-7 9 7v11H3zM9 21v-8h6v8',electric:'M14 2L4 14h7l-1 8 10-12h-7z',water:'M12 2C8 8 4 11 4 15a8 8 0 0 0 16 0c0-4-4-7-8-13',insurance:'M12 2l9 4v7c0 5-9 9-9 9s-9-4-9-9V6zM8 12l3 3 5-6',tax:'M5 2h14v20l-3-2-4 2-4-2-3 2zM8 7h8M8 12h8M8 16h4',investment:'M3 21V3M3 21h18M6 16l5-5 4 3 6-9M16 5h5v5',salary:'M3 7h18v14H3zM8 7V3h8v4M3 12h18M10 12v3h4v-3',subscription:'M4 7h15l-4-4M20 17H5l4 4M20 7v5M4 17v-5',

 home:'M3 10L12 3l9 7v11h-6v-7H9v7H3z',
 list:'M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1',
 calendar:'M4 5h16v16H4zM4 9h16M8 3v4M16 3v4M8 13h2M14 13h2M8 17h2',
 chart:'M4 21V12h4v9M10 21V6h4v15M16 21V3h4v18',
 wallet:'M3 6h17v15H3zM3 6l14-3v3M14 11h7v6h-7z',
 basket:'M3 8h18l-2 12H5zM8 8l4-6 4 6M9 12v4M15 12v4',
 cup:'M4 4h12v12a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM16 6h3a3 3 0 0 1 0 6h-3',
 car:'M3 10l3-6h12l3 6v9H3zM3 10h18M7 14h1M16 14h1M6 19v2M18 19v2',
 bag:'M4 8h16v13H4zM8 8V6a4 4 0 0 1 8 0v2',
 heart:'M12 21L3 12C-2 5 7 0 12 6c5-6 14-1 9 6z',
 star:'M12 2l3 7 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1z',
 dots:'M4 12h1M11 12h1M18 12h1',
 work:'M3 7h18v14H3zM8 7V3h8v4M3 12h18M10 12v3h4v-3',
 gift:'M3 8h18v5H3zM5 13v8h14v-8M12 8v13M12 8C0 9 6-4 12 8c6-12 12 1 0 0',
 plus:'M12 4v16M4 12h16',
 back:'M15 5l-7 7 7 7',
 next:'M9 5l7 7-7 7',
 down:'M5 9l7 7 7-7',
 up:'M12 20V4M5 11l7-7 7 7',
 arrowDown:'M12 4v16M5 13l7 7 7-7',
 transfer:'M3 7h17l-4-4M21 17H4l4 4',
 cloud:'M7 18H5a4 4 0 0 1 0-8 7 7 0 0 1 14-1 4.5 4.5 0 0 1 0 9h-2',
 shield:'M12 2l9 4v7c0 5-9 9-9 9s-9-4-9-9V6zM7 12l3 3 7-7',
 check:'M4 12l5 5L20 6',
 close:'M5 5l14 14M19 5L5 19',
 filter:'M3 5h18M6 12h12M9 19h6',
 search:'M16 16l6 6M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
 note:'M5 3h10l4 4v14H5zM15 3v5h4M8 12h8M8 16h6',
 lock:'M5 10h14v12H5zM8 10V6a4 4 0 0 1 8 0v4M12 15v3',
 target:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18',
 trash:'M4 6h16M9 3h6M6 6l1 15h10l1-15M10 10v7M14 10v7',
 eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
 export:'M12 16V2M7 7l5-5 5 5M4 13v8h16v-8',
};
export function Icon({name,size=22,color=C.ink}:{name:string;size?:number;color?:string}){return <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden><Path d={paths[name]||paths.dots} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/></Svg>;}
export function Card({children,style}:{children:React.ReactNode;style?:any}){return <View style={[s.card,style]}>{children}</View>;}
export function Btn({title,onPress,secondary=false,danger=false,disabled=false,icon}:{title:string;onPress:()=>void;secondary?:boolean;danger?:boolean;disabled?:boolean;icon?:string}){return <Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={({pressed})=>[s.button,secondary&&s.secondary,danger&&{backgroundColor:'#FFF0ED'},(disabled||pressed)&&{opacity:.55}]}>{icon&&<Icon name={icon} color={secondary?C.teal:danger?C.red:'white'}/>}<Text style={[s.buttonText,secondary&&{color:C.teal},danger&&{color:C.red}]}>{title}</Text></Pressable>;}
export function Chip({title,selected,onPress}:{title:string;selected?:boolean;onPress:()=>void}){return <Pressable accessibilityRole="button" accessibilityState={{selected:!!selected}} onPress={onPress} style={[s.chip,selected&&{backgroundColor:C.teal,borderColor:C.teal}]}><Text style={[s.chipText,selected&&{color:'white'}]}>{title}</Text></Pressable>;}
export function Field({label,value,onChangeText,placeholder,keyboardType='default',multiline=false,secureTextEntry=false,maxLength=2000}:{label:string;value:string;onChangeText:(v:string)=>void;placeholder?:string;keyboardType?:any;multiline?:boolean;secureTextEntry?:boolean;maxLength?:number}){return <View style={{marginBottom:14}}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} style={[s.input,multiline&&{minHeight:92,textAlignVertical:'top'}]} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={C.muted} keyboardType={keyboardType} multiline={multiline} secureTextEntry={secureTextEntry} maxLength={maxLength} autoCapitalize={secureTextEntry?'none':'sentences'}/></View>;}
export function Section({title,action,onPress}:{title:string;action?:string;onPress?:()=>void}){return <View style={[s.row,{marginTop:22,marginBottom:12}]}><Text style={s.section}>{title}</Text>{action&&<Pressable accessibilityRole="button" onPress={onPress} hitSlop={12}><Text style={s.link}>{action}</Text></Pressable>}</View>;}
export function Header({title,subtitle,onBack,right}:{title:string;subtitle?:string;onBack?:()=>void;right?:React.ReactNode}){return <View style={[s.row,{paddingHorizontal:20,paddingTop:14,paddingBottom:16}]}>{onBack&&<Pressable onPress={onBack} accessibilityLabel="Back" hitSlop={14}><Icon name="back"/></Pressable>}<View style={{flex:1,marginLeft:onBack?12:0}}><View style={{flexDirection:'row',alignItems:'center',gap:10}}>{(title==='Moneywise'||title==='Welcome')&&<Image source={require('../assets/moneywise-logo.png')} style={{width:38,height:38,borderRadius:10}}/>}<Text style={s.heading}>{title}</Text></View>{subtitle&&<Text style={[s.muted,{marginTop:5}]}>{subtitle}</Text>}</View>{right}</View>;}
export function Empty({icon='wallet',title,body,action,onPress}:{icon?:string;title:string;body:string;action?:string;onPress?:()=>void}){return <Card style={{alignItems:'center',paddingVertical:30}}><View style={[s.iconBox,{backgroundColor:C.tealLight,width:60,height:60,marginBottom:14}]}><Icon name={icon} size={30} color={C.teal}/></View><Text style={[s.section,{textAlign:'center'}]}>{title}</Text><Text style={[s.muted,{textAlign:'center',lineHeight:22,marginTop:8,marginBottom:action?18:0}]}>{body}</Text>{action&&onPress&&<Btn title={action} onPress={onPress}/>}</Card>;}
export function Sheet({visible,title,onClose,children,scrollEnabled=true}:{visible:boolean;title:string;onClose:()=>void;children:React.ReactNode;scrollEnabled?:boolean}){return <Modal visible={visible} animationType="slide" onRequestClose={onClose}><KeyboardAvoidingView style={{flex:1,backgroundColor:C.bg}} behavior={Platform.OS==='ios'?'padding':undefined}><View style={{height:Platform.OS==='ios'?48:20}}/><Header title={title} right={<Pressable accessibilityLabel="Close" onPress={onClose} hitSlop={15}><Icon name="close"/></Pressable>}/><ScrollView scrollEnabled={scrollEnabled} nestedScrollEnabled keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:20,paddingTop:0,paddingBottom:40}}>{children}</ScrollView></KeyboardAvoidingView></Modal>;}
export function Progress({value,color=C.teal}:{value:number;color?:string}){return <View style={s.progress}><View style={{height:8,borderRadius:8,width:`${Math.max(0,Math.min(1,value))*100}%`,backgroundColor:color}}/></View>;}
function createStyles(){return StyleSheet.create({
 row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},
 card:{backgroundColor:C.surface,borderRadius:20,padding:18,borderWidth:1,borderColor:C.line,marginBottom:12},
 heading:{fontSize:25,fontWeight:'800',color:C.ink,letterSpacing:-.6},section:{fontSize:17,fontWeight:'700',color:C.ink},
 text:{fontSize:15,color:C.ink},muted:{fontSize:13,color:C.muted},link:{fontSize:13,fontWeight:'700',color:C.teal},
 button:{backgroundColor:C.teal,borderRadius:14,minHeight:52,paddingHorizontal:18,paddingVertical:14,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:10,marginBottom:10},
 buttonText:{color:'white',fontWeight:'700',fontSize:15},secondary:{backgroundColor:C.surface,borderWidth:1,borderColor:'#A8D3D4'},
 label:{fontSize:13,fontWeight:'600',color:C.muted,marginBottom:8},input:{borderWidth:1,borderColor:C.line,backgroundColor:C.surface,borderRadius:14,padding:14,fontSize:16,color:C.ink,minHeight:50},
 chip:{paddingHorizontal:15,paddingVertical:11,borderRadius:12,borderWidth:1,borderColor:C.line,backgroundColor:C.surface,marginRight:8,marginBottom:8,minHeight:44,justifyContent:'center'},chipText:{fontSize:13,fontWeight:'600',color:C.muted},
 iconBox:{width:42,height:42,borderRadius:14,alignItems:'center',justifyContent:'center'},
 progress:{height:8,borderRadius:8,backgroundColor:'#E9F0F2',overflow:'hidden',marginTop:12},
 divider:{height:1,backgroundColor:C.line,marginVertical:12},
 amount:{fontSize:19,fontWeight:'800',color:C.ink},
});}
export let s=createStyles();
const light={...C};
export const PRIMARY_COLORS=['#315ACB','#07858C','#7543BA','#B53063','#A34D12'];
let themeKey='';
export function applyTheme(mode:string='light',primary:string=PRIMARY_COLORS[0]){
 const dark=mode==='dark';const accent=PRIMARY_COLORS.includes(primary)?primary:PRIMARY_COLORS[0];
 const key=mode+accent;if(key===themeKey)return;themeKey=key;
 Object.assign(C,light,dark?{bg:'#101820',surface:'#1C2834',ink:'#F0F4F8',muted:'#AEBCCD',line:'#364554',greenLight:'#153A30'}:{}, {teal:accent,tealLight:dark?accent+'40':accent+'18'});
 s=createStyles();
}
