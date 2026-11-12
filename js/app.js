(function(){
var zm=[],zs=[],N=16,i;
for(i=0;i<=N;i++){zm.push((i%2?'calc(100% - 7px)':'100%')+' '+(i/N*100)+'%');}
for(i=N;i>=0;i--){zs.push((i%2?'7px':'0')+' '+(i/N*100)+'%');}
document.documentElement.style.setProperty('--zm','polygon(0 0,'+zm.join(',')+',0 100%)');
document.documentElement.style.setProperty('--zs','polygon(100% 0,100% 100%,'+zs.join(',')+')');

var $=function(s){return document.querySelector(s)};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
var pad=function(n){return String(n||0).padStart(4,'0')};
var fmt=function(t){var d=new Date(t);return (d.getMonth()+1)+'/'+d.getDate()+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')};
var filt='',db=null,user=null,cfg=null,evs={},evl=[],evR=false,tickets=[],cfgR=false,tR=false,failed=false,tearing=false,pending=null;
var rid=function(){return 't-'+Math.random().toString(36).slice(2,10).padEnd(8,'0')};
var isEditor=function(){try{return !!(user&&user.canEdit())}catch(e){return false}};
var isOwner=function(){try{return !!(user&&user.isOwner())}catch(e){return false}};
function toast(m){var t=$('#toast');t.textContent=m;t.classList.add('on');setTimeout(function(){t.classList.remove('on')},2200)}
async function sha(salt,p){try{var b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt+':'+p));return Array.from(new Uint8Array(b)).map(function(x){return x.toString(16).padStart(2,'0')}).join('')}catch(e){var h=5381,s=salt+p;for(var k=0;k<s.length;k++)h=((h*33)^s.charCodeAt(k))>>>0;return 'f'+h.toString(16)}}

function fmtDate(d,t){if(!d)return '';var p=d.split('-'),w=['SUN','MON','TUE','WED','THU','FRI','SAT'][new Date(+p[0],+p[1]-1,+p[2]).getDay()];return p[0]+'.'+p[1]+'.'+p[2]+' '+w+(t?' '+t+' OPEN':'')}
var lastIssued=null;
function issuedCard(){var t=lastIssued&&tickets.filter(function(x){return x.id===lastIssued})[0];if(!t)return '';return '<div class="card" style="border-color:var(--rose)"><b>♠ 発行しました No.'+pad(t.no)+'</b><div class="share" style="margin-top:8px"><input readonly value="'+esc(shareURL(t.id))+'"><button class="ghost" data-cu="'+esc(t.id)+'">URLコピー</button></div><p class="note">'+esc(t.recipient)+' さん宛てのチケットURLです。1枚ずつ渡してください。</p></div>'}
function tearCard(){return '<h2>✂ もぎりカウンター</h2><div class="card"><label>チケット番号</label><div class="share"><input id="tn" inputmode="numeric" placeholder="例: 12"><button class="ghost" id="tg">もぎる</button></div><p class="note">画面を見せてもらえないときは、番号からもぎれます。パスワードが必要です。</p></div>'}
var peek={};
function saveWallet(id){try{var w=JSON.parse(localStorage.getItem('uka-wallet')||'[]');if(w.indexOf(id)<0){w.push(id);localStorage.setItem('uka-wallet',JSON.stringify(w))}}catch(e){}}
function walletHTML(){var w=[];try{w=JSON.parse(localStorage.getItem('uka-wallet')||'[]')}catch(e){}
  var s='';w.slice().reverse().forEach(function(id){var t=tickets.filter(function(x){return x.id===id})[0],v=t&&evOf(t);if(!v)return;
    s+='<div class="card"><div class="row" style="border:0;padding:0"><span class="n">'+pad(t.no)+'</span><span class="w"><b>'+esc(v.title)+'</b><br><span class="note">'+esc(t.kind)+' ／ '+esc(t.cos||'コスネーム未記入')+'</span></span><span class="tag'+(t.tornAt?' on':'')+'">'+(t.tornAt?'入場済':'未入場')+'</span><button class="ghost" data-wt="'+esc(id)+'">開く</button></div></div>'});
  return s||'<div class="card"><p class="note">まだチケットがありません。受け取ったチケットのURLを開くと、ここに保存されます。</p></div>'}
function receiveHTML(t){var v=evOf(t);return '<h2>♦ チケットが届きました</h2><div class="card" style="text-align:center"><div class="orn">♠ ♦ ♣ ♥</div><div class="ev" style="font-size:2rem">'+esc(v.title)+'</div><div class="sub">'+esc(v.date)+'<br>'+esc(v.venue)+'</div><p>区分：<b>'+esc(t.kind)+'</b>　No. <b>'+pad(t.no)+'</b></p><label>コスネームを記入してください</label><input id="rn" maxlength="30" value="'+esc(t.cos||'')+'" placeholder="コスネーム"><button id="rg">チケットを受け取る</button><p class="note">受け取るとチケットと控え（STUB）が表示されます。控えは本人確認に使えます。</p></div>'}
function evOf(t){return evs[t.eventId||'main']}
function evTickets(){var h=(location.hash||'').slice(1);return tickets.filter(function(t){return (t.eventId||'main')===h})}
function rebuild(){evs={};evl.forEach(function(x){evs[x.id]=x});if(cfg&&!evs.main)evs.main=Object.assign({id:'main'},cfg)}
function ticketHTML(t){
  var torn=!!t.tornAt, c=evOf(t)||{};
  return '<div class="stage"><div class="ticket'+(torn?' torn':'')+'" data-id="'+esc(t.id)+'" role="button" tabindex="0" aria-label="チケット">'+
  '<div class="main-t"><div class="orn">♠ ♦ ♣ ♥</div><div class="ev">'+esc(c.title)+'</div><div class="sub">COSPLAY EVENT · ADMIT ONE</div>'+
  '<div class="nm">'+esc(t.cos||'— コスネーム未記入 —')+'</div><div class="sub">'+esc(t.kind)+'</div>'+
  '<div class="meta">'+esc(c.date)+'<br>'+esc(c.venue)+'</div><div class="no">No. '+pad(t.no)+'</div>'+
  (torn?'<div class="stamp">入場済<small>'+fmt(t.tornAt)+'</small></div>':'')+'</div>'+
  '<div class="stub"><small>STUB</small><b>控え・'+esc(t.cos||'未記入')+'</b><i>'+pad(t.no)+'</i></div></div></div>';
}
function shareURL(id){return location.href.split('#')[0]+'#'+id}

function render(){
  var app=$('#app'),h=(location.hash||'').slice(1);
  var nv=$('#nav');if(nv){var gs=h==='my'||h.indexOf('t-')===0;nv.innerHTML=isEditor()?'<a href="#"'+(gs?'':' class="on"')+'>♠ ホスト管理</a><a href="#my"'+(gs?' class="on"':'')+'>♥ マイチケット</a>':'';nv.style.display=isEditor()?'flex':'none'}
  var hp=document.querySelector('header p');if(hp){var gst=h==='my'||h.indexOf('t-')===0;hp.textContent=gst?'GUEST ENTRANCE · YOUR TICKET':'HOST BACKSTAGE · E-TICKET';document.title=gst?'uka — マイチケット':'uka — ホスト管理'}
  if(failed){app.innerHTML='<div class="card"><p>♠ 接続できませんでした。</p><p class="note">サインインした状態でこのページを開いてください（共有リンクを開いた場合はサインインが必要です）。</p></div>';return}
  if(!(cfgR&&tR&&evR)){app.innerHTML='<p class="note" style="text-align:center">♠ 幕を開けています… ♠</p>';return}
  if(h==='my'){app.innerHTML='<h2>♠ マイチケット</h2><p class="note">受け取ったチケットをここから開けます。チケットURLを開いた端末に保存されます。</p>'+walletHTML()+(isEditor()?'<p><a href="#">← ホスト管理へ</a></p>':'');return}
  if(h.indexOf('t-')===0){
    var t=tickets.filter(function(x){return x.id===h})[0];
    if(!t||!evOf(t)){app.innerHTML='<div class="card"><p>♠ このチケットは見つかりませんでした。</p><p><a href="#">トップへ</a></p></div>';return}
    saveWallet(t.id);if(!t.receivedAt&&!t.tornAt&&!peek[t.id]){app.innerHTML=receiveHTML(t);return}
    app.innerHTML='<h2>♦ あなたのチケット</h2>'+ticketHTML(t)+
    '<p class="note" style="text-align:center">'+(t.tornAt?'入場済です。切り離された控え（STUB）は本人確認用に画面を保管してください。':'入口でチケットをタップ → スタッフがパスワードを入力するともぎられます。')+'</p>'+
    (t.tornAt?'':'<h2>♥ コスネーム記入</h2><div class="card"><input id="cn" maxlength="30" value="'+esc(t.cos||'')+'" placeholder="コスネームを記入"><button id="cs">記入する</button><p class="note">チケットに表示される名前です。もぎり前なら書き直せます。</p></div>')+
    '<h2>♣ このチケットのURL</h2><div class="card"><div class="share"><input id="u" readonly value="'+esc(shareURL(t.id))+'"><button id="cp">コピー</button></div><p class="note">URLを知っている人はこのチケットを表示できます。本人以外には渡さないでください。</p></div>'+
    (isEditor()?'<p><a href="#'+esc(t.eventId||'main')+'">← 管理画面へ</a></p>':'');
    $('#cp').onclick=function(){var u=$('#u');u.select();var ok=false;try{ok=document.execCommand('copy')}catch(e){}
      if(navigator.clipboard){navigator.clipboard.writeText(u.value).then(function(){toast('URLをコピーしました')},function(){toast(ok?'URLをコピーしました':'URLを選択しました')})}else toast(ok?'URLをコピーしました':'URLを選択しました')};
    return;
  }
  var e=h&&evs[h];
  if(h&&!e){app.innerHTML='<div class="card"><p>♠ イベントが見つかりませんでした。</p><p><a href="#">トップへ</a></p></div>';return}
  var s='';
  if(!e){
    s='<h2>♠ イベント一覧</h2><div class="card"><b>♥ お客さん用ページ（受け取り側）</b><div class="share" style="margin-top:8px"><input readonly value="'+esc(shareURL('my'))+'"><button class="ghost" data-cu="my">URLコピー</button></div><p class="note">ホスト管理とは別ページです。<a href="#my">開いて確認する</a></p></div>';
    if(!isEditor()){s='<h2>♠ マイチケット</h2>'+walletHTML()}
    else{
      var ids=Object.keys(evs);
      if(!ids.length)s+='<div class="card"><p class="note">まだイベントがありません。下のフォームから作成してください。</p></div>';
      ids.forEach(function(id){var v=evs[id],ts=tickets.filter(function(x){return (x.eventId||'main')===id});
        s+='<div class="card"><div class="row" style="border:0;padding:0"><span class="w"><b>'+esc(v.title)+'</b><br><span class="note">'+esc(v.date)+' '+esc(v.venue)+'</span></span><span class="tag">発行 '+ts.length+'</span><span class="tag on">入場 '+ts.filter(function(x){return x.tornAt}).length+'</span><button class="ghost" data-ev="'+esc(id)+'">開く</button></div></div>'});
      s+='<h2>♦ 新しいイベントを作る</h2><div class="card"><label>イベント名</label><input id="s-t" value="uka"><label>開催日（カレンダーから選択）／ 開場時間（任意）</label><div class="share"><input id="s-d" type="date"><input id="s-tm" type="time"></div><label>会場</label><input id="s-v" placeholder="例: ○○ホール"><label>このイベントのもぎり用パスワード（ホストが決めます）</label><input id="s-p" type="password" autocomplete="new-password"><label>パスワード（確認）</label><input id="s-p2" type="password" autocomplete="new-password"><p class="note">イベントごとに別のパスワードを設定できます。</p><button id="s-go">イベントを作成</button><div class="note" id="s-m" style="color:var(--rose)"></div></div>';
    }
    app.innerHTML=s;
    var sg=$('#s-go');
    if(sg)sg.onclick=async function(){
      var p=$('#s-p').value,m=$('#s-m');
      if(p.length<4){m.textContent='パスワードは4文字以上にしてください';return}
      if(p!==$('#s-p2').value){m.textContent='確認用パスワードが一致しません';return}
      var salt=Math.random().toString(36).slice(2),id='e-'+Math.random().toString(36).slice(2,8).padEnd(6,'0');
      try{await db.doc('events/'+id).set({title:$('#s-t').value.trim()||'uka',date:fmtDate($('#s-d').value,$('#s-tm').value),venue:$('#s-v').value.trim(),salt:salt,hash:await sha(salt,p),createdAt:Date.now()});location.hash=id;toast('作成しました')}catch(err){m.textContent='保存できませんでした：'+(err.message||err.code||'')}
    };
    app.querySelectorAll('[data-ev]').forEach(function(b){b.onclick=function(){location.hash=b.getAttribute('data-ev')}});
    return;
  }
  var ts=evTickets(),torn=ts.filter(function(x){return x.tornAt}).length;
  s='<p><a href="#">← イベント一覧</a></p><h2>♥ '+esc(e.title)+'</h2><div class="card"><div class="meta">'+esc(e.date)+'<br>'+esc(e.venue)+'</div></div><div class="count"><div><b>'+ts.length+'</b><span class="note">発行</span></div><div><b>'+torn+'</b><span class="note">入場済</span></div></div>';
  if(isEditor()){
    s+='<h2>♦ 区分別</h2><div class="count">'+['出演者','カメラマン','観客'].map(function(k){var a=ts.filter(function(x){return x.kind===k});return '<div><b>'+a.length+'</b><span class="note">'+k+'<br>入場 '+a.filter(function(x){return x.tornAt}).length+'</span></div>'}).join('')+'</div>';
    s+='<h2>♠ チケット発行（番号は自動で連番）</h2><div class="card"><label>区分</label><select id="i-k"><option>出演者</option><option>カメラマン</option><option>観客</option></select><label>渡し先（誰に渡したか）</label><input id="i-n" placeholder="例: 山田さん／サークル名など"><label>コスネーム（わかれば。本人が後から記入も可）</label><input id="i-c" maxlength="30"><button id="i-go">発行する</button><div class="note" id="i-m" style="color:var(--rose)"></div></div>'+issuedCard()+tearCard()+'<h2>♣ 発行済み</h2><div class="card"><div class="share" style="margin-bottom:8px"><select id="f-k"><option value="">すべての区分</option>'+['出演者','カメラマン','観客'].map(function(k){return '<option'+(filt===k?' selected':'')+'>'+k+'</option>'}).join('')+'</select><button class="ghost" id="csv">CSV保存</button></div>';
    if(!ts.length)s+='<p class="note">まだチケットはありません。</p>';
    ts.filter(function(x){return !filt||x.kind===filt}).forEach(function(x){s+='<div class="row"><span class="n">'+pad(x.no)+'</span><span class="tag">'+esc(x.kind)+'</span><span class="w">'+esc(x.recipient||x.name)+'<br><span class="note">コスネーム: '+esc(x.cos||'未記入')+' ／ '+(x.receivedAt?'受取済':'未受取')+'</span></span><span class="tag'+(x.tornAt?' on':'')+'">'+(x.tornAt?'入場済':'未入場')+'</span><button class="ghost" data-cu="'+esc(x.id)+'">URLコピー</button>'+(x.tornAt?'':'<button class="ghost" data-tear="'+esc(x.id)+'">✂ もぎる</button>')+'<button class="ghost" data-open="'+esc(x.id)+'">開く</button></div>'});
    s+='</div>';
  } else s+='<div class="card"><p class="note">お手元のチケットURLからアクセスしてください。</p></div>';
  app.innerHTML=s;
  var go=$('#i-go');
  if(go)go.onclick=async function(){
    var n=$('#i-n').value.trim(),m=$('#i-m');if(!n){m.textContent='渡し先を入力してください';return}
    var no=ts.reduce(function(a,x){return Math.max(a,x.no||0)},0)+1,id=rid();
    try{await db.doc('tickets/'+id).set({eventId:h,no:no,recipient:n,cos:$('#i-c').value.trim(),kind:$('#i-k').value,tornAt:null,createdAt:Date.now()});lastIssued=id;render()}catch(err){m.textContent='発行できませんでした：'+(err.message||err.code||'')}
  };
  app.querySelectorAll('[data-open]').forEach(function(b){b.onclick=function(){location.hash=b.getAttribute('data-open')}});
}

/* tear-off */
document.addEventListener('click',function(e){var t=e.target.closest&&e.target.closest('.ticket');if(!t||t.classList.contains('torn'))return;pending=t;$('#pw').value='';$('#pmsg').textContent='';$('#modal').classList.add('on');setTimeout(function(){$('#pw').focus()},50)});
document.addEventListener('keydown',function(e){if((e.key==='Enter'||e.key===' ')&&document.activeElement&&document.activeElement.classList.contains('ticket')){e.preventDefault();document.activeElement.click()}});
$('#pno').onclick=function(){$('#modal').classList.remove('on');pending=null};
$('#pw').addEventListener('keydown',function(e){if(e.key==='Enter')$('#pok').click()});
$('#pok').onclick=async function(){
  var el=pending,msg=$('#pmsg'),box=$('#modal .box');var tk=tickets.filter(function(x){return x.id===(el&&el.getAttribute('data-id'))})[0],ev=tk&&evOf(tk);if(!el||!ev)return;
  var ok=(await sha(ev.salt,$('#pw').value))===ev.hash;
  if(!ok){msg.textContent='パスワードが違います';box.classList.remove('shake');void box.offsetWidth;box.classList.add('shake');return}
  $('#modal').classList.remove('on');
  tearing=true;el.classList.add('torn','fresh');
  try{await db.doc('tickets/'+el.getAttribute('data-id')).update({tornAt:Date.now()});toast('もぎりました ✂')}
  catch(err){el.classList.remove('torn','fresh');toast('この端末では書き込めません。スタッフ用アカウントで開いてください');tearing=false;return}
  setTimeout(function(){tearing=false;render()},1300);pending=null;
};
document.addEventListener('click',async function(e){var b=e.target.closest&&e.target.closest('#cs');if(!b)return;var h=(location.hash||'').slice(1),v=$('#cn').value.trim();if(!v){toast('コスネームを入力してください');return}
  try{await db.doc('tickets/'+h).update({cos:v});toast('記入しました')}catch(err){toast('この端末では書き込めません。ホストに書き込み権限（Contributor）を依頼してください')}});
document.addEventListener('change',function(e){if(e.target&&e.target.id==='f-k'){filt=e.target.value;render()}});
document.addEventListener('click',async function(e){var b=e.target.closest&&e.target.closest('#csv');if(!b)return;
  var q=function(v){return '"'+String(v==null?'':v).replace(/"/g,'""')+'"'};
  var rows=[['番号','区分','渡し先','コスネーム','入場','入場時刻','URL']].concat(evTickets().map(function(x){return [pad(x.no),x.kind,x.recipient||x.name||'',x.cos||'',x.tornAt?'入場済':'未入場',x.tornAt?fmt(x.tornAt):'',shareURL(x.id)]}));
  var csv='\ufeff'+rows.map(function(r){return r.map(q).join(',')}).join('\r\n');
  try{var d=await claude.use('downloads');if(!d)throw 0;await d.save({filename:'tickets-'+(location.hash||'#all').slice(1)+'.csv',data:csv});toast('CSVを保存しました')}catch(err){if(!err||err.code!=='declined')toast('この環境ではCSVを保存できません')}});
function askTear(id){pending={getAttribute:function(){return id},classList:{add:function(){},remove:function(){}}};$('#pw').value='';$('#pmsg').textContent='';$('#modal').classList.add('on');setTimeout(function(){$('#pw').focus()},50)}
document.addEventListener('click',function(e){var c=e.target.closest?e.target:null;if(!c)return;
  var u=c.closest('[data-cu]');if(u){var url=shareURL(u.getAttribute('data-cu'));if(navigator.clipboard)navigator.clipboard.writeText(url).then(function(){toast('URLをコピーしました')},function(){toast('コピーできませんでした。チケットを開いてコピーしてください')});else toast('コピーできませんでした。チケットを開いてコピーしてください');return}
  var b=c.closest('[data-tear]');if(b){askTear(b.getAttribute('data-tear'));return}
  if(c.closest('#tg')){var n=parseInt($('#tn').value,10),t=evTickets().filter(function(x){return x.no===n})[0];if(!t){toast('その番号のチケットがありません');return}if(t.tornAt){toast('No.'+pad(n)+' はもぎり済みです');return}askTear(t.id)}});
document.addEventListener('click',function(e){var c=e.target.closest?e.target:null;if(!c)return;
  var w=c.closest('[data-wt]');if(w){location.hash=w.getAttribute('data-wt');return}
  if(c.closest('#rg')){var id=(location.hash||'').slice(1),v=$('#rn').value.trim();if(!v){toast('コスネームを入力してください');return}
    db.doc('tickets/'+id).update({cos:v,receivedAt:Date.now()}).then(function(){toast('受け取りました')},function(){peek[id]=1;render();toast('この端末では保存できません。ホストに書き込み権限を依頼してください')})}});
window.addEventListener('hashchange',function(){tearing=false;render()});

/* init */
(async function(){
  render();
  try{if(window.claude){user=await claude.use('user');db=await claude.use('db')}}catch(e){}
  if(!db){failed=true;render();return}
  setTimeout(function(){if(!(cfgR&&tR&&evR)){failed=true;render()}},10000);
  db.doc('config/main').onSnapshot(function(s){cfg=s.exists?s.data():null;cfgR=true;rebuild();if(!tearing)render()},function(){failed=true;render()});
  db.collection('events').onSnapshot(function(s){evl=s.docs.map(function(d){var o=d.data();o.id=d.id;return o});evR=true;rebuild();if(!tearing)render()},function(){failed=true;render()});
  db.collection('tickets').orderBy('no').onSnapshot(function(s){tickets=s.docs.map(function(d){var o=d.data();o.id=d.id;return o});tR=true;if(!tearing)render()},function(){failed=true;render()});
})();
})();
