/* Acoustic calibration stays on this device. It is not biometric speaker identification. */
(() => {
'use strict';
const KEY='duotranslate.acoustic-profile.v1';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const quantile=(values,q)=>{const a=values.filter(Number.isFinite).sort((a,b)=>a-b);return a.length?a[Math.floor((a.length-1)*q)]:0;};
function frame(data,sampleRate,time){
 let sum=0;for(const v of data)sum+=v*v;const rms=Math.sqrt(sum/data.length);
 let pitch=0,best=.65;
 if(rms>.008){for(let lag=Math.floor(sampleRate/400);lag<=Math.floor(sampleRate/75);lag+=2){let xy=0,xx=0,yy=0;for(let i=0;i<data.length-lag;i+=2){xy+=data[i]*data[i+lag];xx+=data[i]*data[i];yy+=data[i+lag]*data[i+lag];}const correlation=xy/Math.sqrt(xx*yy||1);if(correlation>best){best=correlation;pitch=sampleRate/lag;}}}
 return {rms,pitch,time};
}
function summarize(frames){
 const levels=frames.map(f=>f.rms),usual=quantile(levels,.7);if(usual<.006)return null;
 const noise=Math.min(quantile(levels,.1),usual*.3),threshold=Math.max(.004,noise*2,usual*.18);
 let start=null,hadVoice=false;const pauses=[];
 for(const f of frames){if(f.rms>threshold){if(start!==null&&hadVoice&&f.time-start>100)pauses.push(f.time-start);start=null;hadVoice=true;}else if(start===null)start=f.time;}
 const pitches=frames.filter(f=>f.rms>threshold&&f.pitch>0).map(f=>f.pitch);
 return {noise,usual,threshold,pauseMs:clamp(quantile(pauses,.8)+350,600,1800),pitchHz:quantile(pitches,.5),pitchRange:[quantile(pitches,.1),quantile(pitches,.9)],frames:frames.length};
}
function activate(results,deviceLabel){
 const valid=results.filter(r=>r.success&&r.acoustic).map(r=>r.acoustic);
 if(!valid.length){localStorage.removeItem(KEY);return null;}
 const profile={version:1,createdAt:Date.now(),deviceLabel,noise:quantile(valid.map(x=>x.noise),.5),usual:quantile(valid.map(x=>x.usual),.5),threshold:quantile(valid.map(x=>x.threshold),.5),pauseMs:quantile(valid.map(x=>x.pauseMs),.7),pitchHz:quantile(valid.map(x=>x.pitchHz),.5),pitchRange:[quantile(valid.map(x=>x.pitchRange[0]),.2),quantile(valid.map(x=>x.pitchRange[1]),.8)]};
 localStorage.setItem(KEY,JSON.stringify(profile));return profile;
}
function current(){try{const p=JSON.parse(localStorage.getItem(KEY)||'null');return p?.version===1&&p.threshold>=.004&&p.threshold<1&&p.pauseMs>=600&&p.pauseMs<=1800?p:null;}catch{return null;}}
function endpoint(profile){let started=false,last=0;return (rms,now,pitch=0)=>{const softVoiced=rms>profile.threshold*.6&&pitch>0&&profile.pitchRange?.[0]>0&&pitch>=profile.pitchRange[0]*.65&&pitch<=profile.pitchRange[1]*1.6;if(rms>profile.threshold||softVoiced){started=true;last=now;}if(started&&now-last>=profile.pauseMs){started=false;return true;}return false;};}
function attach(rec){
 const p=current();if(!p)return ()=>{};
 const onresult=rec.onresult,onend=rec.onend,onstart=rec.onstart;
 let stopped=false,closing=false,stream,ctx,timer,deadline,transcripts=[];
 const boundary=endpoint(p);rec.continuous=true;rec.interimResults=true;
 function cleanup(){if(stopped)return;stopped=true;clearInterval(timer);clearTimeout(deadline);stream?.getTracks().forEach(t=>t.stop());ctx?.close().catch(()=>{});}
 function flush(){if(transcripts.length){const text=transcripts.join(' ');transcripts=[];onresult?.({resultIndex:0,results:[Object.assign([{transcript:text}],{isFinal:true})]});}}
 function finish(){if(closing||stopped)return;closing=true;try{rec.stop();}catch{cleanup();flush();}}
 rec.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++)if(e.results[i].isFinal)transcripts.push(e.results[i][0].transcript);};
 rec.onspeechend=()=>{clearTimeout(deadline);deadline=setTimeout(finish,p.pauseMs);};
 rec.onspeechstart=()=>{clearTimeout(deadline);deadline=setTimeout(finish,12000);};
 rec.onstart=async e=>{onstart?.(e);deadline=setTimeout(finish,12000);try{
  stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
  if(stopped){stream.getTracks().forEach(t=>t.stop());return;}
  ctx=new (window.AudioContext||window.webkitAudioContext)();await ctx.resume();const source=ctx.createMediaStreamSource(stream),analyser=ctx.createAnalyser();analyser.fftSize=1024;source.connect(analyser);const data=new Float32Array(1024);
  timer=setInterval(()=>{analyser.getFloatTimeDomainData(data);const features=frame(data,ctx.sampleRate,performance.now());if(boundary(features.rms,features.time,features.pitch))finish();},50);
 }catch{/* Native speech events still use the calibrated pause duration. */}};
 rec.onend=e=>{cleanup();flush();onend?.(e);};
 return ()=>{transcripts=[];cleanup();};
}
window.DuoVoiceProfile={frame,summarize,activate,current,endpoint,attach};
})();
