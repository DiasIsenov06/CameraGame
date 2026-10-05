import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { GestureSmoothing, recognize, type Point } from './GestureRecognizer';
import type { Command } from '../game/Simulation';
export type Tracking = {gesture:Command;confidence:number;points:Point[];command:Command|null};
export class HandTracker {
  video=document.createElement('video'); private model:HandLandmarker|null=null; private stream:MediaStream|null=null; private frame=0; private lastTime=-1;private stopped=true;private generation=0;
  smoothing=new GestureSmoothing(); mirror=true;sensitivity='MEDIUM';
  async start(onFrame:(result:Tracking)=>void) {
    if(!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access needs HTTPS or localhost. Open this game in a secure browser tab.');
    this.stop();const generation=this.generation;
    try {
      const stream=await navigator.mediaDevices.getUserMedia({video:{width:640,height:480,facingMode:'user'},audio:false});
      if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());throw new DOMException('Camera request cancelled','AbortError');}
      this.stream=stream;this.video.srcObject=this.stream;this.video.muted=true;this.video.playsInline=true;await this.video.play();
      if(!this.model){
        const files=await FilesetResolver.forVisionTasks('/mediapipe/wasm');
        this.model=await HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'/mediapipe/hand_landmarker.task',delegate:'CPU'},runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.65,minHandPresenceConfidence:.65,minTrackingConfidence:.65});
      }
      if(generation!==this.generation)throw new DOMException('Camera request cancelled','AbortError');
      this.stopped=false;this.smoothing.reset();this.lastTime=-1;
      const loop=()=>{
        if(this.stopped)return;
        try {
          if(this.video.readyState>=2 && this.video.currentTime!==this.lastTime){
            this.lastTime=this.video.currentTime;const now=performance.now();const result=this.model!.detectForVideo(this.video,now);const points=result.landmarks[0]??[];
            const filtered=this.smoothing.update(recognize(points,this.mirror,this.sensitivity),now);
            onFrame({...filtered,gesture:filtered.stable,points});
          }
          this.frame=window.setTimeout(loop,40);
        } catch {this.stop();onFrame({gesture:'NO_HAND',confidence:0,points:[],command:null});}
      };loop();
    } catch(error) {if(generation===this.generation)this.stop();throw error;}
  }
  stop(){this.generation++;this.stopped=true;clearTimeout(this.frame);this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.video.pause();this.video.srcObject=null;}
  dispose(){this.stop();this.model?.close();this.model=null;}
}
