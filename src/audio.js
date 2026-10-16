export class CoastAudio {
  constructor(values){this.values=values;this.playing=false;this.context=null;}
  async toggle(){
    if(!this.context)this.init();
    if(this.context.state==='suspended')await this.context.resume();
    this.playing=!this.playing;
    this.update();return this.playing;
  }
  init(){
    const ctx=this.context=new (window.AudioContext||window.webkitAudioContext)();
    this.master=ctx.createGain();this.master.gain.value=0;this.master.connect(ctx.destination);
    this.channels={};
    for(const type of ['waves','wind']){
      const buffer=ctx.createBuffer(2,ctx.sampleRate*12,ctx.sampleRate);
      for(let channel=0;channel<2;channel++){const data=buffer.getChannelData(channel);let brown=0,b0=0,b1=0,b2=0;for(let i=0;i<data.length;i++){const white=Math.random()*2-1;brown=(brown+.02*white)/1.02;b0=.99765*b0+white*.099046;b1=.963*b1+white*.2965164;b2=.57*b2+white*1.0526913;data[i]=type==='waves'?(brown*3+(b0+b1+b2+white*.1848)*.035)*.7:brown*2.5;}}
      const source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;
      const low=ctx.createBiquadFilter();low.type='lowpass';low.frequency.value=type==='waves'?1200:430;
      const high=ctx.createBiquadFilter();high.type='highpass';high.frequency.value=type==='waves'?80:100;
      const gain=ctx.createGain();gain.gain.value=0;const swell=ctx.createGain();swell.gain.value=type==='waves'?.65:.7;
      const oscillator=ctx.createOscillator();oscillator.frequency.value=type==='waves'?.105:.033;const modulation=ctx.createGain();modulation.gain.value=type==='waves'?.32:.14;oscillator.connect(modulation);modulation.connect(swell.gain);oscillator.start();
      source.connect(low);low.connect(high);high.connect(gain);gain.connect(swell);swell.connect(this.master);source.start();this.channels[type]=gain;
    }
  }
  update(){if(!this.context)return;const now=this.context.currentTime;this.master.gain.setTargetAtTime(this.playing?this.values.master/100*.65:0,now,.25);for(const type of ['waves','wind'])this.channels[type].gain.setTargetAtTime(this.values[type]/100,now,.3);}
}
