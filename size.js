'use strict';
(()=>{
 const target=15.67,base=target*96/2.54,key='im01-screen-size-v1';
 let factor=1;try{const v=Number(localStorage.getItem(key));if(v>=.1&&v<=10)factor=v;}catch(e){}
 const apply=()=>document.documentElement.style.setProperty('--device-width',base*factor+'px');apply();
 document.addEventListener('DOMContentLoaded',()=>{
  const button=document.createElement('button');button.id='size-settings';button.textContent='尺寸校准';
  const dialog=document.createElement('dialog');dialog.id='size-dialog';dialog.innerHTML='<h2>整机实际宽度 · 15.67 cm</h2><p>用尺子测量屏幕中机器左右外壳最外侧之间的宽度，输入实测厘米数。首次显示按标准网页比例估算，未校准前不保证实际尺寸。</p><form><label for="measured-width">当前实测宽度（cm）</label><input id="measured-width" type="number" min="1" max="100" step="0.01" required placeholder="例如 14.20"><button type="submit">按实测校准</button><button type="button" id="size-reset">恢复默认比例</button><button type="button" id="size-close">关闭</button></form><p id="size-message" role="status"></p><p>校准只保存在当前浏览器。更换屏幕、系统显示缩放或浏览器缩放后，请重新校准。屏幕放不下时可滚动查看，机器不会自动缩小。</p>';
  document.body.append(button,dialog);button.onclick=()=>dialog.showModal();dialog.querySelector('#size-close').onclick=()=>dialog.close();
  dialog.querySelector('form').onsubmit=e=>{e.preventDefault();const measured=Number(dialog.querySelector('input').value),next=factor*target/measured;if(!Number.isFinite(next)||next<.1||next>10){dialog.querySelector('#size-message').textContent='请核对实测宽度。';return;}factor=next;apply();try{localStorage.setItem(key,String(factor));}catch(e){}dialog.querySelector('input').value='';dialog.querySelector('#size-message').textContent='比例已保存，请关闭窗口后再用尺子复核整机宽度为 15.67 cm。';};
  dialog.querySelector('#size-reset').onclick=()=>{factor=1;apply();try{localStorage.removeItem(key);}catch(e){}dialog.querySelector('#size-message').textContent='已恢复未校准的默认比例。';};
 });
})();
