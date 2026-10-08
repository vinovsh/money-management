import {createDragSession} from './dragSession.cjs';
import React,{useState,useRef,useEffect} from 'react';
import {View,Text,Pressable,Animated,PanResponder} from 'react-native';
import {C,s,Icon} from './ui';
import type {Category} from './models';
type Props={categories:Category[];selected:string;onSelect:(id:string)=>void;onAdd:()=>void;onReorder:(ids:string[])=>Promise<boolean>;onDrag:(active:boolean)=>void};
export function CategoryGrid(props:Props){
 const [items,setItems]=useState(props.categories);const [width,setWidth]=useState(300);const [drag,setDrag]=useState<string|null>(null);const [target,setTarget]=useState<number|null>(null);
 const delta=useRef(new Animated.ValueXY()).current;const state=useRef({props,items,width});state.current={props,items,width};
 const session=useRef(createDragSession(active=>state.current.props.onDrag(active))).current;
 useEffect(()=>()=>session.stop(),[session]);
 useEffect(()=>{if(!session.id)setItems(props.categories);},[props.categories]);
 function reset(){session.stop();setDrag(null);setTarget(null);delta.setValue({x:0,y:0});}
 const responder=useRef(PanResponder.create({
  onStartShouldSetPanResponder:()=>false,
  onMoveShouldSetPanResponder:(_,g)=>session.shouldCapture(g.dx,g.dy),
  onMoveShouldSetPanResponderCapture:(_,g)=>session.shouldCapture(g.dx,g.dy),
  onPanResponderGrant:()=>{session.start();},
  onPanResponderTerminationRequest:()=>!session.active,
  onPanResponderMove:(_,g)=>{delta.setValue({x:g.dx,y:g.dy});const current=state.current;const from=current.items.findIndex(c=>c.id===session.id);const col=Math.max(0,Math.min(2,Math.round(from%3+g.dx/(current.width/3))));const row=Math.max(0,Math.round(Math.floor(from/3)+g.dy/104));setTarget(Math.min(current.items.length-1,row*3+col));},
  onPanResponderRelease:async(_,g)=>{const current=state.current;const from=current.items.findIndex(c=>c.id===session.id);if(from<0){reset();return;}const col=Math.max(0,Math.min(2,Math.round(from%3+g.dx/(current.width/3))));const row=Math.max(0,Math.round(Math.floor(from/3)+g.dy/104));const to=Math.min(current.items.length-1,row*3+col);const next=[...current.items];next.splice(to,0,next.splice(from,1)[0]);setItems(next);reset();if(from!==to&&!await current.props.onReorder(next.map(c=>c.id)))setItems(current.props.categories);},
  onPanResponderTerminate:reset,
 })).current;
 return <View onTouchEnd={()=>{if(session.id&&!session.active)reset();}} onLayout={event=>setWidth(event.nativeEvent.layout.width)} style={{flexDirection:'row',flexWrap:'wrap'}} {...responder.panHandlers}>{items.map((c,i)=><Animated.View key={c.id} style={{width:'33.3333%',height:104,padding:4,zIndex:drag===c.id?10:0,transform:drag===c.id?delta.getTranslateTransform():[]}}><Pressable accessibilityRole="button" accessibilityLabel={`${c.name}. Hold and drag to reorder.`} accessibilityState={{selected:props.selected===c.id}} onPressOut={()=>{setTimeout(()=>{if(session.id===c.id&&!session.active)reset();},100);}} delayLongPress={450} onLongPress={()=>{session.arm(c.id);setDrag(c.id);}} onPress={()=>{if(session.id){reset();return;}props.onSelect(c.id);}} style={[s.card,{flex:1,padding:8,marginBottom:0,alignItems:'center',justifyContent:'center',borderWidth:target===i?2:1,borderColor:props.selected===c.id||target===i?C.teal:C.line,backgroundColor:props.selected===c.id?C.tealLight:C.surface,elevation:drag===c.id?8:0}]}><Icon name={c.icon} color={c.color}/><Text numberOfLines={2} style={[s.text,{fontSize:11,textAlign:'center',marginTop:5}]}>{c.name}</Text><Text style={[s.muted,{fontSize:12}]}>⠿</Text></Pressable></Animated.View>)}<View style={{width:'33.3333%',height:104,padding:4}}><Pressable accessibilityRole="button" accessibilityLabel="Add category" onPress={props.onAdd} style={[s.card,{flex:1,padding:8,marginBottom:0,alignItems:'center',justifyContent:'center',borderStyle:'dashed',borderColor:C.teal}]}><Icon name="plus" color={C.teal}/><Text style={[s.link,{fontSize:11,marginTop:5}]}>Add category</Text></Pressable></View></View>;
}
