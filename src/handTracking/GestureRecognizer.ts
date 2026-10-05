import type { Command } from '../game/Simulation';
export type Point = {x:number;y:number;z?:number};
export type Recognition = { gesture: Command; confidence: number };
const distance = (a:Point,b:Point) => Math.hypot(a.x-b.x,a.y-b.y);
export function recognize(points: Point[], mirror = true, sensitivity = 'MEDIUM'): Recognition {
  if(points.length!==21) return {gesture:'NO_HAND',confidence:0};
  const palm = distance(points[0],points[9]);
  if(palm < .025) return {gesture:'NEUTRAL',confidence:0};
  const extended = [8,12,16,20].map(tip => distance(points[tip],points[0]) > distance(points[tip-2],points[0])*1.18 && distance(points[tip],points[tip-3]) > palm*.65);
  const curled = [8,12,16,20].map(tip => distance(points[tip],points[0]) < distance(points[tip-2],points[0])*1.13);
  const thumbFolded = distance(points[4],points[5]) < palm*.9 || distance(points[4],points[0]) < palm*1.2;
  if(curled.every(Boolean) && thumbFolded) return {gesture:'FIST',confidence:.94};
  const dx = (points[8].x-points[5].x)*(mirror ? -1 : 1); const dy=points[8].y-points[5].y;
  const threshold = sensitivity==='HIGH' ? .55 : sensitivity==='LOW' ? .95 : .75;
  if(extended[0] && extended.slice(1).filter(Boolean).length <= 1 && Math.abs(dx)>palm*threshold && Math.abs(dx)>Math.abs(dy)*1.25) {
    return {gesture:dx<0?'LEFT':'RIGHT',confidence:Math.min(.99,.76+Math.abs(dx)/palm*.1)};
  }
  return {gesture:'NEUTRAL',confidence:.85};
}
export class GestureSmoothing {
  history: Recognition[]=[]; private candidate:Command='NO_HAND'; private since=0; stable: Command='NO_HAND'; private lastDirection: Command='NEUTRAL'; private lastLaneAt=-Infinity;
  reset() {this.history=[];this.candidate='NO_HAND';this.since=0;this.stable='NO_HAND';this.lastDirection='NEUTRAL';this.lastLaneAt=-Infinity;}
  update(result:Recognition,now:number): {stable:Command;command:Command|null;confidence:number} {
    this.history.push(result);if(this.history.length>7)this.history.shift();
    const votes = this.history.filter(r=>r.gesture===result.gesture && r.confidence>=.75).length;
    const eligible = result.gesture==='NO_HAND' || (votes>=4 && votes/this.history.length>=.65);
    if(!eligible) return {stable:this.stable,command:null,confidence:result.confidence};
    if(this.candidate!==result.gesture){this.candidate=result.gesture;this.since=now;}
    if(now-this.since<190) return {stable:this.stable,command:null,confidence:result.confidence};
    const changed=this.stable!==this.candidate;this.stable=this.candidate;
    let command:Command|null=null;
    if(this.stable==='LEFT'||this.stable==='RIGHT') {
      // A held pointing gesture produces one lane change. Neutral rearms it.
      if(this.lastDirection!==this.stable && now-this.lastLaneAt>=650) {command=this.stable;this.lastDirection=this.stable;this.lastLaneAt=now;}
    } else if(this.stable==='NEUTRAL'||this.stable==='FIST') {this.lastDirection='NEUTRAL'; if(changed)command=this.stable;}
    else if(changed) command='NO_HAND';
    return {stable:this.stable,command,confidence:result.confidence};
  }
}
