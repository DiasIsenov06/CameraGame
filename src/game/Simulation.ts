export type Command = 'LEFT' | 'RIGHT' | 'FIST' | 'NEUTRAL' | 'NO_HAND';
export type Phase = 'menu' | 'race' | 'tutorial' | 'paused' | 'crash';
export const LANES = [-5.25, -1.75, 1.75, 5.25];
export type TrafficCar = { active: boolean; lane: number; z: number; speed: number; type: number; color: number; passed: boolean };
export class Simulation {
  phase: Phase = 'menu'; lane = 2; x = LANES[2]; speed = 80; distance = 0; score = 0; avoided = 0; maxSpeed = 0; elapsed = 0; braking = false; crashTime = 0; lastBonus = ''; bonusTime = 0;
  traffic: TrafficCar[] = Array.from({length: 24}, () => ({ active:false,lane:0,z:0,speed:0,type:0,color:0,passed:false }));
  private spawnTimer = 2; private fromX = this.x; private laneTime = 1; private random: () => number;
  constructor(random = Math.random) { this.random = random; }
  reset(tutorial = false) { this.phase = tutorial ? 'tutorial' : 'race'; this.lane = 2; this.x = LANES[2]; this.fromX = this.x; this.laneTime = 1; this.speed = 0; this.distance = 0; this.score = 0; this.avoided = 0; this.maxSpeed = 0; this.elapsed = 0; this.braking = false; this.spawnTimer = 3; this.crashTime = 0; this.lastBonus=''; this.nearMisses=0; this.traffic.forEach(c=>c.active=false); }
  command(command: Command) {
    if (this.phase !== 'race' && this.phase !== 'tutorial') return;
    if(command === 'NO_HAND') return;
    this.braking = command === 'FIST';
    if(command === 'LEFT' || command === 'RIGHT') this.changeLane(command === 'LEFT' ? -1 : 1);
  }
  changeLane(delta: number) {
    if(this.laneTime < .38) return;
    const next = Math.max(0, Math.min(3, this.lane + delta));
    if(next !== this.lane) {this.fromX = this.x; this.lane = next; this.laneTime = 0;}
  }
  update(dt: number) {
    if(this.phase === 'paused') return;
    if(this.phase === 'crash') { this.crashTime += dt; this.speed = Math.max(0, this.speed - dt * 180); return; }
    if(this.phase === 'menu') return;
    this.elapsed += dt; this.laneTime += dt;
    const t = Math.min(1, this.laneTime / .4); const smooth = t*t*(3-2*t);
    this.x = this.fromX + (LANES[this.lane]-this.fromX)*smooth;
    const target = this.braking ? 0 : Math.min(160, 80 + Math.max(0, this.elapsed-25)*.24);
    this.speed += Math.sign(target-this.speed)*Math.min(Math.abs(target-this.speed),dt*(this.braking ? 65 : 32));
    this.maxSpeed = Math.max(this.maxSpeed,this.speed); this.distance += this.speed/3.6*dt;
    this.bonusTime = Math.max(0,this.bonusTime-dt);
    if(this.phase === 'tutorial') return;
    this.score = Math.floor(this.distance*2) + this.avoided*50 + this.nearMisses*100;
    this.spawnTimer -= dt;
    if(this.spawnTimer <= 0) { this.spawn(); this.spawnTimer = Math.max(1.8, 4.2-this.elapsed*.008); }
    for(const c of this.traffic) {
      if(!c.active) continue;
      const previous = c.z; c.z += (this.speed-c.speed)/3.6*dt;
      if(Math.abs(c.z) < 4.1 && Math.abs(this.x-LANES[c.lane]) < 1.7) {this.phase = 'crash';this.crashTime = 0;break;}
      if(previous < 4.5 && c.z >= 4.5 && !c.passed) {
        c.passed=true;this.avoided++;const near = Math.abs(this.x-LANES[c.lane]) < 3;
        if(near) this.nearMisses++;
        this.lastBonus = near ? '+100 NEAR MISS' : '+50 CLEAN OVERTAKE'; this.bonusTime = 2;
      }
      if(c.z > 35 || c.z < -260) c.active = false;
    }
  }
  nearMisses = 0;
  private spawn() {
    // Rows are separated by a reaction interval and always reserve two lanes.
    const free = Math.floor(this.random()*4); const reserved = (free+1)%4;
    const count = this.elapsed < 30 ? 1 : 2;
    const candidates = [0,1,2,3].filter(l=>l!==free && l!==reserved);
    for(let i=0;i<count;i++) {
      const car = this.traffic.find(c=>!c.active); if(!car) break;
      Object.assign(car,{active:true,lane:candidates[i],z:-130-i*14,speed:35+this.random()*25,type:Math.floor(this.random()*5),color:Math.floor(this.random()*5),passed:false});
    }
  }
}
