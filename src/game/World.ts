import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Simulation, LANES } from './Simulation';
const colors=[0x91a9b6,0xd36e38,0x385d63,0xdbb844,0x7d577d];
function box(w:number,h:number,d:number,color:number,x=0,y=0,z=0,metal=.2){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.45,metalness:metal}));mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;}
function glow(w:number,h:number,d:number,color:number,x:number,y:number,z:number){const m=box(w,h,d,color,x,y,z);(m.material as THREE.MeshStandardMaterial).emissive.set(color);(m.material as THREE.MeshStandardMaterial).emissiveIntensity=2;return m;}
function car(color:number,type=2){
 const g=new THREE.Group();const truck=type===4,suv=type===1;const width=truck?2.2:1.9;const length=truck?6:4.2;
 g.add(box(width,.55,length,color,0,.65,0,.65));g.add(box(width*.91,.32,length*.9,color,0,.97,0,.65));
 if(type===2){const shape=new THREE.Shape();shape.moveTo(-1,1.04);shape.lineTo(-.62,1.55);shape.lineTo(.55,1.55);shape.lineTo(1.1,1.04);shape.closePath();const cabin=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:1.48,bevelEnabled:true,bevelThickness:.035,bevelSize:.04,bevelSegments:1,steps:1}),new THREE.MeshStandardMaterial({color:0x172c36,metalness:.85,roughness:.16}));cabin.rotation.y=Math.PI/2;cabin.position.x=-.74;cabin.castShadow=true;g.add(cabin);}else g.add(box(width*.8,truck?1.5:suv?.8:.55,truck?3.5:1.8,truck?0xb7c1c5:0x182a32,0,truck?1.65:1.32,truck?.55:.15,.7));
 if(!truck){g.add(box(width*.76,.08,type===2?1.17:1.65,color,0,suv?1.78:type===2?1.59:1.65,.03,.8));g.add(box(width*.86,.09,.25,color,0,1.05,1.7));}
 for(const x of [-width*.49,width*.49])for(const z of [-length*.3,length*.3]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.38,.38,.22,12),new THREE.MeshStandardMaterial({color:0x0c1014,roughness:.8}));wheel.rotation.z=Math.PI/2;wheel.position.set(x,.39,z);g.add(wheel);const rim=new THREE.Mesh(new THREE.CylinderGeometry(.23,.23,.24,10),new THREE.MeshStandardMaterial({color:0x87979f,metalness:.9,roughness:.25}));rim.rotation.z=Math.PI/2;rim.position.copy(wheel.position);g.add(rim);}
 for(const x of [-width*.33,width*.33]){g.add(glow(.55,.12,.06,0xff3434,x,.88,length/2+.01));g.add(glow(.55,.13,.06,0xd4efff,x,.85,-length/2-.01));}
 if(type===3)g.add(glow(.7,.16,.4,0xffd960,0,1.8,0));
 const shadow=new THREE.Mesh(new THREE.PlaneGeometry(width*1.6,length*1.2),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.35,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.025;g.add(shadow);return g;
}
export class World {
 renderer:THREE.WebGLRenderer;scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(53,1,.1,450);private player=car(0xf2833f);private traffic:THREE.Group[]=[];private scenery:THREE.Group[]=[];private roadMarks:THREE.InstancedMesh;private ambient=new THREE.HemisphereLight(0xb6e1ed,0x17222e,2);private sun=new THREE.DirectionalLight(0xffb17d,3);private headlight:THREE.SpotLight;private brake:THREE.PointLight;private clock=0;private disposed=false;private resize:ResizeObserver;private sparks:THREE.Points;private sparkPositions=new Float32Array(120);private skyColor=new THREE.Color();private fogColor=new THREE.Color();private lastX=LANES[2];private roadTravel=0;private matrix=new THREE.Matrix4();private dusk=new THREE.Color(0x243742);private night=new THREE.Color(0x080f1f);private dust:THREE.Points;private dustPositions=new Float32Array(72);private skidPool:THREE.Mesh[]=[];private skidNext=0;private skidTime=0;
 constructor(private container:HTMLElement,private sim:Simulation){
  this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;container.appendChild(this.renderer.domElement);this.scene.fog=new THREE.FogExp2(0x13242d,.008);this.scene.add(this.ambient,this.sun);this.sun.position.set(-30,50,-70);this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);Object.assign(this.sun.shadow.camera,{left:-25,right:25,top:30,bottom:-35});
  const road=box(14,.1,500,0x263238,0,-.07,-150);const asphalt=document.createElement('canvas');asphalt.width=128;asphalt.height=128;const ctx=asphalt.getContext('2d')!;const image=ctx.createImageData(128,128);for(let i=0;i<image.data.length;i+=4){const tone=90+Math.random()*30;image.data[i]=tone;image.data[i+1]=tone;image.data[i+2]=tone;image.data[i+3]=255;}ctx.putImageData(image,0,0);const texture=new THREE.CanvasTexture(asphalt);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(4,140);(road.material as THREE.MeshStandardMaterial).map=texture;(road.material as THREE.MeshStandardMaterial).roughness=.95;this.scene.add(road);
  this.scene.add(box(700,.15,600,0x182b2e,0,-.22,-180));
  for(const x of [-7.15,7.15]){this.scene.add(box(.13,.015,500,0xd9d9c9,x,.005,-150));this.scene.add(box(.3,.25,500,0x7b8e86,x*1.08,.05,-150));this.scene.add(box(.13,.12,500,0x82949b,x*1.15,.8,-150));}
  this.roadMarks=new THREE.InstancedMesh(new THREE.BoxGeometry(.1,.02,4),new THREE.MeshStandardMaterial({color:0xd9dfd5,roughness:.8}),105);this.scene.add(this.roadMarks);
  for(let i=0;i<28;i++){
   const group=new THREE.Group();group.position.z=-i*14;
   for(const side of [-1,1]){
    const x=side*9;
    group.add(box(.12,6,.12,0x53616a,x,3,0));group.add(box(2.5,.1,.12,0x53616a,x-side*1.2,5.95,0));group.add(glow(1,.06,.4,0xc3eeef,x-side*2.2,5.87,0));
    group.add(box(.1,.85,.1,0x6b7b7e,side*8.15,.42,0));
    if(i%2===0){const trunk=box(.3,1.6,.3,0x4a3930,side*13,.8,0);group.add(trunk);for(let k=0;k<3;k++){const tree=new THREE.Mesh(new THREE.ConeGeometry(1.7-k*.35,2.8,7),new THREE.MeshStandardMaterial({color:0x254344,roughness:1}));tree.position.set(side*13,2.7+k*.7,0);group.add(tree);}}
    if(i%3===0){const h=8+(i*7%23);const building=box(6,h,7,0x263a43,side*(21+(i%3)*7),h/2,0,.3);group.add(building);for(let row=0;row<Math.floor(h/2);row++)for(let col=0;col<3;col++)group.add(glow(.7,.65,.03,(row+col+i)%3===0?0x68adbb:0xe2ae6b,building.position.x+col*1.6-1.6,2+row*1.8,3.52));}
   }
   if(i%7===0){group.add(box(.18,4,.18,0x687d82,8.5,2,0));group.add(box(2.8,1.5,.12,0x2d7b70,8.5,4.1,0));group.add(glow(1.8,.08,.14,0xa4d6bf,8.5,4.35,.02));group.add(glow(1.1,.08,.14,0xa4d6bf,8.5,3.95,.02));}
   if(i===12){group.add(box(21,.6,5,0x41565e,0,7,0));for(const x of [-10,10])group.add(box(.8,7,1,0x3e5259,x,3.5,0));}
   if(i===21){for(const x of [-9.5,9.5])group.add(box(2,9,16,0x304048,x,4.5,0));group.add(box(21,1,16,0x304048,0,9,0));group.add(glow(14,.06,.18,0x69d4ce,0,8.45,6));}
   if(i===5){group.add(box(.25,7,.25,0x596970,-14,3.5,0));group.add(box(8,3,.18,0x14262f,-14,7,0));group.add(glow(6,.16,.2,0x55c3c5,-14,7.5,.02));group.add(glow(4,.1,.2,0xc4d3d6,-14,6.6,.02));}
   // Merge repeated scenery by material to keep the render loop light.
   const batches=new Map<string,{material:THREE.Material;geometries:THREE.BufferGeometry[]}>();
   for(const child of [...group.children]){if(!(child instanceof THREE.Mesh))continue;child.updateMatrix();const m=child.material as THREE.MeshStandardMaterial;const key=[m.color.getHex(),m.emissive.getHex(),m.emissiveIntensity,m.metalness,m.roughness].join(':');let batch=batches.get(key);if(!batch){batch={material:m,geometries:[]};batches.set(key,batch);}batch.geometries.push(child.geometry.clone().applyMatrix4(child.matrix));child.geometry.dispose();if(m!==batch.material)m.dispose();group.remove(child);}
   for(const b of batches.values()){const geo=mergeGeometries(b.geometries);b.geometries.forEach(g=>g.dispose());if(geo){const mesh=new THREE.Mesh(geo,b.material);mesh.castShadow=(b.material as THREE.MeshStandardMaterial).emissiveIntensity<1;mesh.receiveShadow=true;group.add(mesh);}}
   this.scenery.push(group);this.scene.add(group);
  }
  this.scene.add(this.player);this.player.position.set(sim.x,0,0);
  const dustGeometry=new THREE.BufferGeometry();dustGeometry.setAttribute('position',new THREE.BufferAttribute(this.dustPositions,3));this.dust=new THREE.Points(dustGeometry,new THREE.PointsMaterial({color:0xd5c9b8,size:.08,transparent:true,opacity:.2,depthWrite:false}));this.scene.add(this.dust);
  const skidGeometry=new THREE.PlaneGeometry(.2,1.2);const skidMaterial=new THREE.MeshBasicMaterial({color:0x080a0b,transparent:true,opacity:.5,depthWrite:false});for(let i=0;i<80;i++){const skid=new THREE.Mesh(skidGeometry,skidMaterial);skid.rotation.x=-Math.PI/2;skid.visible=false;this.skidPool.push(skid);this.scene.add(skid);}
  const templates=colors.map((color,type)=>car(color,type));
  sim.traffic.forEach(()=>{const g=new THREE.Group();for(let type=0;type<5;type++){const m=templates[type].clone();m.visible=false;g.add(m);}g.visible=false;this.traffic.push(g);this.scene.add(g);});
  this.headlight=new THREE.SpotLight(0xc8eeff,40,60,.45,.6,1.5);this.headlight.position.set(0,1,-1);this.headlight.target.position.set(0,0,-35);this.player.add(this.headlight,this.headlight.target);
  this.brake=new THREE.PointLight(0xff2525,0,6,2);this.brake.position.set(0,.7,2.5);this.player.add(this.brake);
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(this.sparkPositions,3));this.sparks=new THREE.Points(geo,new THREE.PointsMaterial({color:0xffc46b,size:.15,transparent:true,opacity:0}));this.scene.add(this.sparks);
  this.resize=new ResizeObserver(()=>this.resizeCanvas());this.resize.observe(container);this.resizeCanvas();
 }
 private resizeCanvas(){const {width,height}=this.container.getBoundingClientRect();this.renderer.setSize(width,height);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();}
 quality(high:boolean){this.renderer.setPixelRatio(high?Math.min(devicePixelRatio,1.7):1);this.renderer.shadowMap.enabled=high;this.resizeCanvas();}
 update(dt:number){
  if(this.disposed)return;const s=this.sim;const paused=s.phase==='paused';if(paused){this.renderer.render(this.scene,this.camera);return;}this.clock+=dt;
  const menu=s.phase==='menu';const speed=menu?55:s.speed;const travel=!paused && s.phase!=='crash'?speed/3.6*dt:0;
  this.roadTravel+=travel;const mat=this.matrix;for(let i=0;i<105;i++){const lane=i%3;const row=Math.floor(i/3);const z=-((row*12-this.roadTravel)%420+420)%420+25;mat.makeTranslation(-3.5+lane*3.5,.01,z);this.roadMarks.setMatrixAt(i,mat);}this.roadMarks.instanceMatrix.needsUpdate=true;
  for(const group of this.scenery){group.position.z+=travel;if(group.position.z>30)group.position.z-=392;}
  const x=menu?1.75:s.x;const delta=x-this.lastX;this.lastX=x;
  this.player.position.set(x,.015+(!paused?Math.sin(this.clock*16)*.012*Math.min(1,speed/80):0),0);this.player.rotation.z=THREE.MathUtils.lerp(this.player.rotation.z,-delta/Math.max(dt,.001)*.035,1-Math.exp(-dt*8));this.player.rotation.y=THREE.MathUtils.lerp(this.player.rotation.y,-delta/Math.max(dt,.001)*.017,1-Math.exp(-dt*8));
  this.brake.intensity=s.braking||s.phase==='crash'?9:1.1;
  if(!paused){for(const skid of this.skidPool){if(skid.visible){skid.position.z+=travel;if(skid.position.z>35)skid.visible=false;}}this.skidTime+=dt;if(s.braking&&speed>8&&this.skidTime>.07){this.skidTime=0;for(const side of [-1,1]){const skid=this.skidPool[this.skidNext++%this.skidPool.length];skid.position.set(x+side*.78,.009,1.4);skid.visible=true;}}}
  (this.dust.material as THREE.PointsMaterial).opacity=menu||speed<10?0:Math.min(.26,speed*.002);for(let i=0;i<24;i++){const life=((this.clock*2+i/24)%1);this.dustPositions[i*3]=x+(i%2?-.9:.9)+Math.sin(i*4)*life*.4;this.dustPositions[i*3+1]=.15+life*.3;this.dustPositions[i*3+2]=1.5+life*4;}(this.dust.geometry.attributes.position as THREE.BufferAttribute).needsUpdate=true;this.headlight.intensity=25;
  s.traffic.forEach((c,i)=>{const g=this.traffic[i];g.visible=c.active;g.position.set(LANES[c.lane],0,c.z);g.children.forEach((child,j)=>child.visible=j===c.type);});
  const cycle=menu?.63:Math.min(1,s.elapsed/270);this.skyColor.set(0x66858d).lerp(this.dusk,Math.min(1,cycle*1.8)).lerp(this.night,Math.max(0,(cycle-.5)*2));this.scene.background=this.skyColor;this.fogColor.copy(this.skyColor);(this.scene.fog as THREE.FogExp2).color.copy(this.fogColor);this.ambient.intensity=2-cycle*1.2;this.sun.intensity=3-cycle*2.5;
  const shaking=s.phase==='crash'&&s.crashTime<.6?(1-s.crashTime/.6)*.18:0;
  const cameraX=menu?-5.5:x*.3;this.camera.position.set(cameraX+Math.sin(this.clock*80)*shaking,menu?5.7:6.7,menu?11.5:12.8+speed*.015);this.camera.lookAt(menu?1: x*.65,menu?.8:.5,menu?-7:-18);const fov=menu?55:50+speed*.055;if(Math.abs(this.camera.fov-fov)>.1){this.camera.fov=fov;this.camera.updateProjectionMatrix();}
  const crash=s.phase==='crash' && s.crashTime<1; (this.sparks.material as THREE.PointsMaterial).opacity=crash?1-s.crashTime:0;
  if(crash){for(let i=0;i<40;i++){const angle=i*2.399;this.sparkPositions[i*3]=s.x+Math.cos(angle)*s.crashTime*(3+i%5);this.sparkPositions[i*3+1]=.5+Math.sin(i*4)*s.crashTime*3;this.sparkPositions[i*3+2]=-1+Math.sin(angle)*s.crashTime*6;}(this.sparks.geometry.attributes.position as THREE.BufferAttribute).needsUpdate=true;}
  this.renderer.render(this.scene,this.camera);
 }
 dispose(){this.disposed=true;this.resize.disconnect();this.scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points){o.geometry.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(m=>{if(m instanceof THREE.MeshStandardMaterial)m.map?.dispose();m.dispose();});}});this.renderer.dispose();this.renderer.domElement.remove();}
}
