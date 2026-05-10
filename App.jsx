import React, { useState, useEffect, useRef, useMemo } from 'react';

// ── Date / time utilities ──────────────────
const todayStr     = () => new Date().toISOString().slice(0,10);
const fmtTime      = iso => iso ? new Date(iso).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}) : null;
const fmtDate      = iso => iso ? new Date(iso).toLocaleDateString("en-IN",{day:"numeric",month:"short"}) : "";
const todayDisplay = new Date().toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"});

// ══════════════════════════════════════════
//  CONFIG — Firebase + Master Password
// ══════════════════════════════════════════
const FIREBASE_CONFIG = {
  apiKey:"AIzaSyCxGR3OCM3GKJruyWkg9OwV1ar05m6fLp4",
  authDomain:"coating-report.firebaseapp.com",
  databaseURL:"https://coating-report-default-rtdb.firebaseio.com",
  projectId:"coating-report",
  storageBucket:"coating-report.firebasestorage.app",
  messagingSenderId:"757078270026",
  appId:"1:757078270026:web:9dd7dbf186d6f2d41786b3",
};
const MASTER_ADMIN_PASSWORD = "admin@arena";

// ══════════════════════════════════════════
//  SESSION PERSISTENCE
// ══════════════════════════════════════════
const SESSION_KEY = "ct_session";
const SESSION_TTL = 12 * 60 * 60 * 1000;

function saveSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({user, expires: Date.now() + SESSION_TTL}));
}
function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY)||"null");
    if (s && s.expires > Date.now()) return s.user;
    localStorage.removeItem(SESSION_KEY);
  } catch {}
  return null;
}
function clearSession() { localStorage.removeItem(SESSION_KEY); }

// ══════════════════════════════════════════
//  DEFAULT CONFIG
// ══════════════════════════════════════════
const DEFAULT_COLUMNS = [
  {id:"q1tgt",  label:"Q1 TGT",  type:"target", color:"#94a3b8", visible:true, width:8},
  {id:"aprtgt", label:"APR TGT", type:"target", color:"#94a3b8", visible:true, width:8},
  {id:"bkg",    label:"BKG",     type:"manual", color:"#7dd3fc", visible:true, width:10},
  {id:"est",    label:"EST",     type:"manual", color:"#86efac", visible:true, width:10},
  {id:"gap",    label:"GAP",     type:"formula",formula:"aprtgt - est", color:"#fca5a5", visible:true, width:8},
];

const DEFAULT_LOCATIONS = [
  {id:"dariyapur",        name:"Dariyapur",                                     cluster:"Ahmedabad",    q1tgt:21,aprtgt:7 },
  {id:"maninagar",        name:"Maninagar",                                     cluster:"Ahmedabad",    q1tgt:30,aprtgt:10},
  {id:"makarba",          name:"MAKARBA",                                       cluster:"Ahmedabad",    q1tgt:30,aprtgt:10},
  {id:"bbcc",             name:"BBCC",                                          cluster:"Ahmedabad",    q1tgt:21,aprtgt:7 },
  {id:"anand",            name:"Anand",                                         cluster:"Anand",        q1tgt:33,aprtgt:11},
  {id:"baroda",           name:"Baroda",                                        cluster:"Baroda",       q1tgt:48,aprtgt:16},
  {id:"piplod_cluster",   name:"Piplod+Kosamba+Mangrol+Kim+Kadodara+Zankhvav", cluster:"Surat",        q1tgt:43,aprtgt:15},
  {id:"puna_patiya",      name:"Puna Patiya",                                   cluster:"Surat",        q1tgt:11,aprtgt:4 },
  {id:"bardoli_mahuva",   name:"Bardoli+Mahuva",                               cluster:"Surat",        q1tgt:27,aprtgt:9 },
  {id:"navsari",          name:"Navsari",                                       cluster:"Navsari",      q1tgt:40,aprtgt:14},
  {id:"vapi",             name:"Vapi",                                          cluster:"Vapi Cluster", q1tgt:33,aprtgt:11},
  {id:"valsad",           name:"Valsad",                                        cluster:"Vapi Cluster", q1tgt:33,aprtgt:11},
  {id:"silvassa",         name:"Silvassa",                                      cluster:"Vapi Cluster", q1tgt:30,aprtgt:10},
  {id:"rajkot",           name:"Rajkot",                                        cluster:"Rajkot",       q1tgt:39,aprtgt:13},
  {id:"bhavnagar",        name:"Bhavnagar",                                     cluster:"Bhavnagar",    q1tgt:30,aprtgt:10},
  {id:"prahladnagar_nexa",name:"Prahladnagar Nexa",                            cluster:"Nexa",         q1tgt:54,aprtgt:18},
  {id:"ambawadi_nexa",    name:"Ambawadi Nexa",                                 cluster:"Nexa",         q1tgt:33,aprtgt:11},
  {id:"gandhinagar_nexa", name:"Gandhinagar Nexa",                              cluster:"Nexa",         q1tgt:21,aprtgt:7 },
  {id:"baroda_nexa",      name:"Baroda Nexa+Dabhoi",                           cluster:"Nexa",         q1tgt:48,aprtgt:16},
  {id:"surat_nexa",       name:"Surat Nexa",                                    cluster:"Nexa",         q1tgt:40,aprtgt:13},
  {id:"vapi_nexa",        name:"Vapi Nexa+Valsad+Daman",                       cluster:"Nexa",         q1tgt:53,aprtgt:18},
  {id:"rajkot_nexa",      name:"Rajkot Nexa+Botad+Veraval",                    cluster:"Nexa",         q1tgt:75,aprtgt:25},
  {id:"navsari_nexa",     name:"Navsari Nexa+Chikhli",                         cluster:"Nexa",         q1tgt:29,aprtgt:10},
];

const ARENA_CLUSTERS     = ["Ahmedabad","Anand","Baroda","Surat","Navsari","Vapi Cluster","Rajkot","Bhavnagar"];
const CLUSTER_WITH_TOTAL = ["Ahmedabad","Surat","Vapi Cluster"];

// ══════════════════════════════════════════
//  SAFE MATH FORMULA ENGINE
// ══════════════════════════════════════════
function evalFormula(formula, values) {
  if (!formula) return 0;
  try {
    let expr = formula.toLowerCase();
    const ids = Object.keys(values).sort((a,b)=>b.length-a.length);
    ids.forEach(id => {
      expr = expr.replace(new RegExp('\\b'+id+'\\b','g'), Number(values[id])||0);
    });
    if (!/^[\d\s\+\-\*\/\(\)\.\%]+$/.test(expr)) return 0;
    const result = Function('"use strict";return ('+expr+')')();
    if (!isFinite(result)) return 0;
    return Math.round(result * 10) / 10;
  } catch { return 0; }
}

// ══════════════════════════════════════════
//  FIREBASE HOOK
// ══════════════════════════════════════════
function useFirebase() {
  const db=useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const loadScript = src => new Promise((res,rej) => {
      if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
      const s = document.createElement("script");
      s.src=src; s.onload=res; s.onerror=rej;
      document.head.appendChild(s);
    });
    loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js")
      .then(()=>loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js"))
      .then(()=>{
        if (!window.firebase.apps.length) window.firebase.initializeApp(FIREBASE_CONFIG);
        db.current = window.firebase.database();
        setReady(true);
      })
      .catch(e=>console.error("Firebase:",e));
  },[]);

  const listen = (path,cb) => { if(!db.current)return()=>{}; const r=db.current.ref(path); r.on("value",s=>cb(s.val())); return()=>r.off("value"); };
  const get    = async path => { if(!db.current)return null; return (await db.current.ref(path).once("value")).val(); };
  const set    = async(path,val) => { if(!db.current)throw new Error("DB not ready"); await db.current.ref(path).set(val); };
  const update = async(path,val) => { if(!db.current)throw new Error("DB not ready"); await db.current.ref(path).update(val); };
  const remove = async path => { if(!db.current)throw new Error("DB not ready"); await db.current.ref(path).remove(); };
  const push   = async(path,val) => { if(!db.current)throw new Error("DB not ready"); return db.current.ref(path).push(val); };
  return {ready,listen,get,set,update,remove,push};
}

function computeRow(locId, columns, data, locations) {
  const loc = locations.find(l=>l.id===locId);
  if (!loc) return {};
  const row = {};
  const rowData = data[locId] || {};
  columns.forEach(col => {
    if (col.type==="target") row[col.id] = loc[col.id] || 0;
    else if (col.type==="manual") row[col.id] = rowData[col.id] || 0;
    else row[col.id] = 0;
  });
  columns.filter(c=>c.type==="formula").forEach(col => {
    row[col.id] = evalFormula(col.formula, row);
  });
  return row;
}

function sumRows(locIds, columns, data, locations) {
  const total = {};
  columns.forEach(c=>total[c.id]=0);
  locIds.forEach(id => {
    const row = computeRow(id, columns, data, locations);
    columns.forEach(c => {
      if (c.type!=="formula") total[c.id] += row[c.id]||0;
    });
  });
  columns.filter(c=>c.type==="formula").forEach(col => {
    total[col.id] = evalFormula(col.formula, total);
  });
  return total;
}

function isUpdatedToday(entry) {
  if (!entry?.updatedAt) return false;
  return entry.updatedAt.slice(0,10) === todayStr();
}

// ══════════════════════════════════════════
//  BADGE COMPONENT
// ══════════════════════════════════════════
function Badge({value, col, darkMode}) {
  const num = Number(value);
  const isGapCol = col?.formula && col.formula.includes("-");
  if (isGapCol) {
    const color = num<=0?"#16a34a":num<=5?"#d97706":"#dc2626";
    return <span style={{display:"inline-block",padding:"2px 6px",borderRadius:99,fontSize:11,fontWeight:700,color,background:color+"18"}}>{num}</span>;
  }
  return <span style={{fontSize:12,fontWeight:600,color:darkMode?"#e2e8f0":"#0f172a"}}>{num % 1 !== 0 ? num.toFixed(1) : num}</span>;
}

// ══════════════════════════════════════════
//  TABLE ROWS
// ══════════════════════════════════════════
const tdS = {borderBottom:"1px solid rgba(148,163,184,0.15)",verticalAlign:"middle",textAlign:"center",padding:"6px 5px"};
const thS = {textAlign:"center",textTransform:"uppercase",letterSpacing:"0.04em",fontSize:10,padding:"9px 5px",fontWeight:700,background:"#0f172a",color:"#94a3b8",whiteSpace:"nowrap"};

function LocationRow({locId, columns, data, locations, darkMode}) {
  const loc = locations.find(l=>l.id===locId);
  if (!loc) return null;
  const row = computeRow(locId, columns, data, locations);
  const entry = data[locId]||{};
  const updatedToday = isUpdatedToday(entry);
  const ts = fmtTime(entry.updatedAt), who = entry.updatedBy;
  const visibleCols = columns.filter(c=>c.visible);
  const bg = darkMode?"#1e293b":"#fff";
  const hoverBg = darkMode?"#273449":"#f8fafc";

  return (
    <tr style={{background:bg,transition:"background 0.12s"}}
        onMouseEnter={e=>e.currentTarget.style.background=hoverBg}
        onMouseLeave={e=>e.currentTarget.style.background=bg}>
      <td style={{...tdS,textAlign:"left",paddingLeft:10,minWidth:120,background:"inherit"}}>
        <span className="loc-name" style={{fontWeight:500,fontSize:12,color:darkMode?"#e2e8f0":"#0f172a"}}>
          {loc.name}
          {!updatedToday && <span className="pending-dot" title="Not updated today"/>}
        </span>
        {ts && <span className="loc-meta" style={{display:"block",fontSize:9,color:"#94a3b8",marginTop:1}}>{who?who+" · ":""}{ts}</span>}
      </td>
      {visibleCols.map(col => (
        <td key={col.id} style={{...tdS,minWidth:50,color:darkMode?"#e2e8f0":"#0f172a"}}>
          <Badge value={row[col.id]} col={col} darkMode={darkMode}/>
        </td>
      ))}
    </tr>
  );
}

function ClusterTotalRow({label, locIds, columns, data, locations, single, locId, darkMode}) {
  const ids = single ? [locId] : locIds;
  const row = sumRows(ids, columns, data, locations);
  const entry = single ? (data[locId]||{}) : null;
  const updatedToday = single ? isUpdatedToday(entry) : ids.every(id=>isUpdatedToday(data[id]||{}));
  const ts = single ? fmtTime(entry?.updatedAt) : null;
  const who = single ? entry?.updatedBy : null;
  const visibleCols = columns.filter(c=>c.visible);

  return (
    <tr style={{background:"#fef08a",fontWeight:700}}>
      <td style={{...tdS,textAlign:"left",paddingLeft:single?10:14,color:"#92400e",fontSize:11,minWidth:120}}>
        {label}
        {!updatedToday && <span className="pending-dot" title="Not updated today"/>}
        {single && ts && <span style={{display:"block",fontSize:9,color:"#b45309",fontWeight:400,marginTop:1}}>{who?who+" · ":""}{ts}</span>}
      </td>
      {visibleCols.map(col => (
        <td key={col.id} style={{...tdS,minWidth:50,color:"#92400e"}}>
          <Badge value={row[col.id]} col={col} darkMode={false}/>
        </td>
      ))}
    </tr>
  );
}

function TotalRow({label, locIds, columns, data, locations, shade}) {
  const row = sumRows(locIds, columns, data, locations);
  const visibleCols = columns.filter(c=>c.visible);
  return (
    <tr style={{background:shade||"#0f172a",color:"#fff",fontWeight:800}}>
      <td style={{...tdS,textAlign:"left",paddingLeft:10,color:"#fff",fontSize:12,minWidth:120}}>{label}</td>
      {visibleCols.map(col => (
        <td key={col.id} style={{...tdS,color:"#fff",minWidth:50,fontWeight:800}}>
          {row[col.id] % 1 !== 0 ? row[col.id].toFixed(1) : row[col.id]}
        </td>
      ))}
    </tr>
  );
}

function SectionDivider({label,bg,darkMode}) {
  return (
    <tr>
      <td colSpan={999} style={{background:bg||(darkMode?"#1e293b":"#f8fafc"),padding:"6px 10px",fontSize:10,fontWeight:700,color:darkMode?"#94a3b8":"#475569",textTransform:"uppercase",letterSpacing:"0.08em"}}>▸ {label}</td>
    </tr>
  );
}

// ══════════════════════════════════════════
//  LOGIN SCREEN
// ══════════════════════════════════════════
function LoginScreen({onLogin, firebase}) {
  const [pw,setPw]=useState(""), [err,setErr]=useState(""), [loading,setLoading]=useState(false);

  const attempt = async () => {
    setLoading(true); setErr("");
    if (pw===MASTER_ADMIN_PASSWORD) { onLogin({role:"admin",name:"Admin",id:"master"}); return; }
    try {
      const users = await firebase.get("users");
      if (users) {
        const found = Object.entries(users).find(([,u])=>u.password===pw);
        if (found) { onLogin({role:found[1].role,name:found[1].name,id:found[0],assignedOutlets:found[1].assignedOutlets||[]}); return; }
      }
    } catch(e){}
    setErr("Incorrect password. Try again."); setPw(""); setLoading(false);
  };

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0f172a,#1e3a5f)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:360,overflow:"hidden",boxShadow:"0 25px 60px rgba(0,0,0,0.4)"}}>
        <div style={{background:"linear-gradient(135deg,#1e3a5f,#0f172a)",padding:"28px 28px 24px",textAlign:"center"}}>
          <div style={{fontSize:36,marginBottom:8}}>🔐</div>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,color:"#fff"}}>Update Data Access</div>
          <div style={{fontSize:12,color:"#94a3b8",marginTop:4}}>Enter your password to continue</div>
        </div>
        <div style={{padding:28}}>
          <label style={{display:"block",fontSize:11,fontWeight:700,color:"#94a3b8",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.06em"}}>Password</label>
          <input type="password" value={pw} onChange={e=>{setPw(e.target.value);setErr("");}}
            onKeyDown={e=>e.key==="Enter"&&attempt()} placeholder="Enter password" autoFocus
            style={{width:"100%",padding:"12px 14px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:15,outline:"none",marginBottom:12,fontFamily:"inherit"}}/>
          {err&&<div style={{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:8,padding:"8px 12px",fontSize:13,color:"#dc2626",marginBottom:12}}>{err}</div>}
          <button onClick={attempt} disabled={loading||!pw}
            style={{width:"100%",padding:"13px",background:"linear-gradient(135deg,#1e3a5f,#2563eb)",color:"#fff",border:"none",borderRadius:12,fontSize:15,fontWeight:700,cursor:"pointer"}}>
            {loading?"Checking…":"Unlock"}
          </button>
          <div style={{textAlign:"center",marginTop:14,fontSize:12,color:"#94a3b8"}}>No password? Contact your admin.</div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
//  UPDATE FORM
// ══════════════════════════════════════════
function FormView({onBack, firebase, currentUser, existingData, columns, locations}) {
  const [entries,    setEntries]   = useState({});
  const [name,       setName]      = useState(currentUser?.name||"");
  const [saving,     setSaving]    = useState(false);
  const [done,       setDone]      = useState(false);
  const [err,        setErr]       = useState("");
  const [savedCount, setSavedCount]= useState(0);
  const [search,     setSearch]    = useState("");

  const manualCols = columns.filter(c=>c.visible&&c.type==="manual");
  const isAdmin    = currentUser?.role==="admin";
  const assigned   = currentUser?.assignedOutlets||[];

  const allowedLocs = useMemo(()=>{
    if (isAdmin) return locations;
    if (assigned.length===0) return [];
    return locations.filter(l=>assigned.includes(l.id));
  },[locations,assigned,isAdmin]);

  const byCluster = useMemo(()=>{
    const map={};
    allowedLocs.forEach(l=>{ if(!map[l.cluster])map[l.cluster]=[]; map[l.cluster].push(l); });
    return map;
  },[allowedLocs]);

  const filteredClusters = useMemo(()=>{
    if(!search) return byCluster;
    const q=search.toLowerCase();
    const result={};
    Object.entries(byCluster).forEach(([cl,locs])=>{
      const filtered=locs.filter(l=>l.name.toLowerCase().includes(q)||cl.toLowerCase().includes(q));
      if(filtered.length) result[cl]=filtered;
    });
    return result;
  },[byCluster,search]);

  const toggleOutlet = id => {
    setEntries(prev=>{
      if(prev[id]){const n={...prev};delete n[id];return n;}
      const ex=existingData[id]||{};
      const vals={};
      manualCols.forEach(c=>vals[c.id]=ex[c.id]!=null?String(ex[c.id]):"");
      return {...prev,[id]:vals};
    });
  };

  const toggleCluster = (locs,allOn) => {
    setEntries(prev=>{
      const n={...prev};
      locs.forEach(l=>{
        if(allOn){delete n[l.id];}
        else if(!n[l.id]){
          const ex=existingData[l.id]||{};
          const vals={};
          manualCols.forEach(c=>vals[c.id]=ex[c.id]!=null?String(ex[c.id]):"");
          n[l.id]=vals;
        }
      });
      return n;
    });
  };

  const updateEntry = (id,colId,val) => setEntries(prev=>({...prev,[id]:{...prev[id],[colId]:val}}));

  const selectedCount = Object.keys(entries).length;
  const allFilled = selectedCount>0&&Object.values(entries).every(e=>manualCols.every(c=>e[c.id]!==""&&e[c.id]!=null));
  const canSubmit = allFilled&&!saving;

  const handleSubmit = async () => {
    setErr(""); setSaving(true);
    try {
      const updates={}, auditEntries={};
      const now=new Date().toISOString();
      Object.entries(entries).forEach(([id,vals])=>{
        const payload={...vals,updatedBy:name||"Unknown",updatedAt:now};
        Object.keys(payload).forEach(k=>{ payload[k]=isNaN(payload[k])?payload[k]:Number(payload[k]); });
        updates[`coatingData/${id}`]=payload;
        auditEntries[`audit/${id}_${Date.now()}`]={locId:id,by:name||"Unknown",at:now,values:vals};
      });
      const snapKey=todayStr();
      Object.entries(entries).forEach(([id,vals])=>{
        updates[`snapshots/${snapKey}/${id}`]={...vals,by:name||"Unknown",at:new Date().toISOString()};
      });
      Object.assign(updates,auditEntries);
      await firebase.update("/",updates);
      setSavedCount(Object.keys(entries).length);
      setDone(true);
    } catch(e){setErr("Save failed: "+e.message);}
    setSaving(false);
  };

  const inp={width:"100%",padding:"11px 14px",borderRadius:10,border:"1.5px solid #334155",background:"#1e293b",color:"#e2e8f0",fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"inherit"};

  // No outlets assigned screen
  if(allowedLocs.length===0&&!isAdmin) return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#1e3a5f,#2563eb)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:"#fff",borderRadius:20,padding:40,textAlign:"center",maxWidth:360}}>
        <div style={{fontSize:48,marginBottom:16}}>🔒</div>
        <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:800,color:"#0f172a",marginBottom:8}}>No Outlets Assigned</div>
        <div style={{color:"#64748b",fontSize:14,marginBottom:24}}>You don't have any outlets assigned yet. Please contact your admin.</div>
        <button onClick={onBack} style={{background:"#1e3a5f",color:"#fff",border:"none",borderRadius:12,padding:"11px 24px",cursor:"pointer",fontWeight:700}}>← Back</button>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#1e3a5f,#2563eb)"}}>
      <div style={{maxWidth:540,margin:"0 auto"}}>
        {/* Header */}
        <div style={{position:"sticky",top:0,zIndex:20,background:"linear-gradient(135deg,#1e3a5f,#2563eb)",padding:"14px 16px",boxShadow:"0 4px 20px rgba(0,0,0,0.3)"}}>
          <button onClick={onBack} style={{background:"rgba(255,255,255,0.2)",border:"none",color:"#fff",borderRadius:8,padding:"4px 12px",cursor:"pointer",fontSize:13,marginBottom:8}}>← Dashboard</button>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:800,color:"#fff"}}>Update Coating Data</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.7)",marginTop:2}}>{todayDisplay} · Tap outlets to select</div>
            </div>
            {selectedCount>0&&<span style={{background:"#f97316",color:"#fff",borderRadius:99,padding:"4px 12px",fontSize:12,fontWeight:700}}>{selectedCount} selected</span>}
          </div>
        </div>

        <div style={{padding:"12px 14px",paddingBottom:100}}>
          {done ? (
            <div style={{background:"#fff",borderRadius:16,padding:40,textAlign:"center",marginTop:8}}>
              <div style={{fontSize:52,marginBottom:10}}>✅</div>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,color:"#0f172a"}}>All Saved!</div>
              <div style={{color:"#64748b",marginTop:8,fontSize:14}}><b>{savedCount}</b> outlet{savedCount>1?"s":""} updated</div>
              <button onClick={()=>{setDone(false);setEntries({});}} style={{marginTop:20,background:"#1e3a5f",color:"#fff",border:"none",borderRadius:12,padding:"11px 24px",cursor:"pointer",fontWeight:700}}>Update More</button>
            </div>
          ) : (
            <>
              {/* Name input */}
              <div style={{background:"rgba(255,255,255,0.15)",borderRadius:12,padding:"12px 14px",marginBottom:12}}>
                <label style={{display:"block",fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.8)",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.06em"}}>Your Name</label>
                <input value={name} onChange={e=>setName(e.target.value)} placeholder="Manager name" style={inp}/>
              </div>

              {/* Search */}
              <input className="search-bar" value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="🔍 Search outlet or cluster…"
                style={{marginBottom:12,background:"rgba(255,255,255,0.15)",color:"#fff",border:"1px solid rgba(255,255,255,0.3)"}}/>

              {Object.entries(filteredClusters).map(([cluster,locs])=>{
                const allOn=locs.every(l=>entries[l.id]);
                return (
                  <div key={cluster} className="cluster-section">
                    <div className="cluster-label">
                      <span style={{color:"#fff"}}>{cluster}</span>
                      <button className="cluster-btn" onClick={()=>toggleCluster(locs,allOn)}>
                        {allOn?"Deselect All":"Select All"}
                      </button>
                    </div>
                    {locs.map(loc=>{
                      const entry=entries[loc.id];
                      const prev=existingData[loc.id]||{};
                      const isOpen=!!entry;
                      const updatedToday=isUpdatedToday(existingData[loc.id]);
                      return (
                        <div key={loc.id} className={`outlet-card${isOpen?" active":""}`}>
                          <div className="outlet-header" onClick={()=>toggleOutlet(loc.id)}>
                            <div>
                              <div style={{fontWeight:700,fontSize:13,color:"#0f172a",display:"flex",alignItems:"center",gap:6}}>
                                {loc.name}
                                {!updatedToday&&<span style={{fontSize:10,background:"#fef2f2",color:"#dc2626",borderRadius:99,padding:"1px 6px"}}>Pending</span>}
                                {updatedToday&&<span style={{fontSize:10,background:"#dcfce7",color:"#16a34a",borderRadius:99,padding:"1px 6px"}}>✓ Updated</span>}
                              </div>
                              <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>
                                {manualCols.map(c=>`${c.label}: ${prev[c.id]??"-"}`).join(" · ")}
                              </div>
                            </div>
                            <div style={{fontSize:20,color:isOpen?"#3b82f6":"#cbd5e1",fontWeight:700,minWidth:24,textAlign:"center"}}>{isOpen?"✓":"+"}</div>
                          </div>
                          {isOpen&&(
                            <div className="outlet-inputs">
                              {manualCols.map(col=>(
                                <div key={col.id}>
                                  <label className="inp-label">{col.label}</label>
                                  <input type="number" className="num-inp" value={entry[col.id]} min="0"
                                    onChange={e=>{e.stopPropagation();updateEntry(loc.id,col.id,e.target.value);}}
                                    onClick={e=>e.stopPropagation()} placeholder="0"/>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              {err&&<div style={{background:"rgba(220,38,38,0.15)",border:"1px solid #fca5a5",borderRadius:8,padding:"8px 12px",fontSize:13,color:"#fca5a5"}}>{err}</div>}
            </>
          )}
        </div>
      </div>

      {/* Fixed save button */}
      {!done&&(
        <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:30,padding:"10px 16px 20px",background:"linear-gradient(to top,rgba(30,58,95,0.98) 60%,transparent)"}}>
          <div style={{maxWidth:540,margin:"0 auto"}}>
            <button onClick={handleSubmit} disabled={!canSubmit}
              style={{width:"100%",padding:"15px",background:canSubmit?"linear-gradient(135deg,#f97316,#ea580c)":"rgba(255,255,255,0.1)",color:canSubmit?"#fff":"rgba(255,255,255,0.4)",border:"none",borderRadius:14,fontSize:16,fontWeight:800,cursor:canSubmit?"pointer":"not-allowed",boxShadow:canSubmit?"0 6px 24px rgba(249,115,22,0.5)":"none",transition:"all 0.2s"}}>
              {saving?"💾 Saving…":canSubmit?`💾 Save ${selectedCount} Outlet${selectedCount>1?"s":""}`:selectedCount>0?"⚠ Fill all numbers first":"Tap outlets above to begin"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════
//  DOWNLOAD HELPERS
// ══════════════════════════════════════════
function downloadImage(ref) {
  if(!ref.current) return;
  const wrap=ref.current.querySelector(".table-wrap");
  if(wrap){wrap.style.maxHeight="none";wrap.style.overflowY="visible";}
  setTimeout(()=>{
    html2canvas(ref.current,{scale:2,backgroundColor:"#f1f5f9",useCORS:true,logging:false,scrollX:0,scrollY:0}).then(canvas=>{
      if(wrap){wrap.style.maxHeight="";wrap.style.overflowY="";}
      const a=document.createElement("a");
      a.download=`Coating-Report-${new Date().toLocaleDateString("en-IN").replace(/\//g,"-")}.png`;
      a.href=canvas.toDataURL("image/png"); a.click();
    });
  },120);
}

function downloadExcel(columns, locations, data) {
  const doExport = X => {
    const visCols=columns.filter(c=>c.visible);
    const headers=["Location","Cluster",...visCols.map(c=>c.label)];
    const rows=locations.map(loc=>{
      const row=computeRow(loc.id,columns,data,locations);
      return [loc.name,loc.cluster,...visCols.map(c=>row[c.id])];
    });
    const ws=X.utils.aoa_to_sheet([headers,...rows]);
    const wb=X.utils.book_new();
    X.utils.book_append_sheet(wb,"Report",ws);
    X.writeFile(wb,`Coating-Report-${new Date().toLocaleDateString("en-IN").replace(/\//g,"-")}.xlsx`);
  };

  if(window.XLSX){ doExport(window.XLSX); return; }

  // Load on demand if not yet available
  const s=document.createElement("script");
  s.src="https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js";
  s.onload=()=>doExport(window.XLSX);
  s.onerror=()=>alert("Failed to load Excel library. Check your internet connection.");
  document.head.appendChild(s);
}

// ══════════════════════════════════════════
//  MAIN APP
// ══════════════════════════════════════════
function CoatingTracker() {
  const firebase=useFirebase();
  const [view,        setView]       = useState("dashboard");
  const [currentUser, setCurrentUser]= useState(()=>loadSession());
  const [data,        setData]       = useState({});
  const [columns,     setColumns]    = useState(DEFAULT_COLUMNS);
  const [locations,   setLocations]  = useState(DEFAULT_LOCATIONS);
  const [config,      setConfig]     = useState({title:"Coating Progress Report",period:"Q1"});
  const [lastUpdate,  setLastUpdate] = useState(null);
  const [capturing,   setCapturing]  = useState(false);
  const [darkMode,    setDarkMode]   = useState(false);
  const [search,      setSearch]     = useState("");
  const [collapsed,   setCollapsed]  = useState({});
  const tableRef=useRef(null);

  useEffect(()=>{
    if(!firebase.ready) return;
    const unsubs=[];
    unsubs.push(firebase.listen("coatingData",d=>{
      setData(d||{});
      const times=Object.values(d||{}).map(v=>v?.updatedAt).filter(Boolean).sort().reverse();
      if(times[0]) setLastUpdate(new Date(times[0]).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}));
    }));
    unsubs.push(firebase.listen("appConfig/columns",d=>{ if(d&&Array.isArray(d)) setColumns(d); }));
    unsubs.push(firebase.listen("appConfig/locations",d=>{ if(d&&Array.isArray(d)) setLocations(d); }));
    unsubs.push(firebase.listen("appConfig/settings",d=>{ if(d) setConfig(d); }));
    return ()=>unsubs.forEach(u=>u());
  },[firebase.ready]);

  const allClusters   = useMemo(()=>[...new Set(locations.map(l=>l.cluster))],[locations]);
  const arenaClusters = useMemo(()=>allClusters.filter(c=>c!=="Nexa"),[allClusters]);
  const allArenaIds   = useMemo(()=>arenaClusters.flatMap(c=>locations.filter(l=>l.cluster===c).map(l=>l.id)),[arenaClusters,locations]);
  const allNexaIds    = useMemo(()=>locations.filter(l=>l.cluster==="Nexa").map(l=>l.id),[locations]);
  const allIds        = useMemo(()=>locations.map(l=>l.id),[locations]);
  const visibleCols   = columns.filter(c=>c.visible);
  const kpiRow        = useMemo(()=>sumRows(allIds,columns,data,locations),[allIds,columns,data,locations]);

  const filteredLocs = useMemo(()=>{
    if(!search) return locations;
    const q=search.toLowerCase();
    return locations.filter(l=>l.name.toLowerCase().includes(q)||l.cluster.toLowerCase().includes(q));
  },[locations,search]);

  const clusterGroups = useMemo(()=>{
    const map={};
    filteredLocs.forEach(l=>{ if(!map[l.cluster])map[l.cluster]=[]; map[l.cluster].push(l.id); });
    return map;
  },[filteredLocs]);

  const pendingCount = locations.filter(l=>!isUpdatedToday(data[l.id])).length;

  const handleLogin      = user => { setCurrentUser(user); saveSession(user); setView(user.role==="admin"?"dashboard":"form"); };
  const handleUpdateClick= () => { if(currentUser) setView("form"); else setView("login"); };
  const toggleCollapse   = cluster => setCollapsed(p=>({...p,[cluster]:!p[cluster]}));
  const handleDownloadImage = () => { setCapturing(true); downloadImage(tableRef); setTimeout(()=>setCapturing(false),1800); };

  if(view==="login") return <LoginScreen onLogin={handleLogin} firebase={firebase}/>;
  if(view==="form")  return <FormView onBack={()=>setView("dashboard")} firebase={firebase} currentUser={currentUser} existingData={data} columns={columns} locations={locations}/>;

  return (
    <div style={{minHeight:"100vh",background:darkMode?"#0f172a":"#f1f5f9"}}>
      {/* Top bar */}
      <div style={{position:"sticky",top:0,zIndex:10,background:"linear-gradient(135deg,#0f172a,#1e3a5f)",padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap",boxShadow:"0 2px 10px rgba(0,0,0,0.3)"}}>
        <div>
          <div className="topbar-title" style={{fontFamily:"'Syne',sans-serif",fontSize:16,fontWeight:800,color:"#fff",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            {config.title}
            <span style={{fontSize:10,padding:"2px 7px",borderRadius:99,background:firebase.ready?"rgba(34,197,94,0.2)":"rgba(251,191,36,0.2)",color:firebase.ready?"#86efac":"#fcd34d"}}>
              {firebase.ready?"🔴 LIVE":"LOCAL"}
            </span>
            {pendingCount>0&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:99,background:"rgba(239,68,68,0.2)",color:"#fca5a5"}}>⚠ {pendingCount} pending</span>}
          </div>
          <div className="topbar-sub" style={{fontSize:10,color:"#94a3b8",marginTop:2}}>
            {config.period} · {todayDisplay}{lastUpdate&&` · Updated: ${lastUpdate}`}
          </div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          {currentUser&&<span style={{fontSize:10,color:"#86efac",background:"rgba(34,197,94,0.15)",padding:"2px 8px",borderRadius:99,display:"flex",alignItems:"center",gap:5}}>
            🔓 {currentUser.name}
            <span onClick={()=>{clearSession();setCurrentUser(null);}} style={{cursor:"pointer",opacity:0.6,fontWeight:700,fontSize:11}} title="Logout">✕</span>
          </span>}
          <button onClick={()=>setDarkMode(p=>!p)} style={{background:"#1e293b",color:"#94a3b8",border:"1px solid #334155",borderRadius:8,padding:"6px 10px",fontSize:11,cursor:"pointer"}}>{darkMode?"☀️":"🌙"}</button>
          <button onClick={()=>downloadExcel(columns,locations,data)} style={{background:"#1e293b",color:"#94a3b8",border:"1px solid #334155",borderRadius:8,padding:"6px 10px",fontSize:11,cursor:"pointer"}}>📊 Excel</button>
          <button onClick={handleDownloadImage} disabled={capturing} style={{background:"#1e293b",color:"#94a3b8",border:"1px solid #334155",borderRadius:8,padding:"6px 10px",fontSize:11,cursor:"pointer"}}>{capturing?"…":"📷 PNG"}</button>
          {currentUser?.role==="admin"&&<button onClick={()=>window.open("admin.html","_blank")} style={{background:"#7c3aed",color:"#fff",border:"none",borderRadius:8,padding:"6px 10px",fontSize:11,cursor:"pointer",fontWeight:700}}>⚙ Admin</button>}
          <button onClick={handleUpdateClick} style={{background:"#f97316",color:"#fff",border:"none",borderRadius:9,padding:"7px 14px",fontWeight:700,fontSize:12,cursor:"pointer",boxShadow:"0 4px 14px rgba(249,115,22,0.4)"}}>✏ Update</button>
        </div>
      </div>

      {/* Capture zone */}
      <div ref={tableRef} style={{background:darkMode?"#0f172a":"#f1f5f9"}}>
        {/* KPI cards */}
        <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(visibleCols.length+1,6)},1fr)`,gap:8,padding:"10px 12px 0"}}>
          {visibleCols.map(col=>(
            <div key={col.id} style={{background:darkMode?"#1e293b":"#fff",borderRadius:10,padding:"10px",boxShadow:"0 2px 6px rgba(0,0,0,0.06)",borderTop:`3px solid ${col.color||"#94a3b8"}`}}>
              <div className="kpi-label" style={{fontSize:9,color:"#94a3b8",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.04em"}}>{col.label}</div>
              <div className="kpi-val" style={{fontSize:20,fontWeight:800,color:col.color||"#0f172a",fontFamily:"'Syne',sans-serif",marginTop:2}}>{kpiRow[col.id]%1!==0?kpiRow[col.id].toFixed(1):kpiRow[col.id]}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div style={{padding:"10px 12px 0"}}>
          <input className="search-bar" value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search outlet…"
            style={{background:darkMode?"#1e293b":"#fff",color:darkMode?"#e2e8f0":"#0f172a",border:`1px solid ${darkMode?"#334155":"#e2e8f0"}`}}/>
        </div>

        {/* Table */}
        <div style={{margin:"10px 12px 16px",background:darkMode?"#1e293b":"#fff",borderRadius:12,overflow:"hidden",boxShadow:"0 2px 10px rgba(0,0,0,0.08)"}}>
          <div className="table-wrap">
            <table className="report-table" style={{minWidth:400}}>
              <thead>
                <tr style={{background:"#0f172a"}}>
                  <th style={{...thS,textAlign:"left",paddingLeft:10,color:"#e2e8f0",minWidth:120,position:"sticky",left:0,zIndex:3,background:"#0f172a"}}>LOCATION</th>
                  {visibleCols.map(col=>(
                    <th key={col.id} style={{...thS,color:col.color||"#94a3b8",minWidth:60}}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <SectionDivider label="Arena" bg={darkMode?"#263248":"#f8fafc"} darkMode={darkMode}/>
                {arenaClusters.map(cluster=>{
                  const ids=(clusterGroups[cluster]||[]);
                  if(!ids.length) return null;
                  const isSingle=locations.filter(l=>l.cluster===cluster).length===1;
                  const isCollapsed=collapsed[cluster];
                  return (
                    <React.Fragment key={cluster}>
                      {!isSingle&&!isCollapsed&&ids.map(id=><LocationRow key={id} locId={id} columns={columns} data={data} locations={locations} darkMode={darkMode}/>)}
                      {isSingle
                        ? <ClusterTotalRow label={cluster} locIds={ids} columns={columns} data={data} locations={locations} single={true} locId={ids[0]} darkMode={darkMode}/>
                        : <ClusterTotalRow label={`${CLUSTER_WITH_TOTAL.includes(cluster)?cluster+" Total":cluster}${isCollapsed?" ▶":" ▼"}`} locIds={ids} columns={columns} data={data} locations={locations} darkMode={darkMode}/>
                      }
                    </React.Fragment>
                  );
                })}
                {allArenaIds.length>0&&<TotalRow label="Arena Gujarat Total" locIds={allArenaIds} columns={columns} data={data} locations={locations} shade="#1e293b"/>}

                {allNexaIds.length>0&&<>
                  <SectionDivider label="Nexa" bg={darkMode?"#263248":"#f0f9ff"} darkMode={darkMode}/>
                  {(clusterGroups["Nexa"]||[]).map(id=><LocationRow key={id} locId={id} columns={columns} data={data} locations={locations} darkMode={darkMode}/>)}
                  <TotalRow label="Nexa Gujarat Total" locIds={allNexaIds} columns={columns} data={data} locations={locations} shade="#1e293b"/>
                </>}

                <TotalRow label="Group Total" locIds={allIds} columns={columns} data={data} locations={locations} shade="#0f172a"/>
              </tbody>
            </table>
          </div>
          <div style={{padding:"8px 12px",background:"#fef9c3",fontSize:11,color:"#92400e",fontWeight:600}}>
            As on date {todayDisplay} · {config.title} {config.period}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CoatingTracker;