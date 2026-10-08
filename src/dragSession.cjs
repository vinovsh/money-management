function createDragSession(onActiveChange){
 const session={id:null,active:false,
  arm(id){session.id=id;},
  shouldCapture(dx,dy){return session.id!==null&&(Math.abs(dx)+Math.abs(dy)>6);},
  start(){if(session.id===null)return;session.active=true;onActiveChange(true);},
  stop(){const wasActive=session.active;session.id=null;session.active=false;if(wasActive)onActiveChange(false);}
 };
 return session;
}
module.exports={createDragSession};
