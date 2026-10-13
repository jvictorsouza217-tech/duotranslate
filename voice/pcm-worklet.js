class DuoPCM extends AudioWorkletProcessor {
 constructor(){super();this.samples=[];this.sum=0;this.count=0;this.phase=0;}
 process(inputs,outputs){
  const input=inputs[0]?.[0];if(input)for(const value of input){this.sum+=value;this.count++;this.phase+=16000;if(this.phase>=sampleRate){this.phase-=sampleRate;const v=Math.max(-1,Math.min(1,this.sum/this.count));this.samples.push(v<0?v*32768:v*32767);this.sum=0;this.count=0;if(this.samples.length===3200){const pcm=new Int16Array(this.samples);this.port.postMessage(pcm.buffer,[pcm.buffer]);this.samples=[];}}}
  for(const output of outputs)for(const channel of output)channel.fill(0);
  return true;
 }
}
registerProcessor('duo-pcm',DuoPCM);
