// ════════════════════════════════════════════════════════════════════
// live/results-fx.js — спільні ефекти фінальних екранів (викладач і учень):
// анімації, одометр цифр, звуки Web Audio (без файлів), вібрація.
// Копія лежить і в quizflow-app/live, і в quizflow-play/live — тримати однаковими.
// ════════════════════════════════════════════════════════════════════

const STYLE = `
.od{display:inline-block;height:1.14em;line-height:1.14;overflow:hidden;vertical-align:top}
.od .odc{display:flex;flex-direction:column}
.od .odc b{display:block;height:1.14em;line-height:1.14;font-weight:inherit}
.ch{display:inline-block;overflow:hidden;vertical-align:top;padding:0 .06em .16em;margin:0 -.06em -.16em}
.ch i{display:inline-block;font-style:normal}
.wd{display:inline-block;white-space:nowrap}
.fx-ring{position:absolute;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;border:4px solid var(--rc,rgba(255,255,255,.55));pointer-events:none}
#fx-flash{position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:50}
`;
if (!document.getElementById("fx-style")) {
  const s = document.createElement("style"); s.id = "fx-style"; s.textContent = STYLE; document.head.appendChild(s);
}
const escH = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export const EO = "cubic-bezier(.16,1,.3,1)", POP = "cubic-bezier(.2,1.5,.3,1)";
let ANI = [];
export const A = (el, kf, o) => { if (!el) return; const a = el.animate(kf, { fill: "both", easing: EO, ...o }); ANI.push(a); return a; };
export const cancelAll = () => { ANI.forEach(a => { try { a.cancel(); } catch {} }); ANI = []; document.querySelectorAll(".fx-ring").forEach(r => r.remove()); };
export const finishAll = () => ANI.forEach(a => { try { a.finish(); } catch {} });

// Текст по літерах (з екрануванням) і одометр для чисел
export const split = s => String(s ?? "").split(" ").map(w => `<span class="wd">${[...w].map(c => `<span class="ch"><i>${escH(c)}</i></span>`).join("")}</span>`).join(" ");
export const odo = s => [...String(s)].map(c => /\d/.test(c)
  ? `<span class="od" data-n="${c}"><span class="odc">${[...Array(20)].map((_, i) => `<b>${i % 10}</b>`).join("")}</span></span>`
  : `<span>${escH(c)}</span>`).join("");

const flashEl = () => document.getElementById("fx-flash") || document.body.appendChild(Object.assign(document.createElement("div"), { id: "fx-flash" }));
export const flash = (a, d, at) => A(flashEl(), [{ opacity: a }, { opacity: 0 }], { duration: d, delay: at, easing: "ease-out", fill: "forwards" });
export const shake = (el, k, d, at) => A(el, [{ transform: "translate(0,0)" }, { transform: `translate(${-12 * k}px,${7 * k}px)` }, { transform: `translate(${10 * k}px,${-8 * k}px)` }, { transform: `translate(${-6 * k}px,${5 * k}px)` }, { transform: "translate(0,0)" }], { duration: d, delay: at, easing: "ease-out" });
export const rings = (host, x, y, at, n, size) => { for (let i = 0; i < n; i++) { const r = document.createElement("span"); r.className = "fx-ring"; r.style.left = x; r.style.top = y; host.appendChild(r); A(r, [{ transform: "scale(0)", opacity: .9 }, { transform: `scale(${size})`, opacity: 0 }], { duration: 1300, delay: at + i * 130, easing: "cubic-bezier(.2,.7,.3,1)" }); } };
export const letters = (root, at, step) => {
  if (!root) return; const chars = root.querySelectorAll(".ch i"); const st = step || Math.max(8, Math.min(34, 700 / Math.max(1, chars.length)));
  chars.forEach((i, k) => A(i, [{ transform: "translateY(118%)" }, { transform: "translateY(0)" }], { duration: 650, delay: at + k * st }));
};
export const odometer = (root, at, dur, step = 110) => {
  if (!root) return; const ods = [...root.querySelectorAll(".od")]; SND.odo(at, dur);
  ods.forEach((o, k) => { const n = +o.dataset.n, c = o.querySelector(".odc"), to = -(10 + n) * 5, d = dur + k * step;
    A(c, [{ transform: "translateY(0%)" }, { transform: `translateY(${to}%)` }], { duration: d, delay: at, easing: "cubic-bezier(.2,.8,.15,1)" });
    A(c, [{ filter: "blur(0px)" }, { filter: "blur(2.4px)", offset: .22 }, { filter: "blur(1.8px)", offset: .62 }, { filter: "blur(0px)" }], { duration: d, delay: at, easing: "linear" }); });
};
export const fade = (el, at, d) => A(el, [{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], { duration: d || 600, delay: at });
export const vib = p => { try { navigator.vibrate && navigator.vibrate(p); } catch {} };

/* ---------- звук ---------- */
export const SND={ctx:null,on:(()=>{try{return localStorage.getItem("qf_snd")!=="0"}catch{return true}})(),t0:0,
 init(){if(!this.ctx){try{const C=window.AudioContext||window.webkitAudioContext;this.ctx=new C();const l=this.ctx.createDynamicsCompressor();l.connect(this.ctx.destination);const c=this.ctx,g=c.createGain();g.gain.value=.8;const lp=c.createBiquadFilter();lp.type="lowpass";lp.frequency.value=7500;g.connect(lp);lp.connect(l);this.bus=g;
  const len=Math.floor(c.sampleRate*1.7),ir=c.createBuffer(2,len,c.sampleRate);for(let ch=0;ch<2;ch++){const d=ir.getChannelData(ch);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3.2)}
  const cv=c.createConvolver();cv.buffer=ir;const wet=c.createGain();wet.gain.value=.32;g.connect(cv);cv.connect(wet);wet.connect(lp);
  const b=this.ctx.createBuffer(1,this.ctx.sampleRate,this.ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;this.nb=b}catch(e){this.ctx=null}}
  if(this.ctx&&this.ctx.state==="suspended")this.ctx.resume().catch(()=>{})},
 ok(){return this.on&&this.ctx&&this.ctx.state==="running"},
 begin(){this.t0=this.ctx?this.ctx.currentTime+.08:0},
 osc(type,f0,f1,ms,dur,vol){if(!this.ok())return;const c=this.ctx,t=this.t0+ms/1000,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(f0,t);if(f1!==f0)o.frequency.exponentialRampToValueAtTime(f1,t+dur);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(this.bus);o.start(t);o.stop(t+dur+.05)},
 noise(ms,dur,vol,f0,f1,type,q,rise){if(!this.ok())return;const c=this.ctx,t=this.t0+ms/1000,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=this.nb;s.loop=true;f.type=type||"bandpass";f.Q.value=q||1;f.frequency.setValueAtTime(f0,t);f.frequency.exponentialRampToValueAtTime(f1,t+dur);g.gain.setValueAtTime(.0001,t);if(rise){g.gain.exponentialRampToValueAtTime(vol,t+dur*.92);g.gain.exponentialRampToValueAtTime(.0001,t+dur)}else{g.gain.exponentialRampToValueAtTime(vol,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+dur)}s.connect(f);f.connect(g);g.connect(this.bus);s.start(t);s.stop(t+dur+.05)},
 bell(ms,f,vol,dur){const P=[[1,1],[2.01,.32],[3.02,.14],[4.15,.06]];P.forEach(([m,a])=>this.osc("sine",f*m,f*m,ms,(dur||1.1)/(m>1?m*.6:1),(vol||.1)*a))},
 thump(ms,vol,f){this.osc("sine",f||110,40,ms,.55,(vol||.8)*.8);this.osc("triangle",230,90,ms,.08,(vol||.8)*.25)},
 ping(ms,f,vol){this.bell(ms,f,(vol||.1)*1.3,1.3)},
 chord(ms,notes,vol){notes.forEach((f,i)=>this.bell(ms+i*85,f,(vol||.07)*1.7,1.6));const base=notes[0]/2;this.osc("sine",base,base,ms,1.8,(vol||.07)*.9);this.osc("sine",base*1.5,base*1.5,ms,1.8,(vol||.07)*.5)},
 tick(){},
 riser(){},
 whoosh(){},
 odo(ms,dur){this.ping(ms+dur,NOTE.G5,.05)}
};
export function bez(p1x,p1y,p2x,p2y,y){let lo=0,hi=1;for(let i=0;i<28;i++){const t=(lo+hi)/2,yy=3*(1-t)*(1-t)*t*p1y+3*(1-t)*t*t*p2y+t*t*t;if(yy<y)lo=t;else hi=t}const t=(lo+hi)/2;return 3*(1-t)*(1-t)*t*p1x+3*(1-t)*t*t*p2x+t*t*t}
export const NOTE={C5:523.25,E5:659.25,G5:783.99,C6:1046.5,A4:440,D5:587.33,G4:392,E4:329.63,C4:261.63};

// Звук вмикається/вимикається і запам'ятовується
SND.toggle = function () { this.on = !this.on; try { localStorage.setItem("qf_snd", this.on ? "1" : "0"); } catch {} this.init(); return this.on; };
