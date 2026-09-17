/** Tight inclusive bounds of visible pixels, independent of the export background. */
export function alphaBounds(data: Uint8ClampedArray, width: number, height: number): {x:number;y:number;width:number;height:number}|null {
  let left=width,top=height,right=-1,bottom=-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    if(data[(y*width+x)*4+3]===0)continue;
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
  }
  return right<0?null:{x:left,y:top,width:right-left+1,height:bottom-top+1};
}
