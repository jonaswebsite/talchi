const $=id=>document.getElementById(id);
let me=null, conversations=[], current=null, filter="all", chats=[];
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200)}
async function api(url,opts={}){const r=await fetch(url,{credentials:"same-origin",headers:{"Content-Type":"application/json",...(opts.headers||{})},...opts});const data=await r.json().catch(()=>({}));if(!r.ok){const error=new Error(data.error||"Etwas ist schiefgelaufen.");error.data=data;throw error;}return data}
function authScreen(mode="login",error="",pendingEmail=""){
  const isVerify = mode === "verify";
  const isRegister = mode === "register";
  $("mainApp").style.display="none";
  $("authRoot").innerHTML=`
<div class="auth-screen"><div class="auth-card">
<div class="auth-brand"><div class="brand-mark">T</div><div><b>TALCHI</b><small>Talk + Chat</small></div></div>
<h1>${isVerify?"Bestätige deine E-Mail":(mode==="login"?"Willkommen zurück!":"Erstelle dein TALCHI-Konto")}</h1>
<p>${isVerify?"Wir haben einen sechsstelligen Code an deine E-Mail-Adresse gesendet.": "Chatte mit Menschen über ihren Benutzernamen. Eine Telefonnummer brauchst du nicht."}</p>
${isVerify?"":'<div class="auth-tabs"><button id="tabLogin" class="'+(mode==="login"?"active":"")+'">Anmelden</button><button id="tabRegister" class="'+(mode==="register"?"active":"")+'">Registrieren</button></div>'}
<form id="authForm" class="auth-form">
${isVerify
  ? '<label>E-Mail-Adresse<input name="email" type="email" value="'+escapeHtml(pendingEmail)+'" readonly required></label><label>6-stelliger Code<input name="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="123456" required></label>'
  : (isRegister?'<label>Anzeigename<input name="displayName" maxlength="40" placeholder="Dein Name" required></label><label>Benutzername<input name="username" maxlength="24" placeholder="z. B. jonas123" pattern="[A-Za-z0-9_]{3,24}" required></label>':'')
    + '<label>'+(mode==="login"?"E-Mail oder Benutzername":"E-Mail-Adresse")+'<input name="login" type="'+(mode==="login"?"text":"email")+'" placeholder="'+(mode==="login"?"name oder @benutzername":"du@example.com")+'" required></label><label>Passwort<input name="password" type="password" minlength="8" placeholder="Mindestens 8 Zeichen" required></label>'
    + (isRegister?'<label>Telefonnummer (optional)<input name="phone" type="tel" placeholder="Kann leer bleiben"></label>':'')}
<p class="auth-error">${escapeHtml(error)}</p><button class="primary" type="submit">${isVerify?"Code bestätigen":(mode==="login"?"Anmelden":"Konto erstellen")}</button>
</form>
${isVerify?'<button type="button" class="resend-code" id="resendCode">Code erneut senden</button>':""}
<p class="auth-foot">${isVerify?"Der Code ist 10 Minuten gültig. Prüfe auch deinen Spam-Ordner.":"Deine Telefonnummer ist optional und wird anderen Nutzern nicht angezeigt."}</p>
</div></div>`;
  if (!isVerify) {
    $("tabLogin").onclick=()=>authScreen("login");
    $("tabRegister").onclick=()=>authScreen("register");
  }
  $("authForm").onsubmit=async e=>{
    e.preventDefault();
    const f=new FormData(e.target);
    try {
      if (isVerify) {
        await api("/api/verify-email",{method:"POST",body:JSON.stringify({email:f.get("email"),code:f.get("code")})});
        await boot();
        return;
      }
      const payload=mode==="login"
        ? {login:f.get("login"),password:f.get("password")}
        : {displayName:f.get("displayName"),username:f.get("username"),email:f.get("login"),password:f.get("password"),phone:f.get("phone")};
      const result=await api("/api/"+(mode==="login"?"login":"register"),{method:"POST",body:JSON.stringify(payload)});
      if (result.verificationRequired) {
        authScreen("verify","",result.email);
        return;
      }
      await boot();
    } catch(err) {
      if (mode==="login" && err.message==="E-Mail noch nicht bestätigt.") {
        authScreen("verify","",err.data?.email || f.get("login"));
      } else {
        authScreen(mode,err.message,pendingEmail);
      }
    }
  };
  if (isVerify) {
    $("resendCode").onclick=async()=>{
      try {
        await api("/api/resend-code",{method:"POST",body:JSON.stringify({email:pendingEmail})});
        toast("Falls ein offenes Konto besteht, wurde ein neuer Code gesendet.");
      } catch(err) { toast(err.message); }
    };
  }
}
async function boot(){try{const d=await api("/api/me");me=d.user;$("authRoot").innerHTML="";$("mainApp").style.display="grid";const profile=$("myProfile");profile.querySelector("b").textContent=me.displayName;profile.querySelector("small").textContent="@"+me.username+" · online";profile.querySelector(".avatar").textContent=me.displayName[0].toUpperCase();profile.querySelector(".dots").onclick=async()=>{if(confirm("Von TALCHI abmelden?")){await api("/api/logout",{method:"POST"});authScreen()}};await loadChats()}catch(e){authScreen()}}
async function loadChats(){const d=await api("/api/conversations");conversations=d.conversations;chats=conversations.map(c=>({id:c.id,name:c.is_group?c.title:(c.other_user?.displayName||"Chat"),username:c.other_user?.username,initial:(c.is_group?c.title:c.other_user?.displayName||"C")?.[0]?.toUpperCase()||"C",preview:c.last_message||"Noch keine Nachrichten",time:c.last_at?new Date(c.last_at).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"}):"",unread:0,group:c.is_group}));renderList()}
function renderList(){const q=$("searchInput").value.toLowerCase();const list=$("chatList");list.innerHTML="";chats.filter(c=>(filter==="all"||(filter==="groups"&&c.group))&&((c.name||"").toLowerCase().includes(q)||(c.username||"").toLowerCase().includes(q)||(c.preview||"").toLowerCase().includes(q))).forEach(c=>{const el=document.createElement("div");el.className="chat-item"+(String(current)===String(c.id)?" selected":"");el.innerHTML=`<div class="avatar">${escapeHtml(c.initial)}</div><div class="chat-meta"><div class="chat-line"><b>${escapeHtml(c.name)}</b><small>${escapeHtml(c.time)}</small></div><span class="preview">${escapeHtml(c.username?"@"+c.username+" · ":"")}${escapeHtml(c.preview)}</span></div></div>`;el.onclick=()=>openChat(c.id);list.appendChild(el)})}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
async function openChat(id){current=id;const c=chats.find(x=>String(x.id)===String(id));$("welcome").classList.add("hidden");$("conversation").classList.remove("hidden");$("headerName").textContent=c.name;$("headerAvatar").textContent=c.initial;$("headerStatus").textContent=c.username?"@"+c.username:"Gruppe";renderList();await renderMessages()}
async function renderMessages(){const box=$("messages");box.innerHTML='<div class="day-label">NACHRICHTEN</div>';const d=await api("/api/conversations/"+current+"/messages");d.messages.forEach(m=>{const el=document.createElement("div");el.className="message"+(m.mine?" mine":"");el.innerHTML=`${escapeHtml(m.text)}<time>${new Date(m.time).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})}</time>`;box.appendChild(el)});box.scrollTop=box.scrollHeight}
async function send(text){if(!current||!text.trim())return;await api("/api/conversations/"+current+"/messages",{method:"POST",body:JSON.stringify({body:text.trim()})});await renderMessages();await loadChats()}
async function newChat(){const q=prompt("Suche nach Anzeigename oder Benutzername (z. B. @jonas123):");if(!q||q.trim().length<2)return;try{const d=await api("/api/users?q="+encodeURIComponent(q.trim()));if(!d.users.length)return toast("Keine passenden Nutzer gefunden.");const options=d.users.map((u,i)=>(i+1)+". "+u.displayName+" (@"+u.username+")").join("\n");const pick=Number(prompt("Wen möchtest du anschreiben?\n"+options,"1"));if(!Number.isInteger(pick)||pick<1||pick>d.users.length)return;const c=await api("/api/conversations",{method:"POST",body:JSON.stringify({userId:d.users[pick-1].id})});await loadChats();await openChat(c.id)}catch(e){toast(e.message)}}
function showPeopleSearch(){newChat()}
$("messageForm").addEventListener("submit",async e=>{e.preventDefault();const input=$("messageInput");const value=input.value;input.value="";try{await send(value)}catch(err){toast(err.message);input.value=value}});
$("searchInput").addEventListener("input",renderList);
document.querySelectorAll("[data-filter]").forEach(b=>b.addEventListener("click",()=>{filter=b.dataset.filter;document.querySelectorAll(".action").forEach(x=>x.classList.toggle("active",x===b));renderList()}));
$("newChat").onclick=$("welcomeNew").onclick=newChat;
$("emojiBtn").onclick=()=>{$("messageInput").value+=" 😊";$("messageInput").focus()};
$("attachBtn").onclick=()=>toast("Dateianhänge kommen später.");
boot();
