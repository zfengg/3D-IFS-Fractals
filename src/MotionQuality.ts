/** Probe for more detail during sustained smooth motion; back off on slow frames. */
export class MotionQuality {
  private slowFrames=0;
  private fastFrames=0;
  private recoveryFrames=0;
  private lastTime:number|null=null;
  constructor(public budget=250_000, private readonly minimum=50_000) {}
  shouldAutoRotate(count:number,reducedMotion=false):boolean {return !reducedMotion&&count<=this.budget;}
  update(time:number,moving:boolean,pointCount=5_000_000):number {
    const elapsed=this.lastTime===null?0:time-this.lastTime;
    this.lastTime=moving?time:null;
    if(!moving||elapsed<=0||elapsed>=500){this.slowFrames=0;this.fastFrames=0;return this.budget;}
    this.slowFrames=elapsed>22?this.slowFrames+1:Math.max(0,this.slowFrames-1);
    this.fastFrames=elapsed<=18.5?this.fastFrames+1:0;
    if(this.recoveryFrames>0){this.recoveryFrames--;this.fastFrames=0;}
    if(this.slowFrames>=20){
      this.budget=Math.max(this.minimum,Math.floor(this.budget*.7));
      this.slowFrames=0;this.fastFrames=0;this.recoveryFrames=120;
    }else if(this.fastFrames>=60){
      const maximum=Math.min(5_000_000,Math.max(this.minimum,pointCount));
      if(this.budget<maximum)this.budget=Math.min(maximum,Math.ceil(this.budget*1.25));
      this.fastFrames=0;
    }
    return this.budget;
  }
}
