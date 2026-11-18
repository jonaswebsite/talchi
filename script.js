const starter = [
  {id:1,name:"Mia",initial:"M",color:"pink",preview:"Hey! Wie geht's dir? 😊",time:"12:42",online:true,unread:2,messages:[{text:"Hey! Wie geht's dir? 😊",mine:false,time:"12:40"},{text:"Mir geht's super! Und dir?",mine:true,time:"12:41"},{text:"Auch gut! Was machst du heute?",mine:false,time:"12:42"}]},
  {id:2,name:"Alex",initial:"A",preview:"Alles klar, bis später!",time:"11:18",online:true,unread:0,messages:[{text:"Hast du nachher Zeit?",mine:false,time:"11:15"},{text:"Ja, klar!",mine:true,time:"11:16"},{text:"Alles klar, bis später!",mine:false,time:"11:18"}]},
  {id:3,name:"Freunde 🎉",initial:"F",preview:"Lena: Das wird mega!",time:"Gestern",group:true,unread:0,messages:[{text:"Wer ist heute dabei?",mine:false,time:"Gestern"},{text:"Ich bin dabei! 🎉",mine:true,time:"Gestern"},{text:"Lena: Das wird mega!",mine:false,time:"Gestern"}]},
  {id:4,name:"Papa",initial:"P",preview:"Danke dir ❤️",time:"Mo.",unread:0,messages:[{text:"Bin gleich zuhause.",mine:true,time:"Mo."},{text:"Danke dir ❤️",mine:false,time:"Mo."}]}
];
let chats = JSON.parse(localStorage.getItem("talchi-chats") || "null") || starter;
let current = null, filter = "all";
const $ = id => document.getElementById(id);
function save(){localStorage.setItem("talchi-chats",JSON.stringify(chats))}
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200)}
function renderList(){
 const q=$("searchInput").value.toLowerCase(); const list=$("chatList");list.innerHTML="";
 chats.filter(c=>(filter==="all"||(filter==="unread"&&c.unread)||(filter==="groups"&&c.group))&&(c.name.toLowerCase().includes(q)||c.preview.toLowerCase().includes(q))).forEach(c=>{
  const el=document.createElement("div");el.className="chat-item"+(current===c.id?" selected":"");
  el.innerHTML=`<div class="avatar">${c.initial}</div><div class="chat-meta"><div class="chat-line"><b>${escapeHtml(c.name)}</b><small>${c.time}</small></div><span class="preview">${escapeHtml(c.preview)}</span></div>${c.unread?`<span class="unread">${c.unread}</span>`:""}`;
  el.onclick=()=>openChat(c.id);list.appendChild(el);
 });
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function openChat(id){
 current=id;const c=chats.find(x=>x.id===id);c.unread=0;
 $("welcome").classList.add("hidden");$("conversation").classList.remove("hidden");$("headerName").textContent=c.name;$("headerAvatar").textContent=c.initial;$("headerStatus").textContent=c.online?"online":"zuletzt gesehen";
 renderMessages();renderList();save();
}
function renderMessages(){
 const c=chats.find(x=>x.id===current);const box=$("messages");box.innerHTML='<div class="day-label">HEUTE</div>';
 c.messages.forEach(m=>{const el=document.createElement("div");el.className="message"+(m.mine?" mine":"");el.innerHTML=`${escapeHtml(m.text)}<time>${escapeHtml(m.time)}</time>`;box.appendChild(el)});
 box.scrollTop=box.scrollHeight;
}
function send(text){
 const c=chats.find(x=>x.id===current);if(!c||!text.trim())return;
 const now=new Date().toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"});
 c.messages.push({text:text.trim(),mine:true,time:now});c.preview=text.trim();c.time=now;save();renderMessages();renderList();
}
function newChat(){
 const name=prompt("Wie heißt dein neuer Chat?");
 if(!name||!name.trim())return;
 const id=Date.now();chats.unshift({id,name:name.trim(),initial:name.trim()[0].toUpperCase(),preview:"Neuer Chat",time:"Jetzt",unread:0,online:false,messages:[]});save();renderList();openChat(id);
}
$("messageForm").addEventListener("submit",e=>{e.preventDefault();send($("messageInput").value);$("messageInput").value=""});
$("searchInput").addEventListener("input",renderList);
document.querySelectorAll("[data-filter]").forEach(b=>b.addEventListener("click",()=>{filter=b.dataset.filter;document.querySelectorAll(".action").forEach(x=>x.classList.toggle("active",x===b));renderList()}));
$("newChat").onclick=$("welcomeNew").onclick=newChat;
$("voiceCall").onclick=$("headerVoice").onclick=()=>toast("Sprachanrufe kommen in einer späteren Version.");
$("videoCall").onclick=$("headerVideo").onclick=()=>toast("Videoanrufe kommen in einer späteren Version.");
$("emojiBtn").onclick=()=>{$("messageInput").value+=" 😊";$("messageInput").focus()};
$("attachBtn").onclick=()=>toast("Dateianhänge kommen in einer späteren Version.");
renderList();
