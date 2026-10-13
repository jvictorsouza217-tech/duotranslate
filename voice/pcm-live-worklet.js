/* 100ms PCM 16kHz mono chunks for opt-in Google Live preview. */
class DuoLivePCM extends AudioWorkletProcessor {
 constructor(){super();this.pending=[];this.sum=0;this.count=0;this.phase=0;}
 process(inputs,outputs){
  const channel=inputs[0]?.[0];
  if(channel)for(const value of channel){
   this.sum+=value;this.count++;this.phase+=16000;
   if(this.phase>=sampleRate){
    this.phase-=sampleRate;
    const v=Math.max(-1,Math.min(1,this.sum/Math.max(1,this.count)));
    this.pending.push(v<0?v*32768:v*32767);this.sum=0;this.count=0;
    if(this.pending.length>=1600){
     const pcm=new Int16Array(this.pending.splice(0,1600));
     this.port.postMessage(pcm.buffer,[pcm.buffer]);
    }
   }
  }
  for(const output of outputs)for(const outputChannel of output)outputChannel.fill(0);
  return true;
 }
}
registerProcessor('duo-live-pcm',DuoLivePCM);
