const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/services-KJmycXHR.js","assets/vendor-firebase-CWdI6yjY.js","assets/vendor-core-D_hbTIBO.js","assets/app-core-C3urL5y9.js","assets/components-CGOc1594.js","assets/components-BRkH8bAL.css","assets/vendor-export-BFapH6h_.js","assets/feature-reception-BXRkj1BL.js","assets/feature-admin-BLn9Q6qx.js","assets/HousekeepingDashboard-BUwLZqgo.js","assets/BellmanDashboard-fxxvDxEJ.js","assets/MaintenanceDashboard-CCl7DP9i.js","assets/ProcurementDashboard-BKhTnCWN.js","assets/CoffeeShopDashboard--nlob7p8.js","assets/feature-super-admin-BHRwm58i.js","assets/feature-guest-CcaFVW6e.js","assets/DemoEntry-DTm8mX_U.js","assets/AboutUs-XkVjVFHW.js","assets/CreateFirstBranch-DibB0DEX.js","assets/ApproveRoomTypes-C2V4sOl5.js"])))=>i.map(i=>d[i]);
import{e as _e,u as ce,c as Se,r as d,j as e,Y as ct,b as se,O as Ze,V as Qe,aF as ke,b3 as be,ao as Te,d as dt,a7 as he,ae as et,af as tt,F as mt,c0 as ht,b_ as ut,c5 as xt,cl as pt,U as ve,ax as gt,ab as ue,ak as xe,ag as bt,aI as Re,P as Oe,T as Ae,w as ge,bu as at,R as X,$ as le,ac as ft,cm as st,Z as rt,bB as oe,_ as pe,aa as jt,bz as wt,bw as Fe,aG as je,bT as vt,bU as D,N as ie,an as yt,aq as Nt,o as _t,s as St,ai as Et,z as At,a0 as Be,a1 as $e,a2 as Ge,a3 as Me,a4 as Ve,a6 as Pe,a9 as It,cn as Ct,co as kt,cp as Pt,i as Dt}from"./vendor-core-D_hbTIBO.js";import{c as Lt,J as K,az as Tt,aA as Rt,G as He,H as Ie,aB as Ot,b as De,Z as Ft,aC as U,aD as Bt,h as Ue,aE as $t,aF as Gt,aG as Mt,aH as Vt,aI as Ht,aJ as Ut,aK as zt,aL as Kt,aM as qt,aN as Yt,aj as Wt,aO as Jt}from"./components-CGOc1594.js";import{u as fe,c as Xt,_ as N,y as $,R as Zt,z as Qt,b as ea,T as ta,A as aa,B as sa,U as ra,C as na,a as oa,D as la,I as ia}from"./app-core-C3urL5y9.js";import{n as ca,fg as da,fh as ma,q as ye,d as de,fi as ha,fj as ua,bU as ze,fk as xa,h as Ke,l as qe}from"./services-KJmycXHR.js";import{g as pa,c as me,a as we,T as ga}from"./vendor-firebase-CWdI6yjY.js";import"./vendor-export-BFapH6h_.js";(function(){const l=document.createElement("link").relList;if(l&&l.supports&&l.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))c(i);new MutationObserver(i=>{for(const u of i)if(u.type==="childList")for(const x of u.addedNodes)x.tagName==="LINK"&&x.rel==="modulepreload"&&c(x)}).observe(document,{childList:!0,subtree:!0});function s(i){const u={};return i.integrity&&(u.integrity=i.integrity),i.referrerPolicy&&(u.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?u.credentials="include":i.crossOrigin==="anonymous"?u.credentials="omit":u.credentials="same-origin",u}function c(i){if(i.ep)return;i.ep=!0;const u=s(i);fetch(i.href,u)}})();const ba=[{code:"ar",name:"العربية",nativeName:"العربية",dir:"rtl"},{code:"en",name:"English",nativeName:"English",dir:"ltr"},{code:"hi",name:"हिंदी",nativeName:"हिंदी",dir:"ltr"},{code:"bn",name:"বাংলা",nativeName:"বাংলা",dir:"ltr"}],fa=t=>{const l=new Date().getHours();return l>=5&&l<12?{greeting:t("greetings.morning"),message:t("auth.morningMessage"),icon:ht,iconColor:"text-amber-500",emoji:"☀️"}:l>=12&&l<17?{greeting:t("greetings.afternoon"),message:t("auth.afternoonMessage"),icon:Ze,iconColor:"text-yellow-500",emoji:"🌤️"}:l>=17&&l<21?{greeting:t("greetings.evening"),message:t("auth.eveningMessage"),icon:ut,iconColor:"text-orange-500",emoji:"🌅"}:{greeting:t("greetings.night"),message:t("auth.nightMessage"),icon:Qe,iconColor:"text-indigo-400",emoji:"🌙"}},Ce=({active:t,onClick:l,icon:s,label:c,color:i,isDark:u=!1})=>e.jsxs("button",{onClick:()=>{K("light"),l()},className:`
      flex-1 py-3 px-2 sm:px-4 rounded-xl flex items-center justify-center gap-1.5 sm:gap-2
      transition-all duration-300 text-xs sm:text-sm font-medium
      ${t?`bg-gradient-to-r ${i} text-white shadow-lg`:u?"bg-slate-700 text-slate-300 hover:bg-slate-600 border border-slate-600":"bg-white text-slate-500 hover:bg-slate-50 border border-slate-200"}
    `,children:[s,e.jsx("span",{children:c})]}),nt=()=>{const t=_e(),l=ce(),{t:s,i18n:c}=Se(),{login:i,loginWithBiometric:u,isAuthenticated:x,isLoading:I,user:j}=fe(),{showInfo:_}=Lt(),{theme:B,toggleTheme:p,isDark:a}=Xt(),[g,T]=d.useState(!1),b=d.useRef(null),o=d.useRef(!1),[n,w]=d.useState("employee"),[k,G]=d.useState(""),[S,F]=d.useState(""),[A,H]=d.useState("branch"),[q,m]=d.useState(!1),[v,C]=d.useState(!1),[L,W]=d.useState(null),[J,re]=d.useState(null),[y,O]=d.useState(!1),[V,ee]=d.useState(!1),[Y,te]=d.useState(null),[r,P]=d.useState(!1);d.useEffect(()=>{const f=h=>{b.current&&!b.current.contains(h.target)&&T(!1)};if(g)return document.addEventListener("mousedown",f),()=>document.removeEventListener("mousedown",f)},[g]);const[R,Z]=d.useState(()=>{try{return{devName:localStorage.getItem("adora_dev_name")||"Ayman Abo Warda",phoneSA:localStorage.getItem("adora_dev_phone_sa")||"966570707121",phoneEG:localStorage.getItem("adora_dev_phone_eg")||"201500000162",email:localStorage.getItem("adora_dev_email")||"77aayy@gmail.com",signature:localStorage.getItem("adora_dev_signature")||"Crafted by Ayman Abo Warda"}}catch{return{devName:"Ayman Abo Warda",phoneSA:"966570707121",phoneEG:"201500000162",email:"77aayy@gmail.com",signature:"Crafted by Ayman Abo Warda"}}});d.useEffect(()=>{(async()=>{try{const{getSystemSettings:h}=await N(async()=>{const{getSystemSettings:E}=await import("./services-KJmycXHR.js").then(ne=>ne.fJ);return{getSystemSettings:E}},__vite__mapDeps([0,1,2,3,4,5,6])),M=await h();if(M?.developerBranding){const E=M.developerBranding,ne={devName:E.devName||R.devName,phoneSA:E.devPhoneSA||R.phoneSA,phoneEG:E.devPhoneEG||R.phoneEG,email:E.devEmail||R.email,signature:E.devSignature||R.signature};Z(ne),E.devName&&localStorage.setItem("adora_dev_name",E.devName),E.devPhoneSA&&localStorage.setItem("adora_dev_phone_sa",E.devPhoneSA),E.devPhoneEG&&localStorage.setItem("adora_dev_phone_eg",E.devPhoneEG),E.devEmail&&localStorage.setItem("adora_dev_email",E.devEmail),E.devSignature&&localStorage.setItem("adora_dev_signature",E.devSignature)}}catch{}})()},[]),d.useEffect(()=>{const f=h=>{const M=h.detail||{},E={devName:M.devName??R.devName,phoneSA:M.phoneSA??R.phoneSA,phoneEG:M.phoneEG??R.phoneEG,email:M.email??R.email,signature:M.signature??R.signature};Z(E),E.devName&&localStorage.setItem("adora_dev_name",E.devName),E.phoneSA&&localStorage.setItem("adora_dev_phone_sa",E.phoneSA),E.phoneEG&&localStorage.setItem("adora_dev_phone_eg",E.phoneEG),E.email&&localStorage.setItem("adora_dev_email",E.email),E.signature&&localStorage.setItem("adora_dev_signature",E.signature)};return window.addEventListener("adora_dev_settings_updated",f),()=>{window.removeEventListener("adora_dev_settings_updated",f)}},[]);const ae=d.useMemo(()=>fa(s),[s]),lt=ae.icon;d.useEffect(()=>{P(!0)},[]),d.useEffect(()=>{ye()||t("/firebase-setup",{replace:!0})},[t]),d.useEffect(()=>{const f=new URLSearchParams(window.location.search),h=f.get("setup_code"),M=f.get("welcome"),E=h&&/^[a-zA-Z0-9\s\-\._,]{1,100}$/.test(h)?h:null,ne=M&&/^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFFa-zA-Z0-9\s\-\._,]{1,100}$/.test(M)?M:null;E&&(G(E),w("employee"),_(ne?s("auth.welcomeToHotel",{hotel:ne}):s("auth.welcomeToAdora")),window.history.replaceState({},"",window.location.pathname))},[_,s]),d.useEffect(()=>{ee(ca())},[]),d.useEffect(()=>{o.current||!I&&x&&j&&l.pathname==="/login"&&(j.role==="owner"?t("/owner-dashboard",{replace:!0}):t("/admin",{replace:!0}))},[I,x,j,t,l.pathname]),d.useEffect(()=>{(async()=>{if(Y){const h=await da(Y.userId,Y.tenantId),M=ma(Y.userId,Y.tenantId);!h&&V&&!M&&O(!0)}})()},[Y,V]),d.useEffect(()=>{if(L||J){const f=setTimeout(()=>{W(null),re(null)},3e3);return()=>clearTimeout(f)}},[L,J]);const z=(()=>{switch(n){case"owner":return{showBranch:!1,pinLength:6,pinLabel:s("auth.ownerPinLabel"),branchLength:0};case"manager":return{showBranch:!1,pinLength:4,pinLabel:s("auth.managerPinLabel"),branchLength:0};case"employee":return{showBranch:!0,pinLength:4,pinLabel:s("auth.employeePinLabel"),branchLength:4}}})(),Ee=d.useCallback(f=>{if(!v){if(f==="delete"){K("light"),n==="employee"?A==="pin"&&S.length>0?F(h=>h.slice(0,-1)):A==="pin"&&S.length===0?(H("branch"),G(h=>h.slice(0,-1))):G(h=>h.slice(0,-1)):F(h=>h.slice(0,-1));return}K("light"),n==="employee"?A==="branch"?k.length<z.branchLength&&G(h=>h+f):S.length<z.pinLength&&F(h=>h+f):S.length<z.pinLength&&F(h=>h+f)}},[n,k,S,v,z,A]);d.useEffect(()=>{if((n==="employee"?k.length>=1&&S.length===z.pinLength:S.length===z.pinLength)&&!v){const h=setTimeout(()=>{K("success"),Le()},100);return()=>clearTimeout(h)}},[S,k,n,z.pinLength,v]);const Le=async()=>{if(n==="employee"){if(k.length===0){W(s("auth.enterBranchCodeFirst")),K("error");return}if(S.length<z.pinLength){W(s("auth.enterEmployeeCode",{digits:z.pinLength})),K("error");return}}else if(S.length<z.pinLength){W(s("auth.enterFullCode",{digits:z.pinLength})),K("error");return}C(!0),W(null);try{const f=n==="employee"?k:"",h=await i(S.trim(),f);K("success"),re(s("auth.loginSuccess")||"تم تسجيل الدخول بنجاح! ✨"),setTimeout(async()=>{j&&te({userId:j.id,tenantId:j.tenantId})},100),o.current=!0;const M=h.role==="owner"?"/owner-dashboard":h.path||"/admin";typeof fetch<"u"&&fetch("http://127.0.0.1:7621/ingest/5c8143c2-2bc0-4f4c-8aac-20487908bb98",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"1e1be3"},body:JSON.stringify({sessionId:"1e1be3",location:"LoginScreen.tsx:handleSubmit",message:"navigate after login",data:{targetPath:M,role:h.role,resultPath:h.path},hypothesisId:"H4",timestamp:Date.now()})}).catch(()=>{}),t(M,{replace:!0})}catch(f){K("error");let h=f.message||s("auth.wrongCode");h.includes("Anonymous Authentication")||h.includes("configuration-not-found")?h=`⚠️ Anonymous Authentication غير مفعل في Firebase Console.

📍 الحل:
Firebase Console → Authentication → Sign-in method → Anonymous → Enable`:(h.includes("offline")||h.includes("الاتصال"))&&(h=`⚠️ لا يوجد اتصال بالإنترنت.

يرجى التحقق من الاتصال والمحاولة مرة أخرى.`),W(h),F("")}finally{C(!1)}},it=async()=>{C(!0),W(null);try{const f=await u();K("success"),t(f||"/admin")}catch(f){K("error"),W(f.message||s("auth.biometricFailed"))}finally{C(!1)}};return d.useEffect(()=>{G(""),F(""),W(null),H("branch")},[n]),e.jsxs("div",{className:`fixed inset-0 overflow-y-auto overflow-x-hidden ${a?"bg-slate-950":"bg-teal-50"}`,style:{transition:"background-color 0.5s ease-in-out",WebkitOverflowScrolling:"touch"},children:[e.jsxs("div",{ref:b,dir:"ltr",className:"fixed top-4 right-4 z-[9999] flex items-center gap-2",style:{left:"auto"},children:[e.jsxs("div",{className:"relative",children:[e.jsx("button",{onClick:()=>{T(f=>!f),K("light")},className:`
              w-10 h-10 rounded-xl flex items-center justify-center
              transition-all duration-500 ease-in-out hover:scale-105 active:scale-95
              ${a?"bg-slate-800/80 text-teal-300 border border-slate-600/50 hover:bg-slate-700/80":"bg-white/80 text-slate-600 border border-slate-200/50 hover:bg-white"}
              backdrop-blur-sm shadow-sm
            `,"aria-label":s("auth.language")||"تغيير اللغة","aria-expanded":g,children:e.jsx(ct,{className:"w-5 h-5"})}),g&&e.jsx("div",{className:`
                absolute top-full mt-2 right-0 min-w-[140px] rounded-xl overflow-hidden shadow-xl
                backdrop-blur-xl border
                ${a?"bg-slate-800/95 border-slate-600/50":"bg-white/95 border-slate-200/50"}
              `,style:{left:"auto"},children:ba.map(f=>{const h=(c.language||"").startsWith(f.code);return e.jsxs("button",{onClick:async()=>{await Tt(f.code),Rt(f.code),T(!1),K("medium")},className:`
                      w-full flex items-center gap-2 px-3 py-2.5 text-sm text-start transition-colors
                      ${h?a?"bg-teal-500/20 text-teal-300":"bg-teal-500/15 text-teal-700":a?"text-slate-200 hover:bg-slate-700/80":"text-slate-700 hover:bg-slate-100"}
                    `,children:[e.jsx("span",{children:f.nativeName}),h&&e.jsx(se,{className:"w-4 h-4 shrink-0 text-primary-500"})]},f.code)})})]}),e.jsx("button",{onClick:()=>{p(),K("medium")},className:`
            w-10 h-10 rounded-xl flex items-center justify-center
            transition-all duration-500 ease-in-out hover:scale-105 active:scale-95
            ${a?"bg-slate-800/80 text-amber-300 border border-slate-600/50 hover:bg-slate-700/80":"bg-white/80 text-slate-600 border border-slate-200/50 hover:bg-white"}
            backdrop-blur-sm shadow-sm
          `,"aria-label":s(a?"auth.dayMode":"auth.nightMode"),children:a?e.jsx(Ze,{className:"w-5 h-5"}):e.jsx(Qe,{className:"w-5 h-5"})})]}),e.jsxs("div",{className:"min-h-screen flex flex-col items-center justify-between p-4 py-6 relative transition-all duration-[1500ms] ease-in-out",style:{minHeight:"100dvh"},children:[e.jsxs("div",{className:`absolute inset-0 premium-bg transition-all duration-[1500ms] ease-in-out ${a?"opacity-0":"opacity-100"}`,children:[e.jsx("div",{className:"absolute inset-0 bg-gradient-to-br from-teal-50 via-cyan-50 to-emerald-50"}),e.jsx("div",{className:"absolute inset-0 aurora-gradient"}),e.jsx("div",{className:"absolute bottom-0 left-0 right-0 h-64 wave-bg"}),e.jsx("div",{className:"absolute -top-32 -left-32 w-[500px] h-[500px] orb orb-1"}),e.jsx("div",{className:"absolute -bottom-32 -right-32 w-[450px] h-[450px] orb orb-2"}),e.jsx("div",{className:"absolute top-1/3 right-0 w-[350px] h-[350px] orb orb-3"}),e.jsx("div",{className:"absolute inset-0 hex-pattern"}),e.jsx("div",{className:"shape shape-1",children:"◆"}),e.jsx("div",{className:"shape shape-2",children:"○"}),e.jsx("div",{className:"shape shape-3",children:"◇"}),e.jsx("div",{className:"shape shape-4",children:"●"}),e.jsx("div",{className:"shape shape-5",children:"△"}),e.jsx("div",{className:"absolute top-10 right-10 w-48 h-48 bg-gradient-to-br from-teal-400/30 to-cyan-400/20 rounded-full blur-3xl glow-pulse"})]}),e.jsxs("div",{className:`absolute inset-0 transition-all duration-[1500ms] ease-in-out ${a?"opacity-100":"opacity-0"}`,children:[e.jsx("div",{className:"absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950"}),e.jsx("div",{className:`absolute bottom-0 left-0 right-0 h-96 bg-gradient-to-t from-orange-900/20 via-purple-900/10 to-transparent transition-opacity duration-[2000ms] ${a?"opacity-100":"opacity-0"}`}),e.jsxs("div",{className:"absolute inset-0 overflow-hidden",children:[e.jsx("div",{className:"absolute top-0 left-1/4 w-[600px] h-[400px] bg-gradient-to-b from-teal-500/10 via-cyan-500/5 to-transparent blur-3xl animate-pulse",style:{animationDuration:"8s"}}),e.jsx("div",{className:"absolute top-20 right-1/4 w-[500px] h-[300px] bg-gradient-to-b from-purple-500/10 via-indigo-500/5 to-transparent blur-3xl animate-pulse",style:{animationDuration:"10s",animationDelay:"2s"}})]}),e.jsx("div",{className:"absolute inset-0 stars-container",children:[...Array(50)].map((f,h)=>e.jsx("div",{className:"absolute rounded-full bg-white animate-twinkle",style:{width:`${Math.random()*3+1}px`,height:`${Math.random()*3+1}px`,top:`${Math.random()*70}%`,left:`${Math.random()*100}%`,animationDelay:`${Math.random()*3}s`,animationDuration:`${Math.random()*2+2}s`,opacity:Math.random()*.7+.3}},h))}),e.jsx("div",{className:"absolute top-1/4 right-1/4 w-1 h-1 bg-white rounded-full animate-shooting-star"}),e.jsx("div",{className:"absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-slate-900/50 to-transparent"})]}),e.jsxs("div",{className:`absolute inset-0 transition-opacity duration-[1500ms] ${a?"opacity-30":"opacity-100"}`,children:[e.jsx("div",{className:"absolute top-0 left-0 w-64 h-64 corner-decoration corner-tl"}),e.jsx("div",{className:"absolute bottom-0 right-0 w-64 h-64 corner-decoration corner-br"})]}),e.jsx("div",{className:`absolute top-10 right-10 w-48 h-48 rounded-full blur-3xl glow-pulse transition-all duration-[1500ms] ${a?"bg-gradient-to-br from-purple-500/20 to-indigo-500/10":"bg-gradient-to-br from-teal-400/30 to-cyan-400/20"}`}),e.jsx("div",{className:`absolute bottom-20 left-10 w-56 h-56 rounded-full blur-3xl glow-pulse-delay transition-all duration-[1500ms] ${a?"bg-gradient-to-br from-indigo-500/20 to-purple-500/10":"bg-gradient-to-br from-emerald-400/25 to-teal-400/15"}`}),e.jsx("div",{className:`absolute top-1/2 left-1/4 w-32 h-32 rounded-full blur-2xl animate-pulse transition-all duration-[1500ms] ${a?"bg-gradient-to-br from-cyan-500/15 to-blue-500/10":"bg-gradient-to-br from-amber-400/20 to-orange-400/10"}`}),e.jsxs("div",{className:`w-full max-w-xs sm:max-w-sm relative z-10 transition-all duration-1000 ease-out px-2 sm:px-0 ${r?"opacity-100 translate-y-0 scale-100":"opacity-0 translate-y-12 scale-95"}`,style:{animation:r?"loginEntrance 0.8s ease-out forwards":"none"},children:[e.jsxs("div",{className:"text-center mb-4 sm:mb-6",children:[e.jsxs("div",{className:"relative inline-flex items-center justify-center mb-3 sm:mb-5",style:{width:"clamp(140px, 40vw, 220px)",height:"clamp(140px, 40vw, 220px)"},children:[e.jsx("div",{className:"absolute inset-0 flex items-center justify-center",children:e.jsx("div",{className:`absolute w-full h-full rounded-full blur-3xl animate-pulse transition-colors duration-1000 ${a?"bg-gradient-to-br from-amber-400/10 to-orange-400/10":"bg-gradient-to-br from-teal-400/10 to-cyan-400/10"}`})}),e.jsx("div",{className:"absolute inset-0 flex items-center justify-center pointer-events-none",children:e.jsx("div",{className:"absolute w-full h-full rounded-full transition-all duration-1000",style:{background:a?"conic-gradient(from 180deg, #fef3c7 0deg, rgba(254,243,199,0.7) 90deg, rgba(254,243,199,0.3) 160deg, transparent 180deg, transparent 360deg)":"conic-gradient(from 180deg, #fbbf24 0deg, rgba(251,191,36,0.7) 90deg, rgba(251,191,36,0.3) 160deg, transparent 180deg, transparent 360deg)",opacity:a?.8:.7,filter:a?"drop-shadow(0 0 8px rgba(253, 230, 138, 0.4))":"drop-shadow(0 0 8px rgba(251, 191, 36, 0.4))",mask:"radial-gradient(circle, transparent 88%, black 90%, black 93%, transparent 95%)",WebkitMask:"radial-gradient(circle, transparent 88%, black 90%, black 93%, transparent 95%)"}})}),e.jsxs("div",{className:"absolute inset-0 flex items-center justify-center pointer-events-none",children:[e.jsx("div",{className:"absolute rounded-full animate-orbit-1",style:{width:"80%",height:"80%",border:`1px dashed ${a?"rgba(148, 163, 184, 0.2)":"rgba(13, 148, 136, 0.35)"}`},children:e.jsx("div",{className:`absolute w-1.5 h-1.5 rounded-full ${a?"bg-amber-400/70":"bg-teal-500/70"}`,style:{top:"0%",left:"50%",transform:"translate(-50%, -50%)"}})}),e.jsx("div",{className:"absolute rounded-full animate-orbit-2",style:{width:"95%",height:"95%",border:`1px dashed ${a?"rgba(148, 163, 184, 0.15)":"rgba(13, 148, 136, 0.25)"}`},children:e.jsx("div",{className:`absolute w-2 h-2 rounded-full ${a?"bg-cyan-400/60":"bg-cyan-600/60"}`,style:{top:"50%",right:"0%",transform:"translate(50%, -50%)"}})}),e.jsx("div",{className:"absolute rounded-full animate-orbit-3",style:{width:"110%",height:"110%",border:`1px dashed ${a?"rgba(148, 163, 184, 0.1)":"rgba(13, 148, 136, 0.18)"}`},children:e.jsx("div",{className:`absolute w-1 h-1 rounded-full ${a?"bg-purple-400/50":"bg-emerald-500/50"}`,style:{bottom:"0%",left:"50%",transform:"translate(-50%, 50%)"}})})]}),e.jsx("div",{className:"relative z-10",children:e.jsx("img",{src:localStorage.getItem("adora_platform_logo")??"/adora-logo.png",alt:s("auth.welcomeMessage"),className:"logo-float logo-crisp",style:{width:"clamp(80px, 25vw, 160px)",height:"auto",filter:a?"drop-shadow(0 10px 30px rgba(251, 191, 36, 0.3))":"drop-shadow(0 10px 30px rgba(20, 184, 166, 0.4))",transition:"filter 1s ease-in-out"},loading:"eager",decoding:"sync"})}),e.jsx("div",{className:`absolute -top-1 right-2 w-2.5 h-2.5 sm:w-4 sm:h-4 rounded-full animate-sparkle ${a?"bg-amber-300":"bg-yellow-400"}`}),e.jsx("div",{className:`absolute top-1/4 -left-1 w-2 h-2 sm:w-3 sm:h-3 rounded-full animate-sparkle-delay ${a?"bg-orange-300":"bg-cyan-400"}`}),e.jsx("div",{className:`absolute -bottom-1 right-1/4 w-2 h-2 sm:w-3 sm:h-3 rounded-full animate-sparkle-delay-2 ${a?"bg-yellow-200":"bg-teal-300"}`})]}),e.jsxs("div",{className:"space-y-1 sm:space-y-2 animate-fade-up",children:[e.jsxs("p",{className:`flex items-center justify-center gap-2 text-lg sm:text-2xl font-bold ${a?"text-white":"text-teal-800"}`,children:[e.jsx("span",{className:"text-xl sm:text-3xl",children:ae.emoji}),e.jsx("span",{className:`bg-clip-text text-transparent ${a?"bg-gradient-to-r from-teal-300 to-cyan-300":"bg-gradient-to-r from-teal-700 to-teal-500"}`,children:ae.greeting}),e.jsx(lt,{className:`w-5 h-5 sm:w-6 sm:h-6 ${ae.iconColor} animate-bounce-gentle`})]}),e.jsx("p",{className:`text-xs sm:text-base font-medium ${a?"text-slate-300":"text-teal-600"}`,children:s("auth.welcomeMessage")}),e.jsxs("p",{className:`text-[10px] sm:text-sm italic hidden sm:block ${a?"text-slate-400":"text-teal-500/80"}`,children:["✨ ",ae.message," ✨"]})]})]}),e.jsxs("div",{className:`rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl transition-all duration-500 ${a?"bg-slate-800/95 border-slate-700 shadow-slate-900/30":"bg-white border-teal-100 shadow-teal-900/10"} border`,children:[e.jsxs("div",{className:"flex gap-1.5 sm:gap-2 mb-4 sm:mb-5",children:[e.jsx(Ce,{type:"employee",active:n==="employee",onClick:()=>w("employee"),icon:e.jsx(ke,{className:"w-4 h-4"}),label:s("auth.employee"),color:"from-teal-500 to-teal-600 shadow-teal-500/30",isDark:a}),e.jsx(Ce,{type:"manager",active:n==="manager",onClick:()=>w("manager"),icon:e.jsx(be,{className:"w-4 h-4"}),label:s("auth.manager"),color:"from-blue-500 to-blue-600 shadow-blue-500/30",isDark:a}),e.jsx(Ce,{type:"owner",active:n==="owner",onClick:()=>w("owner"),icon:e.jsx(Te,{className:"w-4 h-4"}),label:s("auth.owner"),color:"from-amber-500 to-amber-600 shadow-amber-500/30",isDark:a})]}),L&&e.jsxs("div",{className:"fixed left-1/2 -translate-x-1/2 top-[max(1rem,env(safe-area-inset-top))] z-[200] px-4 py-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300 shadow-lg max-w-[calc(100vw-2rem)]",children:[e.jsx(dt,{className:"w-4 h-4 text-red-500 flex-shrink-0"}),e.jsx("p",{className:"text-red-600 text-sm",children:L})]}),J&&e.jsxs("div",{className:"fixed left-1/2 -translate-x-1/2 top-[max(1rem,env(safe-area-inset-top))] z-[200] px-4 py-3 rounded-xl bg-green-50 border border-green-200 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300 shadow-lg max-w-[calc(100vw-2rem)]",children:[e.jsx(se,{className:"w-4 h-4 text-green-500 flex-shrink-0"}),e.jsx("p",{className:"text-green-600 text-sm",children:J})]}),z.showBranch&&e.jsxs("div",{className:`mb-4 p-3 rounded-xl cursor-pointer transition-all ${A==="branch"?a?"bg-teal-900/30 border-2 border-teal-500 shadow-sm":"bg-teal-50 border-2 border-teal-400 shadow-sm":a?"bg-slate-700/50 border-2 border-slate-600 hover:border-slate-500":"bg-slate-50 border-2 border-slate-200 shadow-sm hover:border-slate-300"}`,onClick:()=>{H("branch"),K("light")},children:[e.jsxs("div",{className:"flex items-center justify-between mb-2",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(he,{className:`w-4 h-4 ${A==="branch"?"text-teal-500":"text-slate-400"}`}),e.jsx("span",{className:`text-sm font-medium ${A==="branch"?a?"text-teal-400":"text-teal-700":a?"text-slate-300":"text-slate-500"}`,children:s("auth.branchCodeLabel")}),A==="branch"&&e.jsxs("span",{className:"text-xs text-teal-500 animate-pulse",children:["● ",s("auth.activeLabel")]})]}),e.jsxs("span",{className:"text-xs text-slate-400",children:[k.length,"/1-4"]})]}),e.jsx("div",{className:"flex justify-center gap-2",children:[...Array(z.branchLength)].map((f,h)=>e.jsx(He,{filled:h<k.length,value:k[h],showValue:!0,index:h,isDark:a},`branch-${h}`))}),A==="branch"&&k.length>0&&e.jsxs("p",{className:`text-center text-xs mt-2 ${a?"text-teal-400":"text-teal-600"}`,children:["✓ ",s("auth.afterBranchEnterPin")||'بعد إدخال كود الفرع، اضغط على "كود الموظف" للمتابعة']})]}),e.jsxs("div",{className:`mb-5 p-3 rounded-xl cursor-pointer transition-all ${A==="pin"||n!=="employee"?a?"bg-teal-900/30 border-2 border-teal-500 shadow-sm":"bg-teal-50 border-2 border-teal-400 shadow-sm":a?"bg-slate-700/50 border-2 border-slate-600 hover:border-slate-500":"bg-slate-50 border-2 border-slate-200 shadow-sm hover:border-slate-300"}`,onClick:()=>{n==="employee"&&(H("pin"),K("light"))},children:[e.jsxs("div",{className:"flex items-center justify-between mb-2",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[n==="owner"&&e.jsx(Te,{className:"w-4 h-4 text-amber-500"}),n==="manager"&&e.jsx(be,{className:"w-4 h-4 text-blue-500"}),n==="employee"&&e.jsx(ke,{className:`w-4 h-4 ${A==="pin"?"text-teal-500":"text-slate-400"}`}),e.jsx("span",{className:`text-sm font-medium ${A==="pin"||n!=="employee"?a?"text-teal-400":"text-teal-700":a?"text-slate-300":"text-slate-500"}`,children:z.pinLabel}),(A==="pin"||n!=="employee")&&e.jsxs("span",{className:"text-xs text-teal-500 animate-pulse",children:["● ",s("auth.activeLabel")]})]}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsxs("span",{className:"text-xs text-slate-400",children:[S.length,"/",z.pinLength]}),e.jsx("button",{onClick:f=>{f.stopPropagation(),m(!q)},className:`p-1 rounded-lg transition-colors ${a?"hover:bg-slate-600":"hover:bg-slate-100"}`,children:q?e.jsx(et,{className:"w-4 h-4 text-slate-400"}):e.jsx(tt,{className:"w-4 h-4 text-slate-400"})})]})]}),e.jsx("div",{className:"flex justify-center gap-2",children:[...Array(z.pinLength)].map((f,h)=>e.jsx(He,{filled:h<S.length,value:S[h],showValue:q,index:h,isDark:a},`pin-${h}`))})]}),e.jsxs("div",{className:"grid grid-cols-3 gap-2 sm:gap-3 mb-4",dir:"ltr",children:[[1,2,3,4,5,6,7,8,9].map(f=>e.jsx(Ie,{value:String(f),onClick:()=>Ee(String(f)),disabled:v,isDark:a},f)),e.jsx(Ie,{value:"delete",variant:"delete",onClick:()=>Ee("delete"),disabled:v,isDark:a}),e.jsx(Ie,{value:"0",onClick:()=>Ee("0"),disabled:v,isDark:a}),e.jsx("button",{onClick:V?it:Le,disabled:v,className:`h-14 sm:h-16 rounded-xl flex items-center justify-center gap-2 min-w-[5rem]
                         bg-gradient-to-br from-teal-500 to-teal-600 text-white
                         shadow-[0_0_20px_rgba(20,184,166,0.5),0_4px_12px_rgba(20,184,166,0.3)]
                         hover:shadow-[0_0_30px_rgba(20,184,166,0.6),0_6px_16px_rgba(20,184,166,0.4)]
                         active:scale-95 transition-all disabled:opacity-50
                         ${v?"login-btn-loading cursor-wait":""}`,children:v?e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"w-5 h-5 sm:w-6 sm:h-6 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0"}),e.jsx("span",{className:"text-xs sm:text-sm font-medium animate-pulse",children:s("auth.loggingIn")})]}):e.jsx(mt,{className:"w-5 h-5 sm:w-6 sm:h-6"})})]}),e.jsx("p",{className:"text-center text-xs mt-3 text-slate-400",children:n==="employee"?s("auth.enterBranchThenEmployee")||"أدخل كود الفرع (1-4 أرقام) ثم كود الموظف (4 أرقام)":n==="manager"?s("auth.enterManagerCode")||"أدخل كود المدير (4 أرقام)":s("auth.enterOwnerCode")||"أدخل كود المالك (6 أرقام)"}),e.jsxs("button",{type:"button",onClick:()=>{const f=R.phoneSA||"966570707121",h=localStorage.getItem("adora_branch_name")||s("auth.branchNotSpecified"),M=encodeURIComponent(s("auth.forgotCodeMessage",{branch:h}));window.open(`https://wa.me/${f}?text=${M}`,"_blank")},className:`w-full mt-3 py-2 text-center text-sm transition-colors ${a?"text-teal-400 hover:text-teal-300":"text-teal-600 hover:text-teal-700"} hover:underline`,children:["🔑 ",s("auth.forgotCode")]})]}),y&&Y&&e.jsx(Ot,{onComplete:()=>{O(!1),te(null)},onSkip:()=>{O(!1),te(null)}})]}),e.jsx("style",{children:`
        /* Login button: pulse glow while logging in */
        .login-btn-loading {
          animation: loginBtnPulse 1.5s ease-in-out infinite;
        }
        @keyframes loginBtnPulse {
          0%, 100% {
            box-shadow: 0 0 20px rgba(20,184,166,0.5), 0 4px 12px rgba(20,184,166,0.3);
          }
          50% {
            box-shadow: 0 0 28px rgba(20,184,166,0.7), 0 6px 16px rgba(20,184,166,0.5);
          }
        }

        @keyframes popIn {
          0% { transform: scale(0.5); opacity: 0; }
          60% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        
        /* ============================================
           PREMIUM BACKGROUND EFFECTS
           ============================================ */
        
        /* Aurora animated gradient */
        .aurora-gradient {
          background: 
            linear-gradient(125deg, 
              rgba(20, 184, 166, 0.15) 0%, 
              transparent 40%),
            linear-gradient(225deg, 
              rgba(6, 182, 212, 0.12) 0%, 
              transparent 40%),
            linear-gradient(315deg, 
              rgba(16, 185, 129, 0.1) 0%, 
              transparent 40%);
          animation: auroraMove 15s ease-in-out infinite;
        }
        @keyframes auroraMove {
          0%, 100% { opacity: 0.8; transform: scale(1) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.05) rotate(1deg); }
        }
        
        /* Wave background */
        .wave-bg {
          background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 320'%3E%3Cpath fill='%2314b8a6' fill-opacity='0.05' d='M0,160L48,176C96,192,192,224,288,213.3C384,203,480,149,576,138.7C672,128,768,160,864,181.3C960,203,1056,213,1152,202.7C1248,192,1344,160,1392,144L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z'%3E%3C/path%3E%3C/svg%3E");
          background-size: cover;
          background-position: bottom;
          animation: waveMove 8s ease-in-out infinite;
        }
        @keyframes waveMove {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(-20px); }
        }
        
        /* Floating orbs - Enhanced */
        .orb {
          border-radius: 50%;
          filter: blur(60px);
          animation: orbFloat 20s ease-in-out infinite;
        }
        .orb-1 {
          background: radial-gradient(circle, rgba(20, 184, 166, 0.4) 0%, rgba(6, 182, 212, 0.2) 50%, transparent 70%);
          animation-delay: 0s;
        }
        .orb-2 {
          background: radial-gradient(circle, rgba(6, 182, 212, 0.35) 0%, rgba(16, 185, 129, 0.15) 50%, transparent 70%);
          animation-delay: -7s;
        }
        .orb-3 {
          background: radial-gradient(circle, rgba(45, 212, 191, 0.3) 0%, rgba(20, 184, 166, 0.1) 50%, transparent 70%);
          animation-delay: -14s;
        }
        @keyframes orbFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(30px, -20px) scale(1.1); }
          50% { transform: translate(0, -40px) scale(1); }
          75% { transform: translate(-30px, -20px) scale(1.1); }
        }
        
        /* Hexagon pattern */
        .hex-pattern {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cg fill-rule='evenodd'%3E%3Cg fill='%2314b8a6' fill-opacity='0.04'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
        }
        
        /* Animated decorative lines */
        .line {
          position: absolute;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(20, 184, 166, 0.3), transparent);
          animation: lineMove 8s linear infinite;
        }
        .line-1 {
          top: 20%;
          left: -100%;
          width: 200%;
          animation-delay: 0s;
        }
        .line-2 {
          top: 50%;
          left: -100%;
          width: 200%;
          animation-delay: -2.5s;
          opacity: 0.5;
        }
        .line-3 {
          top: 80%;
          left: -100%;
          width: 200%;
          animation-delay: -5s;
          opacity: 0.3;
        }
        @keyframes lineMove {
          0% { transform: translateX(0) rotate(-2deg); }
          100% { transform: translateX(50%) rotate(-2deg); }
        }
        
        /* Floating shapes */
        .shape {
          position: absolute;
          font-size: 24px;
          color: rgba(20, 184, 166, 0.15);
          animation: shapeFloat 15s ease-in-out infinite;
        }
        .shape-1 { top: 15%; left: 10%; animation-delay: 0s; font-size: 32px; }
        .shape-2 { top: 25%; right: 15%; animation-delay: -3s; font-size: 20px; }
        .shape-3 { bottom: 35%; left: 8%; animation-delay: -6s; font-size: 28px; }
        .shape-4 { top: 55%; right: 12%; animation-delay: -9s; font-size: 16px; }
        .shape-5 { bottom: 25%; right: 20%; animation-delay: -12s; font-size: 22px; }
        @keyframes shapeFloat {
          0%, 100% { 
            transform: translate(0, 0) rotate(0deg); 
            opacity: 0.15;
          }
          25% { 
            transform: translate(20px, -30px) rotate(90deg); 
            opacity: 0.25;
          }
          50% { 
            transform: translate(0, -50px) rotate(180deg); 
            opacity: 0.1;
          }
          75% { 
            transform: translate(-20px, -30px) rotate(270deg); 
            opacity: 0.2;
          }
        }
        
        /* Corner decorations */
        .corner-decoration {
          background: linear-gradient(135deg, rgba(20, 184, 166, 0.1) 0%, transparent 50%);
        }
        .corner-tl {
          border-radius: 0 0 100% 0;
        }
        .corner-br {
          border-radius: 100% 0 0 0;
          background: linear-gradient(315deg, rgba(6, 182, 212, 0.08) 0%, transparent 50%);
        }
        
        /* Glow pulse animations */
        .glow-pulse {
          animation: glowPulse 4s ease-in-out infinite;
        }
        .glow-pulse-delay {
          animation: glowPulse 4s ease-in-out infinite 2s;
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.15); }
        }
        
        /* ============================================
           LOGO ANIMATIONS
           ============================================ */
        
        /* Logo floating animation */
        .logo-float {
          animation: logoFloat 4s ease-in-out infinite;
        }
        @keyframes logoFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-6px) rotate(1deg); }
          50% { transform: translateY(-12px) rotate(0deg); }
          75% { transform: translateY(-6px) rotate(-1deg); }
        }
        
        /* Slow ping for rings */
        .animate-ping-slow {
          animation: pingSlow 3s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        @keyframes pingSlow {
          0% { transform: scale(0.9); opacity: 0.5; }
          50% { transform: scale(1.1); opacity: 0; }
          100% { transform: scale(0.9); opacity: 0.5; }
        }
        
        /* Slow spin for outer ring */
        .animate-spin-slow {
          animation: spinSlow 20s linear infinite;
        }
        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        /* 🪐 Orbital animations - Planets around the sun */
        .animate-orbit-1 {
          animation: orbit 12s linear infinite;
        }
        .animate-orbit-2 {
          animation: orbit 18s linear infinite reverse;
        }
        .animate-orbit-3 {
          animation: orbit 25s linear infinite;
        }
        @keyframes orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        /* Sparkle effects */
        .animate-sparkle {
          animation: sparkle 2s ease-in-out infinite;
        }
        .animate-sparkle-delay {
          animation: sparkle 2s ease-in-out infinite 0.5s;
        }
        .animate-sparkle-delay-2 {
          animation: sparkle 2s ease-in-out infinite 1s;
        }
        @keyframes sparkle {
          0%, 100% { opacity: 0; transform: scale(0); }
          50% { opacity: 1; transform: scale(1); }
        }
        
        /* Gentle bounce for icon */
        .animate-bounce-gentle {
          animation: bounceGentle 2s ease-in-out infinite;
        }
        @keyframes bounceGentle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        
        /* Fade up animation */
        .animate-fade-up {
          animation: fadeUp 0.8s ease-out forwards;
        }
        @keyframes fadeUp {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        
        /* Logo container entrance */
        .logo-container {
          animation: logoEntrance 1s ease-out forwards;
        }
        @keyframes logoEntrance {
          0% { 
            opacity: 0; 
            transform: scale(0.5) rotate(-10deg); 
          }
          60% { 
            transform: scale(1.1) rotate(3deg); 
          }
          100% { 
            opacity: 1; 
            transform: scale(1) rotate(0deg); 
          }
        }
        
        /* Ultra crisp logo rendering */
        .logo-crisp {
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
          -webkit-backface-visibility: hidden;
          backface-visibility: hidden;
          transform: translateZ(0);
          -webkit-transform: translateZ(0);
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        
        /* For high DPI screens */
        @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
          .logo-crisp {
            image-rendering: auto;
          }
        }
        
        /* ✨ Twinkling stars animation */
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.5); }
        }
        .animate-twinkle {
          animation: twinkle ease-in-out infinite;
        }
        
        /* 🌠 Shooting star animation */
        @keyframes shootingStar {
          0% {
            opacity: 0;
            transform: translate(0, 0) scale(1);
          }
          10% {
            opacity: 1;
          }
          70% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(-300px, 300px) scale(0);
          }
        }
        .animate-shooting-star {
          animation: shootingStar 4s ease-out infinite;
          animation-delay: 3s;
          box-shadow: 0 0 10px 2px rgba(255, 255, 255, 0.8),
                      -100px -100px 20px 0px rgba(255, 255, 255, 0.1);
        }
        
        /* 🌅 Sunset transition overlay */
        @keyframes sunsetGlow {
          0% { opacity: 0; }
          50% { opacity: 0.4; }
          100% { opacity: 0; }
        }
        
        /* 🌙 Gentle moon sway animation */
        @keyframes moonSway {
          0%, 100% { 
            transform: translateY(0) rotate(-5deg); 
          }
          50% { 
            transform: translateY(-8px) rotate(5deg); 
          }
        }
        .animate-moon-sway {
          animation: moonSway 6s ease-in-out infinite;
        }
        
        /* Very slow spin for sun rays */
        @keyframes spinVerySlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-very-slow {
          animation: spinVerySlow 30s linear infinite;
        }
        
        /* ✅ Beautiful login entrance animation */
        @keyframes loginEntrance {
          0% {
            opacity: 0;
            transform: translateY(40px) scale(0.95);
          }
          60% {
            opacity: 0.8;
            transform: translateY(-5px) scale(1.02);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `})]})]})},ns=Object.freeze(Object.defineProperty({__proto__:null,default:nt},Symbol.toStringTag,{value:"Module"})),ja=()=>{const t=_e(),[l,s]=d.useState(0),[c,i]=d.useState(!1),[u,x]=d.useState(!1),[I,j]=d.useState(""),[_,B]=d.useState("الفرع الرئيسي"),[p,a]=d.useState([1,2,3]),[g,T]=d.useState(10),[b,o]=d.useState([{name:"مدير النظام",code:"9999",department:"admin"},{name:"موظف الاستقبال",code:"1111",department:"reception"},{name:"موظف الهاوس كيبنج",code:"2222",department:"housekeeping"},{name:"موظف الصيانة",code:"3333",department:"maintenance"},{name:"موظف البيلمان",code:"4444",department:"bellman"}]),[n,w]=d.useState([{name:"ماء",price:3,category:"minibar"},{name:"بيبسي",price:5,category:"minibar"},{name:"سبرايت",price:5,category:"minibar"},{name:"عصير برتقال",price:6,category:"minibar"},{name:"شيبس",price:7,category:"minibar"},{name:"شوكولاتة",price:8,category:"minibar"}]),k=[{id:"hotel",title:"معلومات الفندق",icon:e.jsx(xt,{className:"w-5 h-5"}),completed:!!I},{id:"rooms",title:"الغرف",icon:e.jsx(pt,{className:"w-5 h-5"}),completed:p.length>0},{id:"employees",title:"الموظفين",icon:e.jsx(ve,{className:"w-5 h-5"}),completed:b.length>0},{id:"products",title:"المنتجات",icon:e.jsx(gt,{className:"w-5 h-5"}),completed:n.length>0}];d.useEffect(()=>{(async()=>{(await pa(me(de,"users"))).docs.length>0&&x(!0)})()},[]);const G=()=>{o([...b,{name:"",code:"",department:"reception"}])},S=m=>{o(b.filter((v,C)=>C!==m))},F=()=>{w([...n,{name:"",price:0,category:"minibar"}])},A=m=>{w(n.filter((v,C)=>C!==m))},H=async()=>{i(!0);try{await we(me(de,"settings"),{hotelName:I,branchName:_,createdAt:ga.now()});for(const m of p)for(let v=1;v<=g;v++){const C=`${m}${v.toString().padStart(2,"0")}`;await we(me(de,"rooms"),{number:C,floor:m,type:"standard",status:"available",currentGuestId:null})}for(const m of b)m.name&&m.code&&await we(me(de,"users"),{name:m.name,code:m.code,department:m.department,role:m.department==="admin"?"manager":"staff",points:0,status:"active"});for(const m of n)m.name&&m.price>0&&await we(me(de,"products"),{name:m.name,price:m.price,category:m.category,stock:100});x(!0),t("/login")}catch{}finally{i(!1)}},q=()=>{switch(l){case 0:return e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{children:[e.jsx("label",{className:"block text-sm text-white/70 mb-2",children:"اسم الفندق"}),e.jsx("input",{type:"text",value:I,onChange:m=>j(m.target.value),className:"input",placeholder:"فندق أدورا"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"block text-sm text-white/70 mb-2",children:"اسم الفرع"}),e.jsx("input",{type:"text",value:_,onChange:m=>B(m.target.value),className:"input",placeholder:"الفرع الرئيسي"})]})]});case 1:return e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{children:[e.jsx("label",{className:"block text-sm text-white/70 mb-2",children:"عدد الأدوار"}),e.jsx("div",{className:"flex gap-2 flex-wrap",children:[1,2,3,4,5,6,7,8,9,10].map(m=>e.jsx("button",{onClick:()=>a(Array.from({length:m},(v,C)=>C+1)),className:`w-10 h-10 rounded-lg ${p.length===m?"bg-primary-500 text-white":"glass text-white/60"}`,children:m},m))})]}),e.jsxs("div",{children:[e.jsx("label",{className:"block text-sm text-white/70 mb-2",children:"عدد الغرف لكل دور"}),e.jsx("input",{type:"number",value:g,onChange:m=>T(Number(m.target.value)),className:"input",min:1,max:50})]}),e.jsx("div",{className:"p-4 rounded-xl bg-primary-500/20",children:e.jsxs("p",{className:"text-white",children:["سيتم إنشاء ",e.jsx("strong",{children:p.length*g})," غرفة"]})})]});case 2:return e.jsxs("div",{className:"space-y-3 max-h-[50vh] overflow-y-auto",children:[b.map((m,v)=>e.jsxs("div",{className:"flex gap-2 items-center",children:[e.jsx("input",{type:"text",value:m.name,onChange:C=>{const L=[...b];L[v].name=C.target.value,o(L)},className:"input flex-1",placeholder:"الاسم"}),e.jsx("input",{type:"text",value:m.code,onChange:C=>{const L=[...b];L[v].code=C.target.value,o(L)},className:"input w-20",placeholder:"PIN",maxLength:4}),e.jsxs("select",{value:m.department,onChange:C=>{const L=[...b];L[v].department=C.target.value,o(L)},className:"input w-32",children:[e.jsx("option",{value:"admin",children:"إدارة"}),e.jsx("option",{value:"reception",children:"استقبال"}),e.jsx("option",{value:"housekeeping",children:"هاوس كيبنج"}),e.jsx("option",{value:"maintenance",children:"صيانة"}),e.jsx("option",{value:"bellman",children:"بيلمان"}),e.jsx("option",{value:"procurement",children:"مشتريات"})]}),e.jsx("button",{onClick:()=>S(v),className:"w-10 h-10 rounded-lg glass text-red-400 hover:bg-red-500/20",children:e.jsx(Re,{className:"w-4 h-4 mx-auto"})})]},v)),e.jsxs("button",{onClick:G,className:"btn-secondary w-full",children:[e.jsx(Oe,{className:"w-4 h-4"}),"إضافة موظف"]})]});case 3:return e.jsxs("div",{className:"space-y-3 max-h-[50vh] overflow-y-auto",children:[n.map((m,v)=>e.jsxs("div",{className:"flex gap-2 items-center",children:[e.jsx("input",{type:"text",value:m.name,onChange:C=>{const L=[...n];L[v].name=C.target.value,w(L)},className:"input flex-1",placeholder:"اسم المنتج"}),e.jsx("input",{type:"number",value:m.price,onChange:C=>{const L=[...n];L[v].price=Number(C.target.value),w(L)},className:"input w-20",placeholder:"السعر"}),e.jsxs("select",{value:m.category,onChange:C=>{const L=[...n];L[v].category=C.target.value,w(L)},className:"input w-28",children:[e.jsx("option",{value:"minibar",children:"ميني بار"}),e.jsx("option",{value:"amenities",children:"مستلزمات"})]}),e.jsx("button",{onClick:()=>A(v),className:"w-10 h-10 rounded-lg glass text-red-400 hover:bg-red-500/20",children:e.jsx(Re,{className:"w-4 h-4 mx-auto"})})]},v)),e.jsxs("button",{onClick:F,className:"btn-secondary w-full",children:[e.jsx(Oe,{className:"w-4 h-4"}),"إضافة منتج"]})]});default:return null}};return u?e.jsx("div",{className:"min-h-screen theme-page flex items-center justify-center p-4",children:e.jsxs("div",{className:"glass rounded-3xl p-8 text-center max-w-md",children:[e.jsx(se,{className:"w-16 h-16 text-green-400 mx-auto mb-4"}),e.jsx("h1",{className:"text-2xl font-bold text-white mb-2",children:"تم الإعداد مسبقاً"}),e.jsx("p",{className:"text-white/60 mb-6",children:"النظام جاهز للاستخدام"}),e.jsx("button",{onClick:()=>t("/login"),className:"btn-primary w-full",children:"الذهاب لتسجيل الدخول"})]})}):e.jsx("div",{className:"min-h-screen theme-page flex items-center justify-center p-4",children:e.jsxs("div",{className:"glass rounded-3xl p-6 w-full max-w-2xl",children:[e.jsxs("div",{className:"text-center mb-6",children:[e.jsx("h1",{className:"text-2xl font-bold text-white mb-2",children:"إعداد النظام"}),e.jsxs("p",{className:"text-white/60",children:["الخطوة ",l+1," من ",k.length]})]}),e.jsx("div",{className:"flex justify-center gap-2 mb-6",children:k.map((m,v)=>e.jsx("div",{className:`w-10 h-10 rounded-full flex items-center justify-center ${v===l?"bg-primary-500 text-white":v<l?"bg-green-500/20 text-green-400":"glass text-white/40"}`,children:v<l?e.jsx(se,{className:"w-5 h-5"}):m.icon},m.id))}),e.jsx("h2",{className:"text-xl font-bold text-white text-center mb-4",children:k[l].title}),e.jsx("div",{className:"mb-6",children:q()}),e.jsxs("div",{className:"flex gap-3",children:[l>0&&e.jsxs("button",{onClick:()=>s(l-1),className:"btn-secondary flex-1",children:[e.jsx(ue,{className:"w-5 h-5"}),"السابق"]}),l<k.length-1?e.jsxs("button",{onClick:()=>s(l+1),className:"btn-primary flex-1",children:["التالي",e.jsx(xe,{className:"w-5 h-5"})]}):e.jsx("button",{onClick:H,disabled:c,className:"btn-primary flex-1",children:c?e.jsx(De,{size:20}):e.jsxs(e.Fragment,{children:[e.jsx(bt,{className:"w-5 h-5"}),"حفظ وبدء العمل"]})})]})]})})},Q=[{id:"config",title:"بيانات Firebase",subtitle:"إدخال معلومات المشروع",icon:e.jsx(at,{className:"w-5 h-5"})},{id:"rules",title:"Security Rules",subtitle:"قواعد الأمان",icon:e.jsx(be,{className:"w-5 h-5"})},{id:"indexes",title:"Indexes",subtitle:"الفهارس المركبة",icon:e.jsx(st,{className:"w-5 h-5"})},{id:"auth",title:"Authentication",subtitle:"تفعيل المصادقة",icon:e.jsx(ve,{className:"w-5 h-5"})},{id:"verify",title:"التحقق النهائي",subtitle:"اختبار الاتصال",icon:e.jsx(rt,{className:"w-5 h-5"})}],Ye=`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // ============================================
    // 🔐 Adora Hotel Management System Rules
    // ============================================
    
    // 🏢 Tenant data - accessible by authenticated users
    match /tenants/{tenantId}/{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // 🔑 Global codes - readable by all (for PIN login), writable by authenticated
    match /globalCodes/{codeId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // 👤 Users collection
    // ✅ V5 FIX: Allow owner/admin to manage all users
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;  // Allows owner to delete/modify managers
    }
    
    // 📋 Requests collection - accessible by authenticated users
    match /requests/{requestId} {
      allow read, write: if request.auth != null;
    }
    
    // 🏥 Health check collection - for connection testing
    match /health_check/{docId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // ⚙️ System settings - read by all, write by authenticated
    match /system/{settingId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // ⚙️ System settings (alternate path)
    match /systemSettings/{docId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // ⚙️ System configs
    match /system_configs/{configId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // 👔 Managers collection (Owner's view)
    match /managers/{managerId} {
      allow read, write: if request.auth != null;
    }
    
    // 🗑️ Deleted managers archive
    match /deleted_managers/{managerId} {
      allow read, write: if request.auth != null;
    }
    
    // 🔗 User bindings (role mapping)
    match /userBindings/{uid} {
      allow read, write: if request.auth != null;
    }
    
    // 📜 Audit logs - append only (immutable)
    match /audit_logs/{logId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if false;
    }
    
    // 📜 Audit logs (alternate path)
    match /auditLogs/{logId} {
      allow read: if request.auth != null;
      allow create: if true;
      allow update, delete: if false;
    }
    
    // 🧾 Receipts & Invoices
    match /receiptVouchers/{id} {
      allow read, write: if request.auth != null;
    }
    
    match /invoices/{id} {
      allow read, write: if request.auth != null;
    }
    
    // 📊 Global logs
    match /logs/{logId} {
      allow read, write: if request.auth != null;
    }
    
    // 🔐 Secure access tokens
    match /secureAccessTokens/{tokenId} {
      allow read, write: if request.auth != null;
    }
    
    // ⚙️ Global settings
    match /settings/{settingId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // 📜 License notifications
    match /licenseNotifications/{notificationId} {
      allow read, write: if request.auth != null;
    }
    
    // 💾 Global backups
    match /backups/{backupId} {
      allow read, write: if request.auth != null;
    }
    
    // ⛔ DEFAULT DENY - Anything not explicitly allowed is DENIED!
  }
}`,We=`{
  "indexes": [
    {
      "collectionGroup": "requests",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tenantId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "requests",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tenantId", "order": "ASCENDING" },
        { "fieldPath": "department", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "roomCards",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tenantId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "checkInDate", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "users",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tenantId", "order": "ASCENDING" },
        { "fieldPath": "role", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "managers",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}`,wa=()=>{const t=_e(),[l,s]=d.useState("config"),[c,i]=d.useState(!1),[u,x]=d.useState(!1),[I,j]=d.useState(null);d.useEffect(()=>{ye()&&t("/login",{replace:!0})},[t]);const[_,B]=d.useState({config:!1,rules:!1,indexes:!1,auth:!1,verify:!1}),[p,a]=d.useState(null),[g,T]=d.useState(null),b=(r,P,R)=>{T({show:!0,type:r,title:P,message:R}),setTimeout(()=>T(null),4e3)},[o,n]=d.useState(()=>{const r=localStorage.getItem("adora_client_config");if(r)try{return JSON.parse(r)}catch{return{apiKey:"",authDomain:"",projectId:"",storageBucket:"",messagingSenderId:"",appId:""}}return{apiKey:"",authDomain:"",projectId:"",storageBucket:"",messagingSenderId:"",appId:""}}),[w,k]=d.useState(()=>ha()||"");d.useEffect(()=>{const r=localStorage.getItem("adora_client_config");if(r)try{const P=JSON.parse(r);P.apiKey&&P.projectId&&B(R=>({...R,config:!0}))}catch{}if(ye()){const P=localStorage.getItem("adora_client_config");if(P){const R=JSON.parse(P);n(R),B(Z=>({...Z,config:!0}))}}},[]),d.useEffect(()=>{o.projectId&&n(r=>({...r,authDomain:r.authDomain||`${o.projectId}.firebaseapp.com`,storageBucket:r.storageBucket||`${o.projectId}.appspot.com`}))},[o.projectId]);const G=Q.findIndex(r=>r.id===l),S=r=>{s(r),a(null)},F=()=>{const r=G+1;r<Q.length&&(s(Q[r].id),a(null))},A=()=>{const r=G-1;r>=0&&(s(Q[r].id),a(null))},H=async(r,P)=>{await navigator.clipboard.writeText(r),j(P),setTimeout(()=>j(null),2e3)},q=async()=>{i(!0),a(null);try{const r=await ze(o);a(r),r.success&&B(P=>({...P,config:!0}))}catch{a({success:!1,message:"❌ حدث خطأ غير متوقع أثناء الاختبار"})}finally{i(!1)}},m=async()=>{i(!0);try{xa(o),B(r=>({...r,config:!0})),a({success:!0,message:"✅ تم حفظ الإعدادات بنجاح!"}),setTimeout(()=>F(),500)}catch{a({success:!1,message:"❌ حدث خطأ أثناء الحفظ"})}finally{i(!1)}},v=r=>{B(P=>({...P,[r]:!0})),F()},C=async()=>{i(!0),a(null);try{const r=await ze(o);if(!r.success){a(r);return}const{checkAnonymousAuthEnabled:P}=await N(async()=>{const{checkAnonymousAuthEnabled:Z}=await import("./services-KJmycXHR.js").then(ae=>ae.fI);return{checkAnonymousAuthEnabled:Z}},__vite__mapDeps([0,1,2,3,4,5,6])),R=await P();if(!R.enabled){a({success:!1,message:R.error||`❌ Anonymous Authentication غير مفعل!

📍 الحل:
Firebase Console → Authentication → Sign-in method → Anonymous → Enable ✅`});return}a({success:!0,message:`✅ تم التحقق بنجاح!

• اتصال Firebase: ✓
• Anonymous Auth: ✓

🎉 النظام جاهز للاستخدام!`}),B(Z=>({...Z,verify:!0}))}catch{a({success:!1,message:"❌ فشل التحقق من الاتصال"})}finally{i(!1)}},L=()=>{t("/login")},W=o.apiKey&&o.projectId&&o.authDomain,J=()=>`https://console.firebase.google.com/project/${o.projectId}/firestore/rules`,re=()=>`https://console.firebase.google.com/project/${o.projectId}/firestore/indexes`,y=()=>`https://console.firebase.google.com/project/${o.projectId}/authentication/providers`,O=()=>e.jsxs("div",{className:"space-y-6",children:[e.jsx("div",{className:"p-4 rounded-xl bg-blue-500/10 border border-blue-500/20",children:e.jsxs("div",{className:"flex items-start gap-3",children:[e.jsx(ge,{className:"w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0"}),e.jsxs("div",{className:"flex-1",children:[e.jsx("h3",{className:"font-semibold text-blue-400 mb-2",children:"كيفية الحصول على البيانات:"}),e.jsxs("ol",{className:"text-sm text-white/70 space-y-1 list-decimal list-inside",children:[e.jsxs("li",{children:["افتح ",e.jsxs("a",{href:"https://console.firebase.google.com",target:"_blank",rel:"noopener noreferrer",className:"text-blue-400 hover:underline",children:["Firebase Console ",e.jsx(oe,{className:"w-3 h-3 inline"})]})]}),e.jsx("li",{children:"أنشئ مشروع جديد أو اختر مشروع موجود"}),e.jsx("li",{children:"اذهب إلى Project Settings (⚙️) → General"}),e.jsx("li",{children:"أنشئ Web App وانسخ القيم من firebaseConfig"})]})]})]})}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{children:[e.jsxs("label",{className:"block text-sm text-white/70 mb-1.5",children:[e.jsx("span",{className:"text-red-400",children:"*"})," API Key"]}),e.jsxs("div",{className:"relative",children:[e.jsx("input",{type:u?"text":"password",value:o.apiKey,onChange:r=>n({...o,apiKey:r.target.value.trim()}),placeholder:"AIzaSy...",className:"w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-teal-500 transition-colors font-mono text-sm",dir:"ltr"}),e.jsx("button",{type:"button",onClick:()=>x(!u),className:"absolute left-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60",children:u?e.jsx(et,{className:"w-4 h-4"}):e.jsx(tt,{className:"w-4 h-4"})})]})]}),e.jsxs("div",{children:[e.jsxs("label",{className:"block text-sm text-white/70 mb-1.5",children:[e.jsx("span",{className:"text-red-400",children:"*"})," Project ID"]}),e.jsx("input",{type:"text",value:o.projectId,onChange:r=>n({...o,projectId:r.target.value.trim()}),placeholder:"my-hotel-project",className:"w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-teal-500 transition-colors font-mono text-sm",dir:"ltr"})]}),e.jsxs("div",{children:[e.jsxs("label",{className:"block text-sm text-white/70 mb-1.5",children:[e.jsx("span",{className:"text-red-400",children:"*"})," Auth Domain"]}),e.jsx("input",{type:"text",value:o.authDomain,onChange:r=>n({...o,authDomain:r.target.value.trim()}),placeholder:"my-hotel-project.firebaseapp.com",className:"w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-teal-500 transition-colors font-mono text-sm",dir:"ltr"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"block text-sm text-white/70 mb-1.5",children:"Storage Bucket (اختياري)"}),e.jsx("input",{type:"text",value:o.storageBucket,onChange:r=>n({...o,storageBucket:r.target.value.trim()}),placeholder:"my-hotel-project.appspot.com",className:"w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-teal-500 transition-colors font-mono text-sm",dir:"ltr"})]}),e.jsxs("details",{className:"group",children:[e.jsxs("summary",{className:"text-sm text-white/50 cursor-pointer hover:text-white/70 transition-colors flex items-center gap-1",children:[e.jsx(pe,{className:"w-4 h-4 group-open:hidden"}),e.jsx(jt,{className:"w-4 h-4 hidden group-open:block"}),"إعدادات متقدمة (اختياري)"]}),e.jsxs("div",{className:"mt-4 space-y-4 pl-4 border-l border-slate-700",children:[e.jsxs("div",{children:[e.jsx("label",{className:"block text-sm text-white/70 mb-1.5",children:"Messaging Sender ID"}),e.jsx("input",{type:"text",value:o.messagingSenderId||"",onChange:r=>n({...o,messagingSenderId:r.target.value.trim()}),placeholder:"123456789",className:"w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-teal-500 transition-colors font-mono text-sm",dir:"ltr"})]}),e.jsxs("div",{children:[e.jsx("label",{className:"block text-sm text-white/70 mb-1.5",children:"App ID"}),e.jsx("input",{type:"text",value:o.appId||"",onChange:r=>n({...o,appId:r.target.value.trim()}),placeholder:"1:123456789:web:abc123...",className:"w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-teal-500 transition-colors font-mono text-sm",dir:"ltr"})]})]})]})]}),e.jsxs("div",{className:"flex gap-3",children:[e.jsx("button",{onClick:q,disabled:!W||c,className:"flex-1 px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2",children:c?e.jsxs(e.Fragment,{children:[e.jsx(De,{size:16}),"جاري الاختبار..."]}):e.jsxs(e.Fragment,{children:[e.jsx(wt,{className:"w-4 h-4"}),"اختبار الاتصال"]})}),e.jsxs("button",{onClick:m,disabled:!W,className:"flex-1 px-6 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2",children:["حفظ والتالي",e.jsx(xe,{className:"w-4 h-4"})]})]})]}),V=()=>e.jsxs("div",{className:"space-y-6",children:[e.jsxs("div",{className:"p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20",children:[e.jsxs("h3",{className:"font-bold text-amber-400 mb-3 flex items-center gap-2",children:[e.jsx(be,{className:"w-5 h-5"}),"📍 الاستخدام السريع:"]}),e.jsx("div",{className:"text-sm text-white/80 space-y-2",children:e.jsx("p",{className:"font-mono bg-slate-800/50 px-3 py-2 rounded-lg text-amber-300",children:"Firebase Console → Firestore → تبويب Rules → امسح الكود → الصق → Publish"})})]}),e.jsxs("details",{className:"group",children:[e.jsxs("summary",{className:"cursor-pointer text-sm text-white/60 hover:text-white/80 transition-colors flex items-center gap-2 p-3 rounded-xl bg-slate-800/30 border border-slate-700/50",children:[e.jsx(pe,{className:"w-4 h-4 group-open:rotate-180 transition-transform"}),e.jsx("span",{children:"📖 لو أول مرة أو نسيت الخطوات (اضغط هنا)"})]}),e.jsxs("div",{className:"mt-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700 space-y-4",children:[e.jsxs("div",{className:"border-r-2 border-amber-500 pr-4",children:[e.jsx("h4",{className:"font-semibold text-white mb-2",children:"1️⃣ إنشاء Database (لو مش موجود)"}),e.jsxs("ul",{className:"text-sm text-white/70 space-y-1",children:[e.jsxs("li",{children:["• اضغط ",e.jsx("span",{className:"text-amber-400",children:"Create Database"})," (الزر الأصفر)"]}),e.jsxs("li",{children:["• اختر ",e.jsx("span",{className:"text-green-400",children:"Standard edition"})," ✅"]}),e.jsxs("li",{children:["• اختر السيرفر: ",e.jsx("span",{className:"text-cyan-400",children:"us-central1"})," (أسرع وأرخص)"]}),e.jsxs("li",{children:["• اختر ",e.jsx("span",{className:"text-green-400",children:"Production mode"})," ✅"]})]})]}),e.jsxs("div",{className:"border-r-2 border-amber-500 pr-4",children:[e.jsx("h4",{className:"font-semibold text-white mb-2",children:"2️⃣ تطبيق Rules"}),e.jsxs("ul",{className:"text-sm text-white/70 space-y-1",children:[e.jsxs("li",{children:["• اضغط تبويب ",e.jsx("span",{className:"text-amber-400",children:"Rules"})," من فوق"]}),e.jsx("li",{children:"• امسح كل الكود الموجود"}),e.jsx("li",{children:"• الصق كود أدورا (من تحت)"}),e.jsxs("li",{children:["• اضغط ",e.jsx("span",{className:"text-blue-400",children:"Publish"})," (الزر الأزرق)"]})]})]}),e.jsx("div",{className:"p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20",children:e.jsxs("p",{className:"text-xs text-cyan-300",children:["💡 ",e.jsx("strong",{children:"ليه us-central1؟"})," ده السيرفر الرئيسي لجوجل - أسرع تحديثات، أقل تكلفة، ومشمول في Free Tier"]})})]})]}),e.jsxs("div",{className:"relative",children:[e.jsxs("div",{className:"absolute top-3 left-3 flex gap-2 z-10",children:[e.jsxs("button",{onClick:()=>H(Ye,"rules"),className:`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${I==="rules"?"bg-green-500/20 text-green-400":"bg-slate-700 text-white hover:bg-slate-600"}`,children:[I==="rules"?e.jsx(le,{className:"w-3 h-3"}):e.jsx(Fe,{className:"w-3 h-3"}),I==="rules"?"تم النسخ!":"نسخ"]}),e.jsxs("a",{href:J(),target:"_blank",rel:"noopener noreferrer",className:"px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors flex items-center gap-1",children:[e.jsx(oe,{className:"w-3 h-3"}),"فتح Firebase"]})]}),e.jsx("pre",{className:"bg-slate-900 border border-slate-700 rounded-xl p-4 pt-14 text-xs text-white/80 font-mono overflow-x-auto max-h-64 overflow-y-auto",children:Ye})]}),e.jsx("div",{className:"p-4 rounded-xl bg-slate-800/50 border border-slate-700",children:e.jsxs("label",{className:"flex items-center gap-3 cursor-pointer",children:[e.jsx("input",{type:"checkbox",checked:_.rules,onChange:r=>B(P=>({...P,rules:r.target.checked})),className:"w-5 h-5 rounded border-slate-600 text-teal-500 focus:ring-teal-500"}),e.jsx("span",{className:"text-white/70",children:"تم نسخ ولصق Security Rules في Firebase Console"})]})}),e.jsxs("div",{className:"flex gap-3",children:[e.jsxs("button",{onClick:A,className:"px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors flex items-center gap-2",children:[e.jsx(ue,{className:"w-4 h-4"}),"السابق"]}),e.jsxs("button",{onClick:F,disabled:!_.rules,className:"flex-1 px-6 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2",children:["التالي",e.jsx(xe,{className:"w-4 h-4"})]})]})]}),ee=()=>e.jsxs("div",{className:"space-y-6",children:[e.jsxs("div",{className:"p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20",children:[e.jsxs("h3",{className:"font-bold text-purple-400 mb-3 flex items-center gap-2",children:[e.jsx(st,{className:"w-5 h-5"}),"📍 الاستخدام السريع:"]}),e.jsxs("div",{className:"text-sm text-white/80 space-y-2",children:[e.jsx("p",{className:"font-mono bg-slate-800/50 px-3 py-2 rounded-lg text-purple-300",children:"Firebase Console → Firestore → تبويب Indexes → Create Index (أو تخطي)"}),e.jsx("p",{className:"text-xs text-yellow-400",children:"⚡ هذه الخطوة اختيارية - النظام يعمل بدونها، لكنها تسرّع البحث"})]})]}),e.jsxs("details",{className:"group",children:[e.jsxs("summary",{className:"cursor-pointer text-sm text-white/60 hover:text-white/80 transition-colors flex items-center gap-2 p-3 rounded-xl bg-slate-800/30 border border-slate-700/50",children:[e.jsx(pe,{className:"w-4 h-4 group-open:rotate-180 transition-transform"}),e.jsx("span",{children:"📖 متى أحتاج Indexes؟ (اضغط هنا)"})]}),e.jsxs("div",{className:"mt-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700 space-y-3",children:[e.jsxs("div",{className:"text-sm text-white/70",children:[e.jsx("p",{className:"mb-2",children:"الـ Indexes تحتاجها لما:"}),e.jsxs("ul",{className:"space-y-1",children:[e.jsxs("li",{children:["• عندك ",e.jsx("span",{className:"text-purple-400",children:"بيانات كتير"})," (آلاف الطلبات)"]}),e.jsxs("li",{children:["• بتعمل ",e.jsx("span",{className:"text-purple-400",children:"بحث معقد"})," (فلترة + ترتيب)"]}),e.jsxs("li",{children:["• ظهرت رسالة ",e.jsx("span",{className:"text-red-400",children:'"requires an index"'})]})]})]}),e.jsx("div",{className:"p-3 rounded-lg bg-green-500/10 border border-green-500/20",children:e.jsxs("p",{className:"text-xs text-green-300",children:["✅ ",e.jsx("strong",{children:"نصيحة:"})," ابدأ بدون Indexes، ولما يطلبها Firebase هيديك رابط مباشر لإنشائها"]})})]})]}),e.jsxs("div",{className:"relative",children:[e.jsxs("div",{className:"absolute top-3 left-3 flex gap-2 z-10",children:[e.jsxs("button",{onClick:()=>H(We,"indexes"),className:`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${I==="indexes"?"bg-green-500/20 text-green-400":"bg-slate-700 text-white hover:bg-slate-600"}`,children:[I==="indexes"?e.jsx(le,{className:"w-3 h-3"}):e.jsx(Fe,{className:"w-3 h-3"}),I==="indexes"?"تم النسخ!":"نسخ"]}),e.jsxs("a",{href:re(),target:"_blank",rel:"noopener noreferrer",className:"px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors flex items-center gap-1",children:[e.jsx(oe,{className:"w-3 h-3"}),"فتح Firebase"]})]}),e.jsx("pre",{className:"bg-slate-900 border border-slate-700 rounded-xl p-4 pt-14 text-xs text-white/80 font-mono overflow-x-auto max-h-48 overflow-y-auto",children:We})]}),e.jsxs("div",{className:"flex gap-3",children:[e.jsxs("button",{onClick:A,className:"px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors flex items-center gap-2",children:[e.jsx(ue,{className:"w-4 h-4"}),"السابق"]}),e.jsx("button",{onClick:()=>{B(r=>({...r,indexes:!0})),F()},className:"flex-1 px-6 py-3 rounded-xl bg-slate-600 hover:bg-slate-500 text-white font-medium transition-colors flex items-center justify-center gap-2",children:"تخطي (اختياري)"}),e.jsxs("button",{onClick:()=>v("indexes"),className:"flex-1 px-6 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-medium transition-colors flex items-center justify-center gap-2",children:["تم، التالي",e.jsx(xe,{className:"w-4 h-4"})]})]})]}),Y=()=>e.jsxs("div",{className:"space-y-6",children:[e.jsxs("div",{className:"p-4 rounded-xl bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30",children:[e.jsxs("h3",{className:"font-bold text-red-400 mb-2 flex items-center gap-2",children:[e.jsx(Ae,{className:"w-5 h-5"}),"⚠️ مهم جداً - حماية الميزانية!"]}),e.jsxs("p",{className:"text-sm text-white/80",children:["تفعيل ",e.jsx("span",{className:"text-yellow-400 font-bold",children:"Anonymous Authentication"})," ضروري لحماية ميزانيتك من استنزاف الـ Quota. بدونه، أي شخص يستطيع قراءة البيانات مجاناً وتحميلك فلوس!"]})]}),e.jsxs("div",{className:"p-4 rounded-xl bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/20",children:[e.jsxs("h3",{className:"font-bold text-yellow-400 mb-3 flex items-center gap-2",children:[e.jsx(ve,{className:"w-5 h-5"}),"📍 الخطوة الأولى (إلزامي): Anonymous Auth"]}),e.jsx("div",{className:"text-sm text-white/80 space-y-2",children:e.jsx("p",{className:"font-mono bg-slate-800/50 px-3 py-2 rounded-lg text-yellow-300",children:"Firebase Console → Authentication → Sign-in method → Anonymous → Enable ✅"})})]}),e.jsxs("div",{className:"p-4 rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20",children:[e.jsxs("h3",{className:"font-bold text-cyan-400 mb-3 flex items-center gap-2",children:[e.jsx(je,{className:"w-5 h-5"}),"📍 الخطوة الثانية: Email/Password"]}),e.jsx("div",{className:"text-sm text-white/80 space-y-2",children:e.jsx("p",{className:"font-mono bg-slate-800/50 px-3 py-2 rounded-lg text-cyan-300",children:"Firebase Console → Authentication → Sign-in method → Email/Password → Enable ✅"})})]}),e.jsxs("details",{className:"group",children:[e.jsxs("summary",{className:"cursor-pointer text-sm text-white/60 hover:text-white/80 transition-colors flex items-center gap-2 p-3 rounded-xl bg-slate-800/30 border border-slate-700/50",children:[e.jsx(pe,{className:"w-4 h-4 group-open:rotate-180 transition-transform"}),e.jsx("span",{children:"📖 الخطوات بالتفصيل (اضغط هنا)"})]}),e.jsxs("div",{className:"mt-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700 space-y-3",children:[e.jsxs("div",{className:"border-r-2 border-yellow-500 pr-4 mb-4",children:[e.jsx("h4",{className:"text-yellow-400 font-medium mb-2",children:"🔐 Anonymous Auth (للضيوف عبر QR):"}),e.jsxs("ul",{className:"text-sm text-white/70 space-y-2",children:[e.jsxs("li",{children:["1️⃣ افتح ",e.jsx("span",{className:"text-yellow-400",children:"Authentication"})," من القائمة الجانبية"]}),e.jsxs("li",{children:["2️⃣ اذهب إلى ",e.jsx("span",{className:"text-yellow-400",children:"Sign-in method"})]}),e.jsxs("li",{children:["3️⃣ اختر ",e.jsx("span",{className:"text-yellow-400",children:"Anonymous"})]}),e.jsxs("li",{children:["4️⃣ فعّل ",e.jsx("span",{className:"text-green-400",children:"Enable"})," واضغط ",e.jsx("span",{className:"text-blue-400",children:"Save"})]})]})]}),e.jsxs("div",{className:"border-r-2 border-cyan-500 pr-4",children:[e.jsx("h4",{className:"text-cyan-400 font-medium mb-2",children:"📧 Email/Password (للموظفين):"}),e.jsxs("ul",{className:"text-sm text-white/70 space-y-2",children:[e.jsx("li",{children:"1️⃣ نفس الخطوات أعلاه"}),e.jsxs("li",{children:["2️⃣ اختر ",e.jsx("span",{className:"text-cyan-400",children:"Email/Password"})]}),e.jsxs("li",{children:["3️⃣ فعّل ",e.jsx("span",{className:"text-green-400",children:"Enable"})," واضغط ",e.jsx("span",{className:"text-blue-400",children:"Save"})]})]})]})]})]}),e.jsxs("div",{className:"grid grid-cols-3 gap-3",children:[e.jsxs("div",{className:"p-4 rounded-xl bg-slate-800/50 border border-yellow-500/30",children:[e.jsxs("div",{className:"flex items-center gap-2 mb-2",children:[e.jsx(ve,{className:"w-4 h-4 text-yellow-400"}),e.jsx("span",{className:"text-sm font-medium text-white",children:"Anonymous"})]}),e.jsx("span",{className:"text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded",children:"إلزامي 🔴"}),e.jsx("p",{className:"text-xs text-white/50 mt-2",children:"للضيوف (QR)"})]}),e.jsxs("div",{className:"p-4 rounded-xl bg-slate-800/50 border border-green-500/30",children:[e.jsxs("div",{className:"flex items-center gap-2 mb-2",children:[e.jsx(je,{className:"w-4 h-4 text-green-400"}),e.jsx("span",{className:"text-sm font-medium text-white",children:"Email/Pass"})]}),e.jsx("span",{className:"text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded",children:"مطلوب ✅"}),e.jsx("p",{className:"text-xs text-white/50 mt-2",children:"للموظفين"})]}),e.jsxs("div",{className:"p-4 rounded-xl bg-slate-800/50 border border-slate-700",children:[e.jsxs("div",{className:"flex items-center gap-2 mb-2",children:[e.jsx(je,{className:"w-4 h-4 text-blue-400"}),e.jsx("span",{className:"text-sm font-medium text-white",children:"Phone"})]}),e.jsx("span",{className:"text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded",children:"اختياري"}),e.jsx("p",{className:"text-xs text-white/50 mt-2",children:"OTP"})]})]}),e.jsx("a",{href:y(),target:"_blank",rel:"noopener noreferrer",className:"block w-full p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors text-center",children:e.jsxs("div",{className:"flex items-center justify-center gap-2 text-cyan-400 font-medium",children:[e.jsx(oe,{className:"w-5 h-5"}),"فتح صفحة Authentication في Firebase"]})}),e.jsxs("div",{className:"p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/30",children:[e.jsxs("h3",{className:"font-bold text-emerald-400 mb-3 flex items-center gap-2",children:[e.jsx(be,{className:"w-5 h-5"}),"🛡️ App Check - حماية الميزانية (مُوصى به بشدة!)"]}),e.jsxs("p",{className:"text-sm text-white/70 mb-4",children:["يمنع أي شخص من استخدام الـ API Keys خارج تطبيقك = ",e.jsx("span",{className:"text-green-400 font-bold",children:"حماية الـ $10 ميزانية من الاستنزاف"})]}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{className:"p-3 rounded-lg bg-slate-800/50 border border-slate-700",children:[e.jsx("h4",{className:"text-sm font-bold text-amber-400 mb-2",children:"الخطوة 1: إنشاء مفتاح reCAPTCHA"}),e.jsxs("ol",{className:"text-xs text-white/70 space-y-1 pr-4 list-decimal list-inside",children:[e.jsxs("li",{children:["افتح ",e.jsx("a",{href:"https://www.google.com/recaptcha/admin/create",target:"_blank",rel:"noopener noreferrer",className:"text-cyan-400 underline",children:"Google reCAPTCHA Admin"})]}),e.jsxs("li",{children:["في ",e.jsx("span",{className:"text-yellow-400",children:"Label"}),": اكتب ",e.jsx("span",{className:"text-green-400 font-mono",children:"Adora Hotel"})]}),e.jsxs("li",{children:["في ",e.jsx("span",{className:"text-yellow-400",children:"reCAPTCHA type"}),": اختر ",e.jsx("span",{className:"text-green-400",children:"Score based (v3)"})]}),e.jsxs("li",{children:["في ",e.jsx("span",{className:"text-yellow-400",children:"Domains"}),": أضف ",e.jsx("span",{className:"text-green-400 font-mono",children:"localhost"})," + دومين موقعك"]}),e.jsxs("li",{children:["اضغط ",e.jsx("span",{className:"text-blue-400",children:"Submit"})]}),e.jsxs("li",{children:["📋 ",e.jsx("span",{className:"text-red-400 font-bold",children:"انسخ الـ SECRET KEY"})," (المفتاح السري)"]})]}),e.jsxs("a",{href:"https://www.google.com/recaptcha/admin/create",target:"_blank",rel:"noopener noreferrer",className:"mt-2 inline-flex items-center gap-1 text-xs text-cyan-400 hover:underline",children:[e.jsx(oe,{className:"w-3 h-3"}),"فتح reCAPTCHA Admin"]})]}),e.jsxs("div",{className:"p-3 rounded-lg bg-slate-800/50 border border-slate-700",children:[e.jsx("h4",{className:"text-sm font-bold text-amber-400 mb-2",children:"الخطوة 2: تسجيل في Firebase App Check"}),e.jsxs("ol",{className:"text-xs text-white/70 space-y-1 pr-4 list-decimal list-inside",children:[e.jsxs("li",{children:["افتح ",e.jsx("span",{className:"text-emerald-400",children:"App Check"})," من القائمة الجانبية في Firebase"]}),e.jsxs("li",{children:["اضغط على تطبيقك ",e.jsx("span",{className:"text-green-400",children:"Adora-platform"})]}),e.jsxs("li",{children:["اختر ",e.jsx("span",{className:"text-green-400",children:"reCAPTCHA"})," (⚠️ ليس Enterprise!)"]}),e.jsxs("li",{children:["الصق الـ ",e.jsx("span",{className:"text-red-400 font-bold",children:"SECRET KEY"})," في الخانة"]}),e.jsxs("li",{children:["اترك ",e.jsx("span",{className:"text-yellow-400",children:"Token time to live"})," = ",e.jsx("span",{className:"text-green-400",children:"1 day"})]}),e.jsxs("li",{children:["اضغط ",e.jsx("span",{className:"text-blue-400",children:"Save"})]})]})]}),e.jsxs("div",{className:"p-3 rounded-lg bg-slate-800/50 border border-slate-700",children:[e.jsx("h4",{className:"text-sm font-bold text-amber-400 mb-2",children:"الخطوة 3: تفعيل الحماية على APIs"}),e.jsxs("ol",{className:"text-xs text-white/70 space-y-1 pr-4 list-decimal list-inside",children:[e.jsxs("li",{children:["بعد التسجيل، اذهب لتبويب ",e.jsx("span",{className:"text-emerald-400",children:"APIs"})]}),e.jsxs("li",{children:["فعّل ",e.jsx("span",{className:"text-green-400",children:"Firestore"})," → Enforce"]}),e.jsxs("li",{children:["فعّل ",e.jsx("span",{className:"text-green-400",children:"Storage"})," → Enforce"]}),e.jsxs("li",{children:["فعّل ",e.jsx("span",{className:"text-green-400",children:"Authentication"})," → Enforce"]})]}),e.jsx("p",{className:"mt-2 text-xs text-yellow-400",children:"⚠️ بعد الـ Enforce، أي طلب من خارج التطبيق سيُرفض تلقائياً!"})]})]}),e.jsxs("div",{className:"mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20",children:[e.jsx("h4",{className:"text-sm font-bold text-blue-400 mb-2",children:"📋 فهم المفتاحين من Google reCAPTCHA:"}),e.jsxs("div",{className:"space-y-3 text-xs",children:[e.jsxs("div",{className:"p-3 rounded bg-slate-800/50 border border-amber-500/30",children:[e.jsx("p",{className:"text-amber-400 font-bold mb-2",children:"🔐 المفتاح السري (Secret Key):"}),e.jsx("p",{className:"text-white/70 italic border-r-2 border-amber-500 pr-2",children:'"استخدِم هذا المفتاح السري لإجراء الاتصال بين موقعك الإلكتروني وخدمة reCAPTCHA."'}),e.jsx("p",{className:"text-green-400 mt-2 font-bold",children:"✅ هذا حطيته في Firebase App Check (خلاص تم!)"})]}),e.jsxs("div",{className:"p-3 rounded bg-slate-800/50 border border-emerald-500/30",children:[e.jsx("p",{className:"text-emerald-400 font-bold mb-2",children:"🌐 مفتاح الموقع الإلكتروني (Site Key):"}),e.jsx("p",{className:"text-white/70 italic border-r-2 border-emerald-500 pr-2",children:'"استخدِم مفتاح الموقع الإلكتروني هذا في رمز HTML الذي يعرضه موقعك الإلكتروني للمستخدمين."'}),e.jsx("p",{className:"text-yellow-400 mt-2 font-bold",children:"⬇️ هذا حطه هنا تحت في الخانة!"})]})]})]}),e.jsxs("div",{className:"mt-3 p-3 rounded-lg bg-slate-800/80 border border-emerald-500/30",children:[e.jsx("label",{className:"block text-sm font-medium text-emerald-400 mb-2",children:"🔑 reCAPTCHA Site Key (للتفعيل في التطبيق)"}),e.jsxs("p",{className:"text-xs text-white/50 mb-2",children:["الصق ",e.jsx("span",{className:"text-emerald-400 font-bold",children:"مفتاح الموقع الإلكتروني"})," هنا (الأول، ليس السري!)"]}),e.jsxs("div",{className:"flex gap-2",children:[e.jsx("input",{type:"text",value:w,onChange:r=>k(r.target.value),placeholder:"6Lc...ABC (Site Key من Google reCAPTCHA)",className:"flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder-white/30 focus:border-emerald-500 focus:outline-none"}),e.jsx("button",{onClick:()=>{w.trim()&&(ua(w.trim()),b("success","✅ تم حفظ Site Key!","أعد تحميل الصفحة لتفعيل App Check."))},disabled:!w.trim(),className:"px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",children:"حفظ"})]}),w&&e.jsx("p",{className:"mt-2 text-xs text-green-400",children:"✅ Site Key محفوظ - أعد تحميل الصفحة ثم يمكنك عمل Enforce"})]}),e.jsxs("div",{className:"flex gap-2 mt-4",children:[e.jsxs("a",{href:o.projectId?`https://console.firebase.google.com/project/${o.projectId}/appcheck`:"https://console.firebase.google.com/",target:"_blank",rel:"noopener noreferrer",className:"inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors text-sm",children:[e.jsx(oe,{className:"w-4 h-4"}),"فتح App Check"]}),e.jsxs("a",{href:"https://www.google.com/recaptcha/admin/create",target:"_blank",rel:"noopener noreferrer",className:"inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors text-sm",children:[e.jsx(je,{className:"w-4 h-4"}),"إنشاء مفتاح reCAPTCHA"]})]})]}),e.jsxs("div",{className:"p-4 rounded-xl bg-slate-800/50 border border-slate-700 space-y-3",children:[e.jsxs("label",{className:"flex items-center gap-3 cursor-pointer",children:[e.jsx("input",{type:"checkbox",checked:_.auth,onChange:r=>B(P=>({...P,auth:r.target.checked})),className:"w-5 h-5 rounded border-slate-600 text-teal-500 focus:ring-teal-500"}),e.jsx("span",{className:"text-white/70",children:"تم تفعيل Anonymous + Email/Password"})]}),e.jsx("p",{className:"text-xs text-white/40 pr-8",children:"💡 App Check اختياري الآن، لكن يُنصح بتفعيله لاحقاً لحماية ميزانيتك"})]}),e.jsxs("div",{className:"flex gap-3",children:[e.jsxs("button",{onClick:A,className:"px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors flex items-center gap-2",children:[e.jsx(ue,{className:"w-4 h-4"}),"السابق"]}),e.jsxs("button",{onClick:F,disabled:!_.auth,className:"flex-1 px-6 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2",children:["التالي",e.jsx(xe,{className:"w-4 h-4"})]})]})]}),te=()=>e.jsxs("div",{className:"space-y-6",children:[e.jsx("div",{className:"space-y-3",children:Q.slice(0,-1).map(r=>e.jsxs("div",{className:`p-4 rounded-xl border flex items-center gap-3 ${_[r.id]?"bg-green-500/10 border-green-500/20":"bg-slate-800/50 border-slate-700"}`,children:[e.jsx("div",{className:`w-8 h-8 rounded-lg flex items-center justify-center ${_[r.id]?"bg-green-500/20":"bg-slate-700"}`,children:_[r.id]?e.jsx(le,{className:"w-4 h-4 text-green-400"}):e.jsx("span",{className:"text-white/40",children:r.icon})}),e.jsxs("div",{className:"flex-1",children:[e.jsx("p",{className:`font-medium ${_[r.id]?"text-green-400":"text-white/60"}`,children:r.title}),e.jsx("p",{className:"text-xs text-white/40",children:r.subtitle})]}),_[r.id]&&e.jsx(se,{className:"w-5 h-5 text-green-400"})]},r.id))}),e.jsx("button",{onClick:C,disabled:c,className:"w-full px-6 py-4 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-medium transition-colors flex items-center justify-center gap-2",children:c?e.jsxs(e.Fragment,{children:[e.jsx(De,{size:20}),"جاري التحقق..."]}):e.jsxs(e.Fragment,{children:[e.jsx(rt,{className:"w-5 h-5"}),"اختبار الاتصال النهائي"]})}),e.jsxs("div",{className:"flex gap-3",children:[e.jsxs("button",{onClick:A,className:"px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors flex items-center gap-2",children:[e.jsx(ue,{className:"w-4 h-4"}),"السابق"]}),e.jsxs("button",{onClick:L,disabled:!p?.success,className:"flex-1 px-6 py-3 rounded-xl bg-green-500 hover:bg-green-400 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2",children:[e.jsx(le,{className:"w-5 h-5"}),"إنهاء والدخول للنظام 🎉"]})]})]});return e.jsxs("div",{className:"min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4",children:[g&&e.jsx("div",{className:"fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm slide-down",children:e.jsxs("div",{className:`
                        flex flex-col items-center gap-4 px-8 py-6 rounded-3xl shadow-2xl border-2 max-w-md mx-4
                        ${g.type==="success"?"bg-slate-900 border-emerald-500 text-emerald-100":g.type==="error"?"bg-slate-900 border-red-500 text-red-100":"bg-slate-900 border-blue-500 text-blue-100"}
                    `,children:[e.jsxs("div",{className:`
                            w-16 h-16 rounded-2xl flex items-center justify-center
                            ${g.type==="success"?"bg-emerald-500/20":g.type==="error"?"bg-red-500/20":"bg-blue-500/20"}
                        `,children:[g.type==="success"&&e.jsx(se,{className:"w-8 h-8 text-emerald-400"}),g.type==="error"&&e.jsx(Ae,{className:"w-8 h-8 text-red-400"}),g.type==="info"&&e.jsx(ge,{className:"w-8 h-8 text-blue-400"})]}),e.jsxs("div",{className:"text-center",children:[e.jsx("p",{className:"font-bold text-lg mb-1",children:g.title}),e.jsx("p",{className:"text-sm opacity-80",children:g.message})]}),e.jsx("button",{onClick:()=>T(null),className:`
                                w-full py-3 rounded-xl font-medium transition-all
                                ${g.type==="success"?"bg-emerald-500 hover:bg-emerald-400 text-white":g.type==="error"?"bg-red-500 hover:bg-red-400 text-white":"bg-blue-500 hover:bg-blue-400 text-white"}
                            `,children:"حسناً ✓"})]})}),e.jsxs("div",{className:"absolute inset-0 overflow-hidden pointer-events-none",children:[e.jsx("div",{className:"absolute top-0 left-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl"}),e.jsx("div",{className:"absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"})]}),e.jsxs("div",{className:"relative w-full max-w-2xl",children:[e.jsxs("div",{className:"text-center mb-6",children:[e.jsxs("div",{className:"flex items-center justify-center gap-3 mb-4",children:[e.jsx("div",{className:"p-3 rounded-2xl bg-teal-500/20",children:e.jsx(at,{className:"w-8 h-8 text-teal-400"})}),e.jsx("h1",{className:"text-3xl font-bold text-white",children:"معالج إعداد Firebase"})]}),e.jsx("p",{className:"text-white/60",children:"اتبع الخطوات لإعداد قاعدة البيانات بشكل صحيح"})]}),e.jsx("div",{className:"flex items-center justify-center gap-2 mb-6",children:Q.map((r,P)=>e.jsxs(X.Fragment,{children:[e.jsx("button",{onClick:()=>S(r.id),className:`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${l===r.id?"bg-teal-500 text-white":_[r.id]?"bg-green-500/20 text-green-400":"bg-slate-700 text-white/40"}`,title:r.title,children:_[r.id]?e.jsx(le,{className:"w-4 h-4"}):e.jsx("span",{className:"text-sm font-medium",children:P+1})}),P<Q.length-1&&e.jsx("div",{className:`w-8 h-0.5 ${_[r.id]?"bg-green-500":"bg-slate-700"}`})]},r.id))}),e.jsxs("div",{className:"text-center mb-6",children:[e.jsx("h2",{className:"text-xl font-semibold text-white",children:Q[G].title}),e.jsx("p",{className:"text-sm text-white/50",children:Q[G].subtitle})]}),e.jsxs("div",{className:"bg-slate-800/50 border border-slate-700/50 rounded-3xl p-6 sm:p-8 shadow-2xl",children:[p&&e.jsx("div",{className:`mb-6 p-4 rounded-xl ${p.success?"bg-green-500/10 border border-green-500/20":"bg-red-500/10 border border-red-500/20"}`,children:e.jsxs("div",{className:"flex items-start gap-3",children:[p.success?e.jsx(se,{className:"w-5 h-5 text-green-400 mt-0.5 flex-shrink-0"}):e.jsx(Ae,{className:"w-5 h-5 text-red-400 mt-0.5 flex-shrink-0"}),e.jsx("p",{className:`text-sm ${p.success?"text-green-400":"text-red-400"}`,children:p.message})]})}),l==="config"&&O(),l==="rules"&&V(),l==="indexes"&&ee(),l==="auth"&&Y(),l==="verify"&&te()]}),e.jsxs("div",{className:"mt-6 text-center",children:[e.jsx("p",{className:"text-xs text-white/40",children:"🔐 بياناتك مخزنة محلياً فقط ولا يتم إرسالها لأي طرف ثالث"}),e.jsxs("a",{href:"https://firebase.google.com/docs/web/setup",target:"_blank",rel:"noopener noreferrer",className:"mt-2 text-sm text-white/40 hover:text-white/60 transition-colors inline-flex items-center gap-1",children:[e.jsx(ft,{className:"w-3 h-3"}),"مساعدة Firebase الرسمية"]})]})]})]})},va=()=>e.jsx("div",{className:"min-h-[40vh] flex items-center justify-center bg-transparent",children:e.jsxs("div",{className:"flex gap-1.5",children:[e.jsx("div",{className:"w-2 h-2 rounded-full bg-teal-500 animate-bounce",style:{animationDelay:"0ms"}}),e.jsx("div",{className:"w-2 h-2 rounded-full bg-teal-500 animate-bounce",style:{animationDelay:"120ms"}}),e.jsx("div",{className:"w-2 h-2 rounded-full bg-teal-500 animate-bounce",style:{animationDelay:"240ms"}})]})}),ya=$(()=>N(()=>import("./feature-reception-BXRkj1BL.js").then(t=>t.R),__vite__mapDeps([7,3,2,4,0,1,6,5,8]))),Na=$(()=>N(()=>import("./HousekeepingDashboard-BUwLZqgo.js"),__vite__mapDeps([9,3,2,4,0,1,6,5,8,7]))),_a=$(()=>N(()=>import("./BellmanDashboard-fxxvDxEJ.js"),__vite__mapDeps([10,3,2,4,0,1,6,5,8,7]))),Sa=$(()=>N(()=>import("./MaintenanceDashboard-CCl7DP9i.js"),__vite__mapDeps([11,3,2,4,0,1,6,5,8,7]))),Ea=$(()=>N(()=>import("./ProcurementDashboard-BKhTnCWN.js"),__vite__mapDeps([12,3,2,4,0,1,6,5,8,7]))),Aa=$(()=>N(()=>import("./CoffeeShopDashboard--nlob7p8.js"),__vite__mapDeps([13,3,2,4,0,1,6,5,8,7]))),Ia=$(()=>N(()=>import("./feature-admin-BLn9Q6qx.js").then(t=>t.A),__vite__mapDeps([8,2,3,4,0,1,6,5]))),Ca=$(()=>N(()=>import("./feature-admin-BLn9Q6qx.js").then(t=>t.a),__vite__mapDeps([8,2,3,4,0,1,6,5]))),ka=$(()=>N(()=>import("./feature-admin-BLn9Q6qx.js").then(t=>t.O),__vite__mapDeps([8,2,3,4,0,1,6,5]))),Pa=$(()=>N(()=>import("./feature-super-admin-BHRwm58i.js").then(t=>t.S),__vite__mapDeps([14,3,2,4,0,1,6,5,8]))),Je=$(()=>N(()=>import("./feature-super-admin-BHRwm58i.js").then(t=>t.E),__vite__mapDeps([14,3,2,4,0,1,6,5,8]))),Da=$(()=>N(()=>import("./feature-super-admin-BHRwm58i.js").then(t=>t.B),__vite__mapDeps([14,3,2,4,0,1,6,5,8]))),La=$(()=>N(()=>import("./feature-super-admin-BHRwm58i.js").then(t=>t.A),__vite__mapDeps([14,3,2,4,0,1,6,5,8]))),Ta=$(()=>N(()=>import("./feature-super-admin-BHRwm58i.js").then(t=>t.a),__vite__mapDeps([14,3,2,4,0,1,6,5,8]))),Ra=$(()=>N(()=>import("./feature-guest-CcaFVW6e.js"),__vite__mapDeps([15,2,4,0,1,3,6,5]))),Oa=$(()=>N(()=>import("./components-CGOc1594.js").then(t=>t.b0),__vite__mapDeps([4,2,0,1,3,6,5]))),Xe=$(()=>N(()=>import("./DemoEntry-DTm8mX_U.js"),__vite__mapDeps([16,2,3,4,0,1,6,5])).then(t=>({default:t.DemoEntry}))),Fa=$(()=>N(()=>import("./AboutUs-XkVjVFHW.js"),__vite__mapDeps([17,2,3,4,0,1,6,5]))),Ba=$(()=>N(()=>import("./CreateFirstBranch-DibB0DEX.js"),__vite__mapDeps([18,2,3,4,0,1,6,5])).then(t=>({default:t.CreateFirstBranch}))),$a=$(()=>N(()=>import("./ApproveRoomTypes-C2V4sOl5.js"),__vite__mapDeps([19,2,3,4,0,1,6,5])).then(t=>({default:t.ApproveRoomTypes}))),Ga=({children:t})=>ye()?e.jsx(ie,{to:"/login",replace:!0}):e.jsx(e.Fragment,{children:t}),Ne=()=>e.jsxs("div",{className:"min-h-screen w-full flex flex-col items-center justify-center gap-4 bg-slate-900/95 backdrop-blur-xl overflow-x-hidden",style:{background:"linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",overflowY:"auto",overflowX:"hidden"},children:[e.jsxs("div",{className:"flex gap-1.5",children:[e.jsx("div",{className:"w-3 h-3 rounded-full bg-primary-500 animate-bounce",style:{animationDelay:"0ms"}}),e.jsx("div",{className:"w-3 h-3 rounded-full bg-primary-500 animate-bounce",style:{animationDelay:"120ms"}}),e.jsx("div",{className:"w-3 h-3 rounded-full bg-primary-500 animate-bounce",style:{animationDelay:"240ms"}})]}),e.jsx("p",{className:"text-sm text-slate-400 font-medium",children:"جاري التحميل..."})]}),Ma=()=>{const{user:t,isLoading:l,authReady:s}=fe(),c=ce(),i=c.pathname==="/",u=t?.role==="manager",x=i&&u&&s&&!l;if(typeof fetch<"u"){const I=c.pathname,j=i&&u||x?"InitialLoadScreen":"RootRedirect";fetch("http://127.0.0.1:7621/ingest/5c8143c2-2bc0-4f4c-8aac-20487908bb98",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"1e1be3"},body:JSON.stringify({sessionId:"1e1be3",location:"AppRoutes.tsx:RootHandler",message:"render",data:{pathname:I,isManagerOnRoot:x,authReady:s,isLoading:l,role:t?.role,returning:j},hypothesisId:I==="/"?"H1":"H5",timestamp:Date.now()})}).catch(()=>{})}return i&&u&&s&&!l?e.jsx(ie,{to:"/admin",replace:!0}):i&&u?e.jsx(Ne,{}):x?e.jsx(Ne,{}):e.jsx(ot,{})},ot=()=>{const{user:t,isAuthenticated:l,isLoading:s,authReady:c}=fe(),i=ce(),u=X.useRef(!1),x=i?.pathname??"",I=t?Ke(t.department,t.role):"";let j="";if(!c||s?j="InitialLoadScreen":l&&t?j=u.current?"InitialLoadScreen":I:j="/login",typeof fetch<"u"&&fetch("http://127.0.0.1:7621/ingest/5c8143c2-2bc0-4f4c-8aac-20487908bb98",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"1e1be3"},body:JSON.stringify({sessionId:"1e1be3",location:"AppRoutes.tsx:RootRedirect",message:"render",data:{pathname:x,authReady:c,isLoading:s,isAuthenticated:l,role:t?.role,path:I,redirectTo:j},hypothesisId:x!=="/"?"H3":"H1",timestamp:Date.now()})}).catch(()=>{}),!c||s)return u.current=!1,e.jsx(Ne,{});if(l&&t){if(u.current)return e.jsx(Ne,{});u.current=!0;const _=Ke(t.department,t.role);return e.jsx(ie,{to:_,replace:!0})}return u.current=!1,e.jsx(ie,{to:"/login",replace:!0})},Va=()=>{const t=ce();return e.jsx(d.Suspense,{fallback:e.jsx(va,{}),children:e.jsx(Ft,{children:e.jsxs(vt,{location:t,children:[e.jsx(D,{path:"/login",element:e.jsx(nt,{})}),e.jsx(D,{path:"/setup",element:e.jsx(ja,{})}),e.jsx(D,{path:"/firebase-setup",element:e.jsx(Ga,{children:e.jsx(wa,{})})}),e.jsx(D,{path:"/onboarding/create-first-branch",element:e.jsx(U,{children:e.jsx(Ba,{})})}),e.jsx(D,{path:"/onboarding/approve-room-types",element:e.jsx(U,{children:e.jsx($a,{})})}),e.jsx(D,{path:"/super-admin",element:e.jsx(U,{allowedDepartments:["admin"],allowedRoles:["owner"],children:e.jsx(Pa,{})})}),e.jsx(D,{path:"/owner-dashboard",element:e.jsx(U,{allowedDepartments:["admin"],allowedRoles:["owner"],children:e.jsx(Je,{})})}),e.jsx(D,{path:"/owner-dashboard/billing",element:e.jsx(U,{allowedDepartments:["admin"],allowedRoles:["owner"],children:e.jsx(Da,{})})}),e.jsx(D,{path:"/owner-dashboard/analytics",element:e.jsx(U,{allowedDepartments:["admin"],allowedRoles:["owner"],children:e.jsx(La,{})})}),e.jsx(D,{path:"/owner-dashboard/master-access",element:e.jsx(U,{allowedDepartments:["admin"],allowedRoles:["owner","super_admin"],children:e.jsx(Ta,{})})}),e.jsx(D,{path:"/owner-panel",element:e.jsx(U,{allowedDepartments:["admin"],allowedRoles:["owner"],children:e.jsx(ka,{})})}),e.jsx(D,{path:"/owner",element:e.jsx(ie,{to:"/owner-dashboard",replace:!0})}),e.jsx(D,{path:"/owner/*",element:e.jsx(U,{allowedDepartments:["admin"],allowedRoles:["owner"],children:e.jsx(Je,{})})}),e.jsx(D,{path:"/demo",element:e.jsx(Xe,{})}),e.jsx(D,{path:"/demo-access",element:e.jsx(Xe,{})}),e.jsx(D,{path:"/about",element:e.jsx(Fa,{})}),e.jsx(D,{path:"/guest",element:e.jsx(Bt,{children:e.jsx(Oa,{children:e.jsx(Ra,{})})})}),e.jsx(D,{path:"/reception",element:e.jsx(U,{allowedDepartments:["reception","admin"],children:e.jsx(Zt,{children:e.jsx(ya,{})})})}),e.jsx(D,{path:"/housekeeping",element:e.jsx(U,{allowedDepartments:["housekeeping","admin"],children:e.jsx(Na,{})})}),e.jsx(D,{path:"/bellman",element:e.jsx(U,{allowedDepartments:["bellman","admin"],children:e.jsx(_a,{})})}),e.jsx(D,{path:"/maintenance",element:e.jsx(U,{allowedDepartments:["maintenance","admin"],children:e.jsx(Sa,{})})}),e.jsx(D,{path:"/procurement",element:e.jsx(U,{allowedDepartments:["procurement","reception","admin"],children:e.jsx(Ea,{})})}),e.jsx(D,{path:"/coffeeshop",element:e.jsx(U,{allowedDepartments:["coffee_shop","reception","admin"],children:e.jsx(Aa,{})})}),e.jsx(D,{path:"/admin/*",element:e.jsx(U,{allowedDepartments:["admin"],children:e.jsx(Ia,{})})}),e.jsx(D,{path:"/rewards",element:e.jsx(U,{allowedDepartments:["admin"],children:e.jsx(Ca,{})})}),e.jsx(D,{path:"/dashboard",element:e.jsx(ie,{to:"/admin",replace:!0})}),e.jsx(D,{path:"/",element:e.jsx(Ma,{})}),e.jsx(D,{path:"*",element:e.jsx(ot,{})})]})})})};function Ha(){const t=_e();d.useEffect(()=>{const l=s=>{if((s.target instanceof HTMLInputElement||s.target instanceof HTMLTextAreaElement||s.target.isContentEditable)&&s.key!=="Escape")return;const c=s.ctrlKey||s.metaKey,i=s.altKey,u=s.key.toLowerCase();if(c&&u==="k"&&(s.preventDefault(),console.log("🔍 Quick search (Ctrl+K)")),c&&u==="/"&&(s.preventDefault(),za()),i&&!c){const x=parseInt(u);x>=1&&x<=9&&(s.preventDefault(),Ua(x,t))}c&&u==="r"&&console.log("🔄 Refreshing..."),u==="escape"&&document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape"}))};return document.addEventListener("keydown",l),()=>{document.removeEventListener("keydown",l)}},[t])}function Ua(t,l){const c={1:"/reception",2:"/housekeeping",3:"/bellman",4:"/maintenance",5:"/procurement",6:"/coffeeshop",7:"/admin",8:"/owner-dashboard"}[t];c&&(l(c),console.log(`⌨️ Navigated to ${c} (Alt+${t})`))}function za(){const t=`
╔═══════════════════════════════════════════════╗
║        ⌨️  اختصارات لوحة المفاتيح             ║
╠═══════════════════════════════════════════════╣
║                                               ║
║  Alt + 1  →  الاستقبال                       ║
║  Alt + 2  →  الهاوس كيبنج                     ║
║  Alt + 3  →  البيلمان                         ║
║  Alt + 4  →  الصيانة                          ║
║  Alt + 5  →  المشتريات                        ║
║  Alt + 6  →  الكوفي شوب                       ║
║  Alt + 7  →  لوحة الإدارة                     ║
║  Alt + 8  →  لوحة المالك                      ║
║                                               ║
║  Ctrl + /  →  عرض الاختصارات                 ║
║  Ctrl + R  →  تحديث الصفحة                   ║
║  Esc       →  إغلاق                          ║
║                                               ║
╚═══════════════════════════════════════════════╝
    `.trim();console.log(t),typeof window<"u"&&alert(t)}const Ka=()=>{if(typeof window>"u")return;const t=window.location.hostname;["adora-hotels.com","localhost","127.0.0.1"].some(s=>t.includes(s.split(":")[0]))||(console.warn(`
╔══════════════════════════════════════════════════════════════╗
║  🛡️  ADORA SYSTEM - PROTECTED BY SAIP                        ║
║  Registration: 25-12-57961106                                ║
║                                                               ║
║  ⚠️  UNAUTHORIZED USE IS STRICTLY PROHIBITED                  ║
║  Property of Ayman Ahmed                                      ║
║  Adora Hotels Management System                                ║
╚══════════════════════════════════════════════════════════════╝
        `),console.error("Unauthorized domain detected:",t))};Ka();const qa=X.memo(({isVoiceEnabled:t,onToggleVoice:l})=>{const s=ce(),{user:c,isAuthenticated:i,logout:u,branchId:x,setBranch:I}=fe(),{t:j}=Se(),{getPreloadProps:_}=Qt(),{tenantId:B}=ea(),[p,a]=X.useState(""),[g,T]=X.useState([]),[b,o]=X.useState(!1),[n,w]=X.useState(!1),[k,G]=yt(),S=k.get("tab")||"overview",F=/^[a-zA-Z0-9_-]{0,50}$/.test(S)?S:"overview";X.useEffect(()=>{(async()=>{if(!(!x||!c))try{if(c.tenantId){const{doc:O,getDoc:V}=await N(async()=>{const{doc:P,getDoc:R}=await import("./vendor-firebase-CWdI6yjY.js").then(Z=>Z.O);return{doc:P,getDoc:R}},__vite__mapDeps([1,2])),{getSafeFirestore:ee}=await N(async()=>{const{getSafeFirestore:P}=await import("./services-KJmycXHR.js").then(R=>R.fI);return{getSafeFirestore:P}},__vite__mapDeps([0,1,2,3,4,5,6])),Y=await ee();if(!Y){a(x);return}const te=O(Y,"tenants",c.tenantId,"branches",x),r=await V(te);r.exists()?a(r.data().name||x):a(x)}else a(x)}catch(O){if(O?.code==="permission-denied"||O?.message?.includes("Missing or insufficient")){a(x||"");return}console.error("Error loading branch name:",O),a(x||"")}})()},[x,c]),X.useEffect(()=>{const y=async()=>{if(c)try{const{loadAvailableBranches:O}=await N(async()=>{const{loadAvailableBranches:ee}=await import("./services-KJmycXHR.js").then(Y=>Y.fK);return{loadAvailableBranches:ee}},__vite__mapDeps([0,1,2,3,4,5,6])),V=await O(c);T(V),o(V.length>1)}catch(O){if(O?.code==="permission-denied"||O?.message?.includes("Missing or insufficient")){T(c.branches||[]),o((c.branches?.length||0)>1);return}console.error("Error loading available branches:",O)}};c&&(c.role==="manager"||c.role==="owner"||c.branches&&c.branches.length>1)&&y()},[c]);const{isEnabled:A}=Ue("procurementSystem"),{isEnabled:H}=Ue("aiAssistant");if(["/login","/guest","/admin"].some(y=>s.pathname.startsWith(y))||!i)return null;const m=c?.role==="owner",v=c?.role==="manager",C=s.pathname==="/owner-dashboard",L=[{id:"overview",label:j("admin.overview")||"Overview",icon:e.jsx(Nt,{className:"w-4 h-4"}),shortLabel:j("admin.overview")||"Overview"},{id:"tenants",label:j("admin.tenantList")||"Tenants",icon:e.jsx(he,{className:"w-4 h-4"}),shortLabel:j("admin.tenantList")||"Tenants"},{id:"settings",label:j("admin.systemSettings")||"Settings",icon:e.jsx(_t,{className:"w-4 h-4"}),shortLabel:j("admin.systemSettings")||"Settings"},{id:"updates",label:j("admin.updates")||"Updates",icon:e.jsx(St,{className:"w-4 h-4"}),shortLabel:j("admin.updates")||"Updates"},{id:"broadcasts",label:j("admin.communicationsAndAnnouncements")||"Messages",icon:e.jsx(Et,{className:"w-4 h-4"}),shortLabel:j("admin.communicationsAndAnnouncements")||"Messages"},{id:"billing",label:j("admin.billing")||"Billing",icon:e.jsx(At,{className:"w-4 h-4"}),shortLabel:j("admin.billing")||"Billing",special:!0}],W=y=>{G({tab:y})},J=[];m&&!C?J.push({to:"/owner-dashboard",icon:e.jsx(he,{className:"w-5 h-5"}),label:j("admin.ownerDashboard")||"Owner Dashboard"}):v?(J.push({to:"/admin",icon:e.jsx(he,{className:"w-5 h-5"}),label:j("sidebar.dashboard")||"Dashboard"}),J.push({to:"/reception",icon:e.jsx(Be,{className:"w-5 h-5"}),label:"الاستقبال"},{to:"/bellman",icon:e.jsx($e,{className:"w-5 h-5"}),label:"البيلمان"},{to:"/coffeeshop",icon:e.jsx(Ge,{className:"w-5 h-5"}),label:"الكافي شوب"},{to:"/housekeeping",icon:e.jsx(ge,{className:"w-5 h-5"}),label:"الهاوس كيبنج"},{to:"/maintenance",icon:e.jsx(Me,{className:"w-5 h-5"}),label:"الصيانة"},...A?[{to:"/procurement",icon:e.jsx(Ve,{className:"w-5 h-5"}),label:"المشتريات"}]:[])):J.push({to:"/reception",icon:e.jsx(Be,{className:"w-5 h-5"}),label:"الاستقبال"},{to:"/bellman",icon:e.jsx($e,{className:"w-5 h-5"}),label:"البيلمان"},{to:"/coffeeshop",icon:e.jsx(Ge,{className:"w-5 h-5"}),label:"الكافي شوب"},{to:"/housekeeping",icon:e.jsx(ge,{className:"w-5 h-5"}),label:"الهاوس كيبنج"},{to:"/maintenance",icon:e.jsx(Me,{className:"w-5 h-5"}),label:"الصيانة"},...A?[{to:"/procurement",icon:e.jsx(Ve,{className:"w-5 h-5"}),label:"المشتريات"}]:[]);const re=y=>{I(y),w(!1),window.location.reload()};return e.jsxs("nav",{className:"fixed top-0 left-0 right-0 z-50 px-3 sm:px-4 py-2 flex items-center justify-between gap-3 transition-colors duration-300",style:{background:"var(--theme-nav-bg)",borderBottom:"1px solid var(--theme-border-primary)",boxShadow:"var(--theme-shadow-md)"},children:[e.jsxs("div",{className:"flex items-center gap-3 shrink-0",children:[e.jsx(Pe,{to:m?"/owner-dashboard":v?"/admin":"/",className:"flex items-center",children:e.jsx("img",{src:"/adora-logo.png",alt:"Adora",className:"h-9 sm:h-10 w-auto object-contain transition-all duration-300",style:{filter:"var(--logo-filter, none)"}})}),c&&e.jsxs("div",{className:"hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl",style:{background:"var(--theme-bg-tertiary)",border:"1px solid var(--theme-border-primary)"},children:[e.jsxs("div",{className:"relative w-7 h-7",children:[m&&e.jsx("div",{className:"absolute inset-0 rounded-full border-2 border-transparent border-t-teal-400 border-r-emerald-400 animate-spin",style:{animationDuration:"3s"}}),e.jsx("div",{className:`w-7 h-7 rounded-full bg-teal-500/20 flex items-center justify-center border ${m?"border-teal-400/50":"border-teal-500/30"}`,children:e.jsx(ke,{className:"w-3.5 h-3.5 text-teal-400"})})]}),e.jsxs("div",{className:"flex flex-col items-start",children:[e.jsxs("div",{className:"flex items-center gap-1.5",children:[e.jsx("span",{className:"text-xs font-medium",style:{color:"var(--theme-text-primary)"},children:m?"ايمن ابو ورده":c.name}),m&&e.jsxs("span",{className:"flex h-1.5 w-1.5",children:[e.jsx("span",{className:"animate-ping absolute inline-flex h-1.5 w-1.5 rounded-full bg-green-400 opacity-75"}),e.jsx("span",{className:"relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"})]})]}),p&&e.jsx("span",{className:"text-[10px]",style:{color:"var(--theme-text-tertiary)"},children:p})]})]})]}),e.jsx("div",{className:"flex-1 min-w-0 mx-1 sm:mx-2",children:e.jsx("div",{className:"flex items-center justify-center gap-0.5 sm:gap-1 rounded-xl sm:rounded-2xl p-0.5 sm:p-1 overflow-x-auto scrollbar-hide max-w-full w-full flex-nowrap whitespace-nowrap",style:{background:"var(--theme-bg-tertiary)",border:"1px solid var(--theme-border-primary)"},children:m&&C?L.map(y=>{const O=F===y.id,V=y.special;return e.jsxs("button",{onClick:()=>W(y.id),title:y.label,className:`
                                        flex items-center gap-1 sm:gap-1.5 md:gap-2 px-1.5 sm:px-2 md:px-3 lg:px-4 py-2 rounded-xl transition-all duration-300 flex-shrink-0 min-w-[40px] sm:min-w-[60px]
                                        ${V?O?"bg-gradient-to-r from-emerald-500 to-teal-500 text-white border border-emerald-400/50 shadow-lg shadow-emerald-500/20":"bg-emerald-50 text-emerald-600 border border-emerald-200 hover:border-emerald-400":O?"bg-teal-500 text-white shadow-lg shadow-teal-500/20":"text-slate-600 hover:text-teal-600 hover:bg-teal-50"}
                                    `,children:[e.jsx("span",{className:"flex-shrink-0",children:y.icon}),e.jsx("span",{className:"hidden sm:inline md:hidden text-[10px] font-medium",children:y.shortLabel}),e.jsx("span",{className:"hidden md:inline text-xs lg:text-sm font-medium",children:y.label}),V&&e.jsx("span",{className:"hidden xl:inline text-[10px] bg-emerald-500/30 px-1.5 py-0.5 rounded-full",children:"جديد"})]},y.id)}):J.map(y=>{const O=s.pathname.startsWith(y.to),V=y.to==="/admin";return e.jsxs(Pe,{to:y.to,title:y.label,..._(y.to),className:`
                                        flex items-center gap-2 px-2 sm:px-3 md:px-4 py-2 rounded-xl transition-all duration-300 flex-shrink-0
                                        ${O?V?"bg-amber-100 text-amber-700 border border-amber-300 shadow-lg shadow-amber-500/10":"bg-teal-500 text-white shadow-lg shadow-teal-500/20":V?"text-amber-600 hover:text-amber-700 hover:bg-amber-50 border border-amber-200":"text-slate-600 hover:text-teal-600 hover:bg-teal-50"}
                                    `,children:[e.jsx("span",{children:y.icon}),e.jsx("span",{className:"hidden lg:inline font-medium",children:y.label})]},y.to)})})}),e.jsxs("div",{className:"flex items-center gap-1.5 sm:gap-2 shrink-0",children:[b&&g.length>1&&e.jsxs("div",{className:"relative",children:[e.jsxs("button",{onClick:()=>w(!n),className:"flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-600 hover:bg-teal-100 hover:text-teal-700 transition-all shadow-sm text-xs sm:text-sm",title:"تغيير الفرع الحالي",children:[e.jsx(he,{className:"w-3.5 h-3.5 sm:w-4 sm:h-4"}),e.jsx("span",{className:"font-bold hidden sm:inline max-w-[100px] truncate",children:g.find(y=>y.id===x)?.name||"الفرع"}),e.jsx(pe,{className:`w-3 h-3 transition-transform duration-300 ${n?"rotate-180":""}`})]}),n&&e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"fixed inset-0 z-40 bg-black/10",onClick:()=>w(!1)}),e.jsx("div",{className:"absolute top-full left-0 mt-2 w-52 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200",style:{background:"var(--theme-bg-secondary)",border:"1px solid var(--theme-border-primary)"},children:e.jsxs("div",{className:"p-2 space-y-1",children:[e.jsx("div",{className:"px-3 py-2 text-xs font-medium uppercase tracking-wider mb-1",style:{color:"var(--theme-text-tertiary)",borderBottom:"1px solid var(--theme-border-secondary)"},children:"فروع المؤسسة"}),g.map(y=>e.jsxs("button",{onClick:()=>re(y.id),className:`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${x===y.id?"bg-teal-500/20 text-teal-600":"hover:bg-slate-100"}`,style:{color:x===y.id?"var(--theme-primary-600)":"var(--theme-text-secondary)"},children:[e.jsx("span",{className:"truncate",children:y.name}),x===y.id&&e.jsx(le,{className:"w-4 h-4"})]},y.id))]})})]})]}),H&&e.jsx("button",{onClick:()=>l(!t),className:`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition-all duration-300 hover:scale-105 ${t?"bg-teal-100 border-teal-300 text-teal-600":"border"}`,style:t?void 0:{background:"var(--theme-bg-tertiary)",borderColor:"var(--theme-border-primary)",color:"var(--theme-text-tertiary)"},title:t?"تعطيل المساعد الصوتي":"تفعيل المساعد الصوتي",children:e.jsx(ge,{className:"w-4 h-4"})}),c&&e.jsx("button",{onClick:u,className:"w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition-all duration-300 hover:scale-105 hover:bg-red-50 hover:text-red-500 hover:border-red-200",style:{background:"var(--theme-bg-tertiary)",border:"1px solid var(--theme-border-primary)",color:"var(--theme-text-secondary)"},title:j("auth.logout")||"Logout",children:e.jsx(It,{className:"w-4 h-4 flip-rtl"})})]})]})}),Ya=()=>{const{t}=Se(),[l,s]=d.useState(document.documentElement.getAttribute("data-theme")==="dark"),c=()=>{try{return{devName:localStorage.getItem("adora_dev_name")??"Ayman Abo Warda",phoneSA:localStorage.getItem("adora_dev_phone_sa")??"966570707121",phoneEG:localStorage.getItem("adora_dev_phone_eg")??"201500000162",email:localStorage.getItem("adora_dev_email")??"77aayy@gmail.com",signature:localStorage.getItem("adora_dev_signature")??"Crafted by Ayman Abo Warda"}}catch{return{devName:"Ayman Abo Warda",phoneSA:"966570707121",phoneEG:"201500000162",email:"77aayy@gmail.com",signature:"Crafted by Ayman Abo Warda"}}},[i,u]=d.useState(c());d.useEffect(()=>{(async()=>{await(async(b=10)=>{for(let n=0;n<b;n++)try{const{auth:w}=await N(async()=>{const{auth:k}=await import("./services-KJmycXHR.js").then(G=>G.fI);return{auth:k}},__vite__mapDeps([0,1,2,3,4,5,6]));if(w?.currentUser)return!0;await new Promise(k=>setTimeout(k,100))}catch{}return window.location.pathname.includes("owner-dashboard")&&console.warn("⚠️ Auth not ready after waiting, proceeding anyway (owner dashboard may have limited functionality)"),!1})();try{const{getSystemSettings:b}=await N(async()=>{const{getSystemSettings:n}=await import("./services-KJmycXHR.js").then(w=>w.fJ);return{getSystemSettings:n}},__vite__mapDeps([0,1,2,3,4,5,6])),o=await b();if(o?.developerBranding){const n=o.developerBranding,w={devName:n.devName??i.devName,phoneSA:n.devPhoneSA??i.phoneSA,phoneEG:n.devPhoneEG??i.phoneEG,email:n.devEmail??i.email,signature:n.devSignature??i.signature};u(w),localStorage.setItem("adora_dev_name",w.devName??""),localStorage.setItem("adora_dev_phone_sa",w.phoneSA??""),localStorage.setItem("adora_dev_phone_eg",w.phoneEG??""),localStorage.setItem("adora_dev_email",w.email??""),localStorage.setItem("adora_dev_signature",w.signature??"")}}catch(b){console.warn("Failed to load developer settings from Firebase, using localStorage:",b)}})()},[]),d.useEffect(()=>{const g=T=>{const b=T.detail||{};u(o=>{const n={devName:b.devName??o.devName,phoneSA:b.phoneSA??o.phoneSA,phoneEG:b.phoneEG??o.phoneEG,email:b.email??o.email,signature:b.signature!==void 0?b.signature:o.signature};return n.devName!=null&&localStorage.setItem("adora_dev_name",n.devName),n.phoneSA!=null&&localStorage.setItem("adora_dev_phone_sa",n.phoneSA),n.phoneEG!=null&&localStorage.setItem("adora_dev_phone_eg",n.phoneEG),n.email!=null&&localStorage.setItem("adora_dev_email",n.email),n.signature!=null&&localStorage.setItem("adora_dev_signature",n.signature),n})};return window.addEventListener("adora_dev_settings_updated",g),()=>window.removeEventListener("adora_dev_settings_updated",g)},[]),d.useEffect(()=>{if(typeof window>"u"||typeof document>"u")return;if(document.readyState==="loading"){const o=()=>{T()};return document.addEventListener("DOMContentLoaded",o),()=>{document.removeEventListener("DOMContentLoaded",o)}}let g=null;function T(){if(typeof window>"u"||typeof document>"u"||!document.documentElement||typeof MutationObserver>"u")return;const o=document.documentElement;if(!o||!(o instanceof Node)){console.warn("document.documentElement is not a valid Node");return}try{if(g=new MutationObserver(n=>{try{n.forEach(w=>{if(w.attributeName==="data-theme"){const k=document.documentElement?.getAttribute("data-theme");k!==null&&s(k==="dark")}})}catch(w){console.error("Error in MutationObserver callback:",w)}}),o&&o instanceof Node&&g)g.observe(o,{attributes:!0,attributeFilter:["data-theme"]});else{console.warn("Cannot observe: targetElement is null/not a Node, or observer is null");return}}catch(n){console.error("Failed to create or observe MutationObserver:",n);return}return()=>{try{g&&(g.disconnect(),g=null)}catch(n){console.error("Failed to disconnect observer:",n)}}}const b=T();return()=>{if(b&&b(),g)try{g.disconnect(),g=null}catch(o){console.error("Failed to disconnect observer in cleanup:",o)}}},[]);const x=i,I=new Date().getFullYear(),j=()=>{const g=new Date().getHours();return g>=5&&g<12?t("whatsapp.morning"):t("whatsapp.evening")},_=e.jsx("span",{className:l?"text-slate-600":"text-slate-300",children:"•"}),B=!!x.phoneSA?.trim(),p=!!x.phoneEG?.trim(),a=!!x.email?.trim();return e.jsx("footer",{className:"w-full py-2 text-center pointer-events-auto transition-all duration-300",dir:"ltr",style:{background:l?"linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(15, 23, 42, 1) 100%)":"linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 255, 255, 1) 100%)",borderTop:"1px solid",borderColor:l?"rgba(51, 65, 85, 0.5)":"rgba(226, 232, 240, 0.8)"},children:e.jsxs("p",{className:"text-[8px] sm:text-[9px] tracking-wide transition-all duration-300 flex items-center justify-center gap-1.5 flex-wrap px-4",style:{fontFamily:"'Inter', 'SF Pro Display', system-ui, sans-serif"},children:[e.jsxs("span",{className:l?"text-slate-400":"text-slate-500",children:["© ",I]}),_,e.jsx("span",{className:`font-semibold ${l?"text-teal-400":"text-teal-600"}`,children:x.signature||x.devName}),B&&e.jsxs(e.Fragment,{children:[_,e.jsxs("a",{href:`https://wa.me/${x.phoneSA.trim()}?text=${encodeURIComponent(j())}`,target:"_blank",rel:"noopener noreferrer",className:`hover:underline transition-colors ${l?"text-slate-300 hover:text-teal-400":"text-slate-600 hover:text-teal-600"}`,children:["+",x.phoneSA.trim()]})]}),p?e.jsxs(e.Fragment,{children:[_,e.jsxs("a",{href:`https://wa.me/${x.phoneEG.trim()}?text=${encodeURIComponent(j())}`,target:"_blank",rel:"noopener noreferrer",className:`hover:underline transition-colors ${l?"text-slate-300 hover:text-teal-400":"text-slate-600 hover:text-teal-600"}`,children:["+",x.phoneEG.trim()]})]}):e.jsxs(e.Fragment,{children:[_,e.jsx("span",{className:"inline-block min-w-[3ch]","aria-hidden":!0,children:" "})]}),a?e.jsxs(e.Fragment,{children:[_,e.jsx("a",{href:`mailto:${x.email.trim()}`,className:`hover:underline transition-colors ${l?"text-slate-300 hover:text-teal-400":"text-slate-600 hover:text-teal-600"}`,children:x.email.trim()})]}):e.jsxs(e.Fragment,{children:[_,e.jsx("span",{className:"inline-block min-w-[3ch]","aria-hidden":!0,children:" "})]}),_,e.jsx(Pe,{to:"/about",className:`hover:underline transition-colors ${l?"text-slate-300 hover:text-teal-400":"text-slate-600 hover:text-teal-600"}`,children:"About Us"})]})})},Wa=()=>{const t=ce(),{voiceEnabled:l,toggleVoice:s,success:c}=oa(),{user:i,branchId:u,setBranch:x,authReady:I}=fe(),{i18n:j,t:_}=Se(),[B,p]=X.useState(!1);Ha(),d.useEffect(()=>{const S=F=>{const H=["ar"].includes(F)?"rtl":"ltr";typeof document<"u"&&(document.documentElement.setAttribute("dir",H),document.documentElement.setAttribute("lang",F))};return j.on("languageChanged",S),S(j.language||"ar"),()=>{j.off("languageChanged",S)}},[j]),d.useEffect(()=>{la(t.pathname)},[t.pathname]),d.useEffect(()=>{const S=()=>p(!0);return document.addEventListener("click",S,{once:!0,passive:!0}),document.addEventListener("touchstart",S,{once:!0,passive:!0}),()=>{document.removeEventListener("click",S),document.removeEventListener("touchstart",S)}},[]),d.useEffect(()=>{if(!B||!i?.tenantId||!i?.branches||i.branches.length<=1||!u||i?.role==="manager"||i?.role==="owner"||t.pathname==="/login"||t.pathname.startsWith("/guest"))return;const F=(async()=>{try{const{createGeofenceMonitor:A}=await N(async()=>{const{createGeofenceMonitor:q}=await import("./services-KJmycXHR.js").then(m=>m.fX);return{createGeofenceMonitor:q}},__vite__mapDeps([0,1,2,3,4,5,6])),H=A(i.tenantId,u,i.branches,6e4);return H.onEnter(q=>{if(q.branchId!==u){const m=_("branchSwitch.enterBranchScope",{branchName:q.branchName});window.confirm(m)&&(x(q.branchId),c(_("branchSwitch.switchedTo",{branchName:q.branchName})))}}),H.start(),()=>{H.stop()}}catch(A){console.error("Error loading auto-switch:",A);return}})();return()=>{F.then(A=>A?.()).catch(console.error)}},[B,i?.tenantId,i?.branches,u,x,c,t.pathname,_]);const a=i?.role==="manager",g=i?.role==="owner",T=t.pathname==="/login"||t.pathname.startsWith("/guest"),b=t.pathname==="/",n=["/admin","/reception","/housekeeping","/bellman","/coffeeshop","/maintenance","/procurement"].some(S=>t.pathname.startsWith(S)),w=I&&!b&&a&&n&&!T,k=t.pathname==="/about",G=I&&!b&&!T&&!w&&!g&&!k;return e.jsxs("div",{className:"min-h-screen",style:{background:T?"transparent":"var(--theme-bg-primary)"},children:[w&&e.jsx("div",{className:"animate-in fade-in duration-200",children:e.jsx(qt,{})}),G&&e.jsx("div",{className:"animate-in fade-in duration-200",children:e.jsx(qa,{isVoiceEnabled:l,onToggleVoice:s})}),e.jsx("main",{className:`w-full transition-[padding] duration-200 ${G?"pt-16 sm:pt-20 md:pt-24":w?"pt-0":I?"":"pt-0"}`,children:e.jsx(Yt,{children:e.jsx(Va,{})})}),e.jsx(Wt,{}),e.jsx(Jt,{}),e.jsx(Ya,{})]})},Ja=()=>{if(new URLSearchParams(window.location.search).has("sim"))return e.jsx($t,{});const[l]=d.useState(!1);d.useEffect(()=>{(async()=>{const{initErrorHandler:i}=await N(async()=>{const{initErrorHandler:p}=await import("./services-KJmycXHR.js").then(a=>a.fY);return{initErrorHandler:p}},__vite__mapDeps([0,1,2,3,4,5,6]));i(),setTimeout(async()=>{try{const{runDataDoctor:p,performHealthCheck:a}=await N(async()=>{const{runDataDoctor:b,performHealthCheck:o}=await import("./services-KJmycXHR.js").then(n=>n.fZ);return{runDataDoctor:b,performHealthCheck:o}},__vite__mapDeps([0,1,2,3,4,5,6])),g=await a();g.seeded&&qe.debug("Database seeded",g.seedingResult?.collectionsCreated,"App");const T=localStorage.getItem("adora_user");if(T){const b=JSON.parse(T);if(b.tenantId&&(b.branch||b.branches&&b.branches[0])){const o=b.branch||b.branches[0],n=typeof o=="object"&&o?.id?o.id:o?.code??String(o??"");n&&await p(b.tenantId,n)}}}catch(p){p?.code!==400&&!String(p?.message||"").includes("400")&&qe.warn("Data Doctor skipped or failed",p?.message,"App")}},2500);const u=await N(()=>import("./services-KJmycXHR.js").then(p=>p.f_),__vite__mapDeps([0,1,2,3,4,5,6])),x=await N(()=>import("./services-KJmycXHR.js").then(p=>p.fN),__vite__mapDeps([0,1,2,3,4,5,6])),I=await N(()=>import("./services-KJmycXHR.js").then(p=>p.f$),__vite__mapDeps([0,1,2,3,4,5,6])),j=await N(()=>import("./services-KJmycXHR.js").then(p=>p.fT),__vite__mapDeps([0,1,2,3,4,5,6])),_=await N(()=>import("./services-KJmycXHR.js").then(p=>p.fI),__vite__mapDeps([0,1,2,3,4,5,6])),B=await N(()=>import("./vendor-firebase-CWdI6yjY.js").then(p=>p.O),__vite__mapDeps([1,2]));window.debugGenius={predictive:u,sentiment:x,i18n:I,smartAlerts:j,laundry:await N(()=>import("./services-KJmycXHR.js").then(p=>p.fS),__vite__mapDeps([0,1,2,3,4,5,6])),housekeeping:await N(()=>import("./services-KJmycXHR.js").then(p=>p.g0),__vite__mapDeps([0,1,2,3,4,5,6])),db:_.db,firestore:B},window.checkFirebaseConfig=()=>{const p=localStorage.getItem("adora_client_config");if(p)try{const a=JSON.parse(p);return console.log("🔍 Current Firebase Config:",{projectId:a.projectId,authDomain:a.authDomain,hasApiKey:!!a.apiKey,hasStorageBucket:!!a.storageBucket,fullConfig:a}),a}catch(a){return console.error("❌ Failed to parse config:",a),null}else return console.log("ℹ️ No Firebase config in localStorage - using environment variables"),null}})()},[]);const s=[{Component:ta},{Component:aa},{Component:sa},{Component:Mt},{Component:Vt},{Component:ra},{Component:Ht},{Component:na},{Component:Ut}];return e.jsx(e.Fragment,{children:e.jsx(Ct,{future:{v7_startTransition:!0,v7_relativeSplatPath:!0},children:e.jsxs(Gt,{providers:s,children:[e.jsx(Wa,{}),e.jsx(zt,{}),e.jsx(Kt,{})]})})})},Xa={BASE_URL:"/",DEV:!1,MODE:"production",PROD:!0,SSR:!1,VITE_ENCRYPTION_KEY:"0436b2527f25f2c26ced9769801c5583432d981b1c4fed4d06f08b2b4f330ed8",VITE_FIREBASE_API_KEY:"AIzaSyA1qNqaWPlpH_j6YjU-maXJrpJO663O9-Y",VITE_FIREBASE_APP_ID:"1:406510676364:web:e5f7275250352766038ea9",VITE_FIREBASE_AUTH_DOMAIN:"adora-platform2026.firebaseapp.com",VITE_FIREBASE_MESSAGING_SENDER_ID:"406510676364",VITE_FIREBASE_PROJECT_ID:"adora-platform2026",VITE_FIREBASE_STORAGE_BUCKET:"adora-platform2026.firebasestorage.app",VITE_GEMINI_API_KEY:"AIzaSyD_XDLjvHhNCuIPSymraAytrJi2ktCL2Vo",VITE_IMGBB_API_KEY:"b9bbddc62f8ce1f335a9bad733a5afc5",VITE_OWNER_PIN_HASH:"4e0ca1ba71b351230a9c4fa7e5a224ab955dfc986c04a660053bca16a95990f4"};{const t=["VITE_ENCRYPTION_KEY"],l=[],s=[];if(t.forEach(c=>{const i=Xa[c];(!i||i==="adora-default-encryption-key-change-in-production"&&c==="VITE_ENCRYPTION_KEY")&&(l.push(c),i==="adora-default-encryption-key-change-in-production"&&s.push(c))}),l.length>0){const c=`
🚨 SECURITY ERROR: Missing or default environment variables in production!

Missing/Default Variables:
${l.map(u=>`  - ${u}${s.includes(u)?" (using default - NOT SECURE!)":" (not set)"}`).join(`
`)}

Please set these variables in your .env file:
${l.map(u=>`  ${u}=your-secure-value-here`).join(`
`)}

The application cannot run in production without these secure values.
        `.trim();console.error(c);const i=document.getElementById("root");throw i&&(i.innerHTML=`
                <div style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    padding: 2rem;
                    background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
                    color: #f1f5f9;
                    font-family: 'Cairo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                ">
                    <div style="
                        max-width: 650px;
                        width: 100%;
                        padding: 2.5rem;
                        background: rgba(32, 178, 170, 0.08);
                        backdrop-filter: blur(12px);
                        border: 2px solid rgba(32, 178, 170, 0.3);
                        border-radius: 1.25rem;
                        box-shadow: 0 20px 60px rgba(32, 178, 170, 0.15), 0 0 40px rgba(32, 178, 170, 0.1);
                    ">
                        <div style="
                            display: flex;
                            align-items: center;
                            gap: 0.75rem;
                            margin-bottom: 1.5rem;
                        ">
                            <div style="
                                width: 48px;
                                height: 48px;
                                border-radius: 12px;
                                background: linear-gradient(135deg, #20B2AA 0%, #14B8A6 100%);
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                box-shadow: 0 8px 24px rgba(32, 178, 170, 0.3);
                            ">
                                <span style="font-size: 24px;">🔐</span>
                            </div>
                            <h1 style="
                                color: #20B2AA;
                                margin: 0;
                                font-size: 1.5rem;
                                font-weight: 700;
                                letter-spacing: -0.5px;
                            ">خطأ في الإعدادات الأمنية</h1>
                        </div>
                        <div style="
                            background: rgba(0, 0, 0, 0.4);
                            padding: 1.5rem;
                            border-radius: 0.875rem;
                            border: 1px solid rgba(32, 178, 170, 0.2);
                            margin-bottom: 1.5rem;
                        ">
                            <pre style="
                                margin: 0;
                                overflow-x: auto;
                                white-space: pre-wrap;
                                font-size: 0.875rem;
                                line-height: 1.75;
                                color: #e2e8f0;
                                font-family: 'Fira Code', 'Courier New', monospace;
                            ">${c}</pre>
                        </div>
                        <div style="
                            padding: 1rem;
                            background: rgba(32, 178, 170, 0.1);
                            border-radius: 0.75rem;
                            border-left: 4px solid #20B2AA;
                        ">
                            <p style="
                                margin: 0;
                                color: #94a3b8;
                                font-size: 0.875rem;
                                line-height: 1.6;
                            ">
                                <strong style="color: #20B2AA;">ملاحظة:</strong> يرجى التحقق من ملف <code style="background: rgba(0, 0, 0, 0.3); padding: 0.25rem 0.5rem; border-radius: 4px; font-family: monospace;">.env</code> والتأكد من تعيين جميع المفاتيح المطلوبة بشكل صحيح.
                            </p>
                        </div>
                    </div>
                </div>
            `),new Error(c)}}kt.createRoot(document.getElementById("root")).render(e.jsx(X.StrictMode,{children:e.jsx(ia,{children:e.jsx(Pt,{i18n:Dt,children:e.jsx(Ja,{})})})}));export{ns as L};
