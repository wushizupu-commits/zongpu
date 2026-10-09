const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../assets/home-video.js'),'utf8');
class E { constructor(){this.events={};this.style={};this.classList={add(){},remove(){}};} addEventListener(n,f){this.events[n]=f;} focus(){} hasAttribute(){return false;} }
test('两个视频入口每次打开计一次，重复点击、重试及播放事件不增加计数',()=>{
 const dialog=new E(),player=new E(),close=new E(),retry=new E(),error=new E(),buttons=[new E(),new E()],events=[];
 dialog.open=false;dialog.showModal=()=>dialog.open=true;dialog.close=()=>{dialog.open=false;dialog.events.close();};
 dialog.querySelector=s=>({'video':player,'.home-video-close':close,'.home-video-retry':retry,'.home-video-error':error}[s]);
 player.dataset={src:'assets/video/family-introduction.mp4'};player.play=()=>Promise.resolve();player.pause=()=>{};player.load=()=>{};
 const context={URL,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},document:{baseURI:'http://127.0.0.1:3137/site/home.html',body:new E(),documentElement:new E(),getElementById:()=>dialog,querySelectorAll:()=>buttons,dispatchEvent:e=>events.push(e)},window:{scrollX:0,scrollY:0,scrollTo(){},addEventListener(){}}};
 vm.runInNewContext(code,context);const click=b=>b.events.click({currentTarget:b});
 click(buttons[0]);click(buttons[1]);retry.events.click();player.events.playing();assert.equal(events.length,1);
 close.events.click();click(buttons[1]);assert.equal(events.length,2);assert.equal(events[0].type,'zongpu:video-open');assert.equal(events[0].detail.videoId,'family-introduction');
});
