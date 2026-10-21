'use strict';
const svg=document.querySelector('#panel'), NS='http://www.w3.org/2000/svg';
const room=new URLSearchParams(location.search).get('room')||'4d6c488470ec4f3fa85ba9b6469a78bc';const roomFetch=(url,options)=>localRoomFetch(room,url,options);const KEY='im01-v4';let machine=new Machine(), history=[],notice='',noticeUntil=0;
const clientId=crypto.randomUUID?.()||String(Date.now()+Math.random());let commandSeq=0,networkReady=false,syncBusy=false,isActive=false,animateDial=false,resetOnAcquire=true;
function hydrate(data){animateDial=false;for(const key of Object.keys(new Machine()))if(Object.hasOwn(data,key))machine[key]=data[key];history=data.history||[];lastDialMode=machine.dialMode;commandSeq=data.ackSeq||0;}
const dialArtwork=svg.querySelector('g[filter="url(#filter0_d_74_1649)"]');
// Replace the raised pointer band with a smooth vector metal ring.
const ringDefs=document.createElementNS(NS,'defs');
ringDefs.innerHTML='<radialGradient id="plain-dial-metal" cx="30%" cy="20%" r="95%"><stop offset="0" stop-color="#96918b"/><stop offset=".55" stop-color="#85807a"/><stop offset="1" stop-color="#68635e"/></radialGradient>';
svg.append(ringDefs);
const smoothBand=document.createElementNS(NS,'circle');
Object.entries({cx:780.6,cy:1142.2,r:147,fill:'none',stroke:'url(#plain-dial-metal)','stroke-width':52}).forEach(([k,v])=>smoothBand.setAttribute(k,v));
dialArtwork.append(smoothBand);
let dialRotation=0;
// Keep the original SVG shadow and base stationary; rotate only the dial surface.
const dialShadow=dialArtwork.cloneNode(true);dialShadow.id='dial-fixed-shadow';dialArtwork.before(dialShadow);dialArtwork.removeAttribute('filter');dialArtwork.id='dial-rotating-surface';
const dotGroup=Array.from(svg.children).find(e=>e.getAttribute('opacity')==='0.14');
const modeDots=[];if(dotGroup){dotGroup.id='mode-dots';dotGroup.removeAttribute('opacity');[6,5,4,3,2,1,0,7].forEach((mode,index)=>{const dot=dotGroup.children[index];dot.id='dot'+mode;modeDots[mode]=dot;});}
const oldSelectedDot=document.querySelector('#mode2').lastElementChild;if(oldSelectedDot?.tagName==='path')oldSelectedDot.style.display='none';
const modeAngles=[-75,-45,-15,15,45,75,105,-105];
let lastDialMode=machine.mode<8?machine.mode:machine.memory.mode;
function selectable(id,enabled,chosen){lamp(id,enabled&&chosen);document.getElementById(id).classList.toggle('dim',enabled&&!chosen);}
const modes=['ICE CREAM','FRUIT ICE CREAM','LITE ICE CREAM','FROZEN YOGURT','SORBET','SLUSH','MILK SHAKE','GELATO','MIX-IN'];
const quantities=['50ML','100ML','HALF','FULL'];
const labels={off:'关机／待开机',setup:'程序设置',running:'程序运行',retracting:'刀具复位中',finished:'程序完成',error:'安装异常',needHome:'等待手动复位',pending:'异常恢复策略待确认'};
const runningAudio=new Audio('running-23s-43s.m4a');runningAudio.preload='auto';runningAudio.loop=true;runningAudio.volume=.35;let audioRunning=false,audioGeneration=0,fadeTimer=null;
function isEndingSound(){return machine.phase==='running'&&machine.left<=3*Math.max(1,machine.timeScale);}
function syncRunningSound(){const shouldPlay=networkReady&&isActive&&machine.on&&machine.phase==='running'&&!isEndingSound();if(shouldPlay===audioRunning)return;audioRunning=shouldPlay;const generation=++audioGeneration;clearInterval(fadeTimer);fadeTimer=null;if(shouldPlay){runningAudio.currentTime=0;runningAudio.volume=.35;runningAudio.play().then(()=>{if(generation!==audioGeneration&&!audioRunning&&fadeTimer===null)runningAudio.pause();}).catch(e=>{console.warn('运行声播放失败',e);});}else{const start=performance.now(),volume=runningAudio.volume;fadeTimer=setInterval(()=>{if(generation!==audioGeneration){clearInterval(fadeTimer);fadeTimer=null;return;}const progress=Math.min(1,(performance.now()-start)/400);runningAudio.volume=volume*(1-progress)*(1-progress);if(progress===1){clearInterval(fadeTimer);fadeTimer=null;runningAudio.pause();runningAudio.currentTime=0;runningAudio.volume=.35;}},16);}}
window.addEventListener('pagehide',()=>{audioRunning=false;audioGeneration++;clearInterval(fadeTimer);fadeTimer=null;runningAudio.pause();});
let retractBuffer=null,retractLoading=null,retractSource=null,retractGain=null,retractPlaying=false;
function prepareRetract(){if(!audioContext||retractBuffer||retractLoading)return;retractLoading=fetch('retract-fan-1s-5s.m4a').then(r=>{if(!r.ok)throw Error('回收声资源加载失败');return r.arrayBuffer();}).then(b=>audioContext.decodeAudioData(b)).then(b=>{retractBuffer=b;}).catch(e=>{console.warn('回收声解码失败',e);}).finally(()=>{retractLoading=null;});}
function syncRetractSound(){const play=networkReady&&isActive&&machine.on&&(machine.phase==='retracting'||isEndingSound());if(play&&!retractPlaying){if(!audioContext||audioContext.state!=='running'||!retractBuffer)return;retractPlaying=true;retractSource=audioContext.createBufferSource();retractSource.buffer=retractBuffer;retractSource.loop=true;retractGain=audioContext.createGain();retractGain.gain.setValueAtTime(0,audioContext.currentTime);retractGain.gain.linearRampToValueAtTime(.2275,audioContext.currentTime+.04);retractSource.connect(retractGain);retractGain.connect(audioContext.destination);retractSource.start();}else if(!play&&retractPlaying){retractPlaying=false;const source=retractSource,gain=retractGain,t=audioContext.currentTime,fade=machine.on&&!machine.error?0.12:0.01;gain.gain.cancelScheduledValues(t);gain.gain.setValueAtTime(gain.gain.value,t);gain.gain.linearRampToValueAtTime(0,t+fade);source.stop(t+fade+.01);source.onended=()=>{source.disconnect();gain.disconnect();};retractSource=null;retractGain=null;}}
window.addEventListener('pagehide',()=>{if(retractSource){try{retractSource.stop();}catch(e){}retractSource=null;}retractPlaying=false;});
// Sound is unlocked by the first user gesture; no external assets required.
let audioContext=null;
function unlockAudio(){try{audioContext??=new (window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')audioContext.resume();prepareRetract();}catch(e){console.warn('提示音不可用',e);}}
function sound(type='key'){if(!audioContext||audioContext.state!=='running')return;const patterns={key:[[1050,0,.065]],dial:[[1400,0,.035]],start:[[880,0,.07],[1175,.10,.10]],stop:[[880,0,.07],[660,.10,.10]],finish:[[880,0,.13],[1109,.18,.13],[1319,.36,.22]],error:[[660,0,.15],[660,.22,.15]],restore:[[880,0,.07],[1050,.10,.10]],powerOff:[[880,0,.08],[587,.12,.12]]};for(const [hz,offset,duration]of patterns[type]||patterns.key){const t=audioContext.currentTime+offset,o=audioContext.createOscillator(),g=audioContext.createGain();o.type='sine';o.frequency.value=hz;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.09,t+.008);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(audioContext.destination);o.start(t);o.stop(t+duration+.02);o.onended=()=>{o.disconnect();g.disconnect();};}}
document.addEventListener('pointerdown',unlockAudio,{capture:true});document.addEventListener('keydown',unlockAudio,{capture:true});
let previousSoundPhase='off',previousSoundError=null;
function record(text){history.unshift(text);history=history.slice(0,16);document.querySelector('#history').textContent=history.join('\n');}
function action(name,fn){unlockAudio();if(!networkReady||!isActive)return;animateDial=true;const before=machine.phase;const snapshot=JSON.stringify(machine);fn();const changed=snapshot!==JSON.stringify(machine);if(changed){if(name==='电源')sound(machine.on?'start':'powerOff');else if(name==='启动／停止')sound(machine.phase==='running'?'start':'stop');else if(machine.phase==='running'&&before!=='running')sound('start');else sound(name==='选择旋钮模式'?'dial':'key');}if(before!==machine.phase||name.startsWith('选择'))record(name+' → '+labels[machine.phase]);render();}

function lamp(id,on=false,blink=false){let e=document.getElementById(id);e.classList.remove('dim');e.classList.toggle('on',on);e.classList.toggle('blink',on&&blink);}
const segments=[...document.querySelector('#digit').children];
const chars={'0':[0,2,3,4,5,6],'1':[3,5],'2':[0,1,2,3,6],'3':[0,1,2,3,5],'4':[1,3,4,5],'5':[0,1,2,4,5],'6':[0,1,2,4,5,6],'7':[0,3,5],'8':[0,1,2,3,4,5,6],'9':[0,1,2,3,4,5],'F':[0,1,4,6],'-':[1]};
function number(v){lamp('digit',v!==null);segments.forEach((e,i)=>e.style.opacity=v!==null&&(chars[v]||[]).includes(i)?'1':'0');}
const wait=document.createElementNS(NS,'text');wait.id='wait-label';wait.setAttribute('x','934');wait.setAttribute('y','370');wait.innerHTML='<tspan x="934">BLADE</tspan><tspan x="934" dy="29">RETRACT</tspan>';svg.append(wait);
function render(){syncRunningSound();syncRetractSound();const s=machine;if(s.error&&s.error!==previousSoundError)sound('error');else if(s.phase==='finished'&&['running','retracting'].includes(previousSoundPhase))sound('finish');else if(previousSoundPhase==='error'&&!s.error&&s.on)sound('restore');previousSoundPhase=s.phase;previousSoundError=s.error;const ready=s.on&&!['error','needHome','retracting','pending'].includes(s.phase),selected=s.qty!==null;

 selectable('power',s.supply,s.on);lamp('start',s.on&&(s.phase==='needHome'||s.phase==='running'||(s.phase==='setup'&&selected&&s.mode!==null)));
 for(let i=0;i<4;i++)selectable('qty'+i,ready&&s.phase!=='finished'&&(s.phase!=='running'||s.qty===i),s.qty===i);
 for(let i=0;i<8;i++){const visible=ready&&selected&&s.kind!=='respin'&&s.mode!==8&&s.phase!=='finished'&&(s.phase!=='running'||s.mode===i);selectable('mode'+i,visible,s.mode===i);const hot=document.getElementById('hot-mode'+i);if(hot){const interactive=visible&&isActive&&networkReady&&s.phase==='setup';hot.style.pointerEvents=interactive?'all':'none';hot.setAttribute('aria-disabled',String(!interactive));hot.setAttribute('tabindex',interactive?'0':'-1');hot.setAttribute('aria-hidden',String(!visible));}}
 selectable('mix',ready&&(s.phase!=='running'||s.mode===8),s.phase==='finished'||s.mode===8);
 for(let i=0;i<8;i++){if(modeDots[i]){const shown=ready&&selected&&s.kind!=='respin'&&s.mode!==8&&s.phase!=='finished'&&(s.phase!=='running'||s.mode===i);const chosen=shown&&s.mode===i;modeDots[i].setAttribute('fill',chosen?'#FFFFFF':'#000000');modeDots[i].setAttribute('opacity',shown?(chosen?'1':'.2'):'0');}}
 lamp('respin',s.phase==='finished'||(s.on&&s.kind==='respin'&&['setup','running'].includes(s.phase)));
 const respinEnabled=s.phase==='finished'||(s.on&&s.kind==='respin'&&s.phase==='setup');
 document.querySelector('#hot-respin')?.setAttribute('aria-disabled',String(!respinEnabled));
 if(dialArtwork){lastDialMode=s.dialMode;let angle=dialRotation;dialArtwork.setAttribute('transform','rotate('+angle+' 780.6 1142.2)');dialArtwork.style.transition=animateDial&&!dragging?'transform .18s ease':'none';}
 lamp('finish',s.phase==='finished');lamp('pint',s.error==='pint',true);lamp('blade',s.error==='blade',true);lamp('retract',false);
 wait.style.display=['needHome','retracting'].includes(s.phase)?'block':'none';wait.style.animation=s.phase==='needHome'?'blink 1s steps(1) infinite':'none';
 let digit=null;if(s.on){if(s.phase==='error')digit='F';else if(['needHome','retracting','pending'].includes(s.phase))digit='-';else if(s.phase==='running')digit=String(Math.max(1,Math.min(9,Math.ceil(s.left/60))));else if(s.phase==='setup'&&selected)digit=s.mode===null?'-':String(Math.max(1,s.kind==='respin'?2:s.minutes));}
 number(digit);lamp('minute',ready&&s.mode!==null&&s.phase!=='finished');
 document.querySelector('#status').textContent=labels[s.phase]+'\n'+(s.qty===null?'未选份量':quantities[s.qty])+' · '+(s.mode===null?'未选程序':modes[s.mode])+(s.kind==='respin'?' · RE-SPIN':'')+(s.phase==='running'?'\n演示剩余 '+Math.ceil(s.left)+' 秒 · '+s.timeScale+' 倍速':'');
 for(const [id,key] of [['supply','supply'],['pint-input','pint'],['blade-input','blade'],['home','home']])document.getElementById(id).checked=s[key];
 localStorage.setItem(KEY+'-memory',JSON.stringify(s.memory));
 
 const toast=document.querySelector('#toast');
 const messages={error:'',needHome:'',retracting:'',pending:'安装已恢复；中断后的恢复策略尚未确认，请由用研在控制页重置 Demo。'};
 toast.textContent='';toast.hidden=true;
 wait.setAttribute('aria-hidden',String(!['needHome','retracting'].includes(s.phase)));
 for(const [id,enabled]of [['power',s.supply],['start',s.on&&['setup','running','needHome'].includes(s.phase)],['mix',s.on&&['setup','finished'].includes(s.phase)],['respin',s.phase==='finished'],['dial',true],...[0,1,2,3].map(i=>['qty'+i,s.on&&['setup','finished'].includes(s.phase)])]){const h=document.getElementById('hot-'+id);if(h){const available=enabled&&isActive&&networkReady;h.style.pointerEvents=available?'all':'none';h.setAttribute('aria-disabled',String(!available));h.setAttribute('tabindex',available?'0':'-1');}}
 svg.style.visibility=networkReady?'visible':'hidden';svg.dataset.phase=s.phase;
}
function hot(id,label,x,y,w,h,fn){const r=document.createElementNS(NS,'rect');Object.entries({id:'hot-'+id,x,y,width:w,height:h,rx:Math.min(w,h)/2,class:'hot',role:'button',tabindex:0,'aria-label':label}).forEach(([k,v])=>r.setAttribute(k,v));r.addEventListener('click',()=>action(label,fn));r.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();action(label,fn);}});svg.append(r);return r;}
[480.5,680.5,880.5,1080.5].forEach((x,i)=>hot('qty'+i,'选择 '+quantities[i],x-69,543,138,138,()=>machine.selectQty(i)));
const coords=[[476,1065],[552,905],[700,825],[858,825],[1003,905],[1080,1065],[1080,1225],[476,1225]];
coords.forEach(([x,y],i)=>hot('mode'+i,'选择 '+modes[i],x-77,y-65,154,130,()=>machine.selectMode(i)));
hot('mix','选择 MIX-IN',460,1420,110,140,()=>machine.selectMode(8));hot('respin','选择 RE-SPIN',990,1420,120,140,()=>machine.respin());hot('power','电源',682,1430,196,132,()=>machine.power());
hot('start','启动／停止',668,1023,237,239,()=>machine.start());
const ring=hot('dial','旋钮',607,968,350,350,()=>{});svg.insertBefore(ring,document.querySelector('#hot-start'));ring.setAttribute('fill-rule','evenodd');
function rotate(delta){if(!networkReady||!isActive)return;const order=[7,0,1,2,3,4,5,6];const index=order.indexOf(machine.dialMode);const next=((index+delta)%order.length+order.length)%order.length;const mode=order[next];dialRotation+=delta*30;action('选择旋钮模式',()=>{if(['setup','finished'].includes(machine.phase)&&machine.on)machine.selectMode(mode);else machine.dialMode=mode;});}

let dragging=false,lastAngle=0,acc=0,dragPointer=null;
function endDrag(){dragging=false;dragPointer=null;acc=0;}
window.addEventListener('pointerup',endDrag);window.addEventListener('pointercancel',endDrag);window.addEventListener('blur',endDrag);document.addEventListener('visibilitychange',()=>{if(document.hidden)endDrag();});ring.addEventListener('lostpointercapture',endDrag);
function angle(e){let b=svg.getBoundingClientRect();let vb=svg.viewBox.baseVal;let scale=Math.min(b.width/vb.width,b.height/vb.height);let ox=(b.width-vb.width*scale)/2,oy=(b.height-vb.height*scale)/2;return Math.atan2((e.clientY-b.top-oy)/scale-1143,(e.clientX-b.left-ox)/scale-782);}
ring.addEventListener('pointerdown',e=>{if(e.button!==0||!isActive)return;dragPointer=e.pointerId;dragging=true;lastAngle=angle(e);acc=0;ring.setPointerCapture(e.pointerId)});ring.addEventListener('pointermove',e=>{if(!dragging||e.pointerId!==dragPointer)return;if(e.pointerType==='mouse'&&(e.buttons&1)===0){endDrag();return;}let a=angle(e),d=a-lastAngle;if(d>Math.PI)d-=2*Math.PI;if(d< -Math.PI)d+=2*Math.PI;acc+=d;lastAngle=a;if(Math.abs(acc)>.35){rotate(acc>0?1:-1);acc=0;}});ring.addEventListener('pointerup',()=>dragging=false);ring.addEventListener('pointercancel',()=>dragging=false);ring.addEventListener('keydown',e=>{if(['ArrowRight','ArrowLeft'].includes(e.key)){e.preventDefault();rotate(e.key==='ArrowRight'?1:-1);}});
document.querySelector('#tools').style.display='none';
function command(c){if(c.action==='sensor'){machine.sensor(c.key,c.value);if(c.value&&['pint','blade'].includes(c.key)&&!machine.error){notice='';noticeUntil=0;}record('用研设置 '+c.key+'：'+c.value);}else if(c.action==='reset'){machine=new Machine();history=[];record('用研重置');}else if(c.action==='speed'){machine.timeScale=Number(c.value);}else if(c.action==='preset'){const dial=machine.dialMode;machine=new Machine(machine.memory);machine.dialMode=dial;machine.mode=dial;Object.assign(machine,c.values);record('场景已布置，等待用户操作');}render();}
async function receive(){if(syncBusy)return;syncBusy=true;try{const claim=await roomFetch('/api/claim',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId})}).then(r=>r.json());const wasActive=isActive;isActive=claim.active;if(!networkReady||!isActive||!wasActive){const firstLoad=!networkReady;if(claim.state)hydrate(claim.state);if(resetOnAcquire&&isActive){resetOnAcquire=false;const physical={supply:machine.supply,pint:machine.pint,blade:machine.blade,home:machine.home};machine=new Machine();Object.assign(machine,physical);history=[];lastDialMode=7;animateDial=false;commandSeq=claim.seq;}networkReady=true;}if(isActive){const data=await roomFetch('/api/sync',{cache:'no-store'}).then(r=>r.json());if(commandSeq>data.seq)commandSeq=0;for(const c of data.commands){if(c.seq>commandSeq){command(c);commandSeq=c.seq;}}const result=await roomFetch('/api/state',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...machine,minutes:machine.minutes,history,ackSeq:commandSeq,clientId})}).then(r=>r.json());if(!result.ok)isActive=false;}render();}catch(e){isActive=false;notice='与电脑服务连接中断，请检查 Wi-Fi。';noticeUntil=performance.now()+2000;console.warn('联动连接失败',e);}finally{syncBusy=false;}}
setInterval(receive,250);receive();
let last=performance.now();setInterval(()=>{let now=performance.now(),before=machine.phase;if(networkReady&&isActive)machine.tick((now-last)/1000);last=now;if(before!==machine.phase)record(labels[before]+' → '+labels[machine.phase]);render();},100);
render();
