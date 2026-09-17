/** Reduce motion detail only after sustained slow frames, avoiding single-frame spikes. */
export class MotionQuality {
  private slowFrames=0;
  private lastTime:number|null=null;
  constructor(public budget=250_000, private readonly minimum=50_000) {}
  update(time:number,moving:boolean):number {
    const elapsed=this.lastTime===null?0:time-this.lastTime;
    this.lastTime=moving?time:null;
    if(!moving){this.slowFrames=0;return this.budget;}
    if(elapsed<=0||elapsed>100){this.slowFrames=0;return this.budget;}
    this.slowFrames=elapsed>22?this.slowFrames+1:Math.max(0,this.slowFrames-1);
    if(this.slowFrames>=20){this.budget=Math.max(this.minimum,Math.floor(this.budget*.7));this.slowFrames=0;}
    return this.budget;
  }
}
