'use strict';
// Static access trial only: state never leaves this browser's local storage.
async function localRoomFetch(room,url,options={}) {
 const key='im01-github-trial:'+room;
 return navigator.locks.request(key,async()=>{
  const r=JSON.parse(localStorage.getItem(key)||'null')||{state:null,commands:[],seq:0,owner:null,lease:0};
  const data=options.body?JSON.parse(options.body):{},now=Date.now();
  let result;
  if(url==='/api/claim'){
   if(!r.owner||r.owner===data.clientId||now-r.lease>7000){r.owner=data.clientId;r.lease=now;}
   result={active:r.owner===data.clientId,state:r.state,seq:r.seq};
  }else if(url==='/api/state'){
   const ok=r.owner===data.clientId&&now-r.lease<=7000;
   if(ok)r.state={...data,heartbeat:now};result={ok};
  }else if(url==='/api/command'){
   r.seq++;r.commands.push({...data,seq:r.seq});r.commands=r.commands.slice(-100);result={ok:true,seq:r.seq};
  }else result={state:r.state,commands:r.commands,seq:r.seq,owner:r.owner};
  localStorage.setItem(key,JSON.stringify(r));
  return {ok:true,json:async()=>result};
 });
}
