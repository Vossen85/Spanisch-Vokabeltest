(()=>{
  const URL="https://jzolxrqrrljwpmjbdxmo.supabase.co";
  const KEY="sb_publishable_AGUrdmy8nEQZJlPfgd9qbw_J6xkojrj";
  const SCRIPT="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const dateLabel=value=>{const d=new Date(value+"T12:00:00");return new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"2-digit"}).format(d)};
  const inject=()=>{
    if(document.getElementById("avanza-weekly-widget"))return;
    const style=document.createElement("style");
    style.textContent="#avanza-weekly-widget{position:fixed;top:calc(env(safe-area-inset-top,0px) + 10px);right:12px;z-index:10000;font-family:inherit}#avanza-weekly-toggle{border:0;border-radius:999px;padding:11px 16px;min-height:46px;background:linear-gradient(115deg,#0ea5e9,#2563eb 55%,#7c3aed);color:#fff;font:700 14px/1.2 inherit;box-shadow:0 6px 22px rgba(37,99,235,.34);cursor:pointer}#avanza-weekly-toggle:focus-visible{outline:3px solid #facc15;outline-offset:3px}#avanza-weekly-popover{position:absolute;top:calc(100% + 9px);right:0;width:min(330px,calc(100vw - 24px));padding:16px;border:1px solid rgba(148,163,184,.45);border-radius:16px;background:#fff;color:#172033;box-shadow:0 14px 44px rgba(15,23,42,.25)}#avanza-weekly-popover[hidden]{display:none}#avanza-weekly-popover strong{display:block;font-size:1rem;margin-bottom:6px}#avanza-weekly-detail{font-size:.92rem;line-height:1.45;color:#475569}#avanza-weekly-link{display:block;margin-top:12px;padding:11px 13px;border-radius:10px;background:linear-gradient(115deg,#7c3aed,#c026d3);color:#fff;text-align:center;text-decoration:none;font-weight:750}#avanza-weekly-error{margin-top:7px;color:#b91c1c;font-size:.85rem}@media(prefers-color-scheme:dark){#avanza-weekly-popover{background:#1f2937;color:#f8fafc;border-color:#475569}#avanza-weekly-detail{color:#cbd5e1}}@media(max-width:500px){#avanza-weekly-widget{right:9px;top:calc(env(safe-area-inset-top,0px) + 8px)}#avanza-weekly-toggle{padding:10px 13px;font-size:13px}}@media print{#avanza-weekly-widget{display:none!important}}";
    document.head.appendChild(style);
    const box=document.createElement("div");box.id="avanza-weekly-widget";box.hidden=true;
    box.innerHTML='<button id="avanza-weekly-toggle" type="button" aria-expanded="false">⏱ Woche: … Min.</button><div id="avanza-weekly-popover" hidden><strong>Deine Lernzeit diese Woche</strong><div id="avanza-weekly-detail">Wird geladen …</div><div id="avanza-weekly-error"></div><a id="avanza-weekly-link" href="lernfortschritt.html">Wochenbericht öffnen</a></div>';
    document.body.appendChild(box);
    const button=document.getElementById("avanza-weekly-toggle"),popover=document.getElementById("avanza-weekly-popover");
    let client=null,currentData=null,loading=false;
    const render=data=>{
      currentData=data;
      const minutes=Number(data.activeMinutes||0),goal=Number(data.weeklyAssignment?.required_minutes||0);
      button.textContent="⏱ "+minutes+" Min. diese Woche";
      document.getElementById("avanza-weekly-detail").innerHTML="<strong>"+minutes+" Lernminuten</strong>"+(goal?" · Wochenziel: "+goal+" Min.<br>Noch <b>"+Math.max(0,goal-minutes)+" Min.</b> bis zum Ziel.":". Für diese Woche ist kein Wochenziel eingetragen.")+"<br>Woche ab "+dateLabel(data.weekStart)+".";
    };
    const refresh=async()=>{
      if(!client||loading)return;
      loading=true;
      try{
        const {data:sessionData}=await client.auth.getSession();
        if(!sessionData?.session){box.hidden=true;return}
        const {data,error}=await client.functions.invoke("student-progress",{body:{action:"me"}});
        if(error||data?.error)throw new Error(data?.error||error?.message||"Wochenzeit konnte nicht geladen werden.");
        box.hidden=false;document.getElementById("avanza-weekly-error").textContent="";render(data);
      }catch(error){if(currentData){document.getElementById("avanza-weekly-error").textContent=error.message} }
      finally{loading=false}
    };
    button.addEventListener("click",async()=>{
      const opening=popover.hidden;popover.hidden=!opening;button.setAttribute("aria-expanded",String(opening));
      if(opening)await refresh();
    });
    document.addEventListener("click",event=>{if(!box.contains(event.target)&&!popover.hidden){popover.hidden=true;button.setAttribute("aria-expanded","false")}});
    const setup=()=>{
      if(!window.supabase?.createClient)return false;
      client=window.avanzaStudentClient||window.supabase.createClient(URL,KEY,{auth:{storageKey:"avanza-student-auth-token",persistSession:true,autoRefreshToken:true}});
      window.avanzaStudentClient=client;
      void refresh();
      client.auth.onAuthStateChange(()=>setTimeout(refresh,0));
      setInterval(()=>{if(document.visibilityState==="visible")void refresh()},30000);
      return true;
    };
    if(!setup()){
      const script=document.createElement("script");script.src=SCRIPT;script.onload=setup;document.head.appendChild(script);
    }
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",inject,{once:true});else inject();
})();