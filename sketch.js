
//Help Joe Jonas Parallel Park: back Joe's convertible into the gap between the van and the mail truck.
//Seen from the side. Hold BACK or GO to drive, and tap the wheel to steer in toward the curb
//(it stays turned until he reaches the curb or you tap it again). Start turning too early or
//too late and he bumps a parked car.

// ---------- Settings ----------

//Everything is laid out on a 390 x 844 phone-shaped frame, scaled to fit the window
const VW = 390, VH = 844;
const SCENE = { l: 20, r: 370, t: 125, b: 635 };
const CURB_Y = 430;      //where the sidewalk meets the street
const BACK_Y = 467;      //ground line of the parked row (further away, so drawn smaller)
const FRONT_Y = 585;     //ground line of Joe's driving lane
const BACK_S = 0.85;     //size of a car in the parked row

const CAR_LEN = 205;     //Joe's car length in the driving lane
const MAX_SPEED = 110;   //pixels per second
const ACCEL = 380, BRAKE = 520, REVERSE = 900;   //REVERSE: slowing down when you press the other pedal
const TURN_DIST = 95;    //how far Joe drives with the wheel turned to go from the lane all the way to the curb
const HIT_LANE = 0.45;   //once he is this far toward the curb he can touch the parked cars
const PARK_HOLD = 500;   //ms he has to sit still in the spot to count as parked
const GRACE = 6;         //bumpers are rounded, so a car can overlap the gap's edge this much without a bump

const SPOT_START = 255;  //gap between the parked cars on the first round
const SPOT_SHRINK = 5;   //each round the gap gets this much tighter
const SPOT_MIN = 225;
const HINT_ROUNDS = 2;   //show the TURN hint for the first rounds

//Parked cars, as long as they would be in the driving lane (they sit further back, so they look smaller)
const VAN_LEN = 140;     //behind the spot
const TRUCK_LEN = 105;   //in front of the spot
const MAD_TIME = 1200;   //ms Joe stays angry after a bump

//Where Joe's wheels go on the car image: centres as fractions of its width (x) and height (y),
//radius as a fraction of its width. Measured from the wheel arches in Exports/Joe_Happy.png.
const JOE_WHEELS = { rear: [0.2204, 0.8875], front: [0.8018, 0.8875], r: 0.0721 };

const RED = '#C8152D', YELLOW = '#F1D62E', INK = '#281F1C', GREEN = '#6EDC78';
const WHEEL_BTN = { x: 195, y: 700, r: 55 };
const MAT = 7;           //how far the torn paper sticks out past the street on each side

// ---------- State ----------

let streetImg, paperImg, paperEdge, steerImg, joeHappy, joeAngry, wheelImg, vanImg, truckImg, retryPaper, scorePaper, monoFont;
let sc = 1, ox = 0, oy = 0;            //frame scale and offset in the window
let state = 'start';                    //'start', 'play', 'parked'
let waitRelease = false;                //ignore the tap that started the round until the finger lifts
let round = 0, spotW = SPOT_START, spotL, spotR;
let joe;                                //{ x, lane, v, tilt, spin }
let steering = false;                   //the wheel is turned (tap to toggle)
let bumps = 0, startTime = 0, endTime = 0, stillSince = 0, parkedAt = 0, stars = 0;
let lastHit = 0, shakeUntil = 0, sticker = null;
let confetti = [], puffs = [];
let best = loadBest(), newBest = false;

function preload() {
  streetImg = loadImage('assets/street.webp');
  paperImg = loadImage('assets/torn-paper.webp');          //from Torn Paper Texture.png
  paperEdge = loadJSON('assets/torn-paper-edge.json');     //outline of that paper's torn edge, 0-1 across and down
  steerImg = loadImage('assets/fuzzy-wheel.webp');         //from Fuzzy Steering Wheel.png
  joeHappy = loadImage('assets/joe-car-happy.webp');
  joeAngry = loadImage('assets/joe-car-angry.webp');
  wheelImg = loadImage('assets/joe-wheel.webp');
  vanImg = loadImage('assets/van.webp');
  truckImg = loadImage('assets/mail-truck.webp');
  retryPaper = loadImage('assets/retry-paper.webp');
  scorePaper = loadImage('assets/score-paper-wide.webp');
  monoFont = loadFont('assets/GeistMono-Bold.ttf');
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(min(2, displayDensity()));
  fitFrame();
  paperEdge = Object.values(paperEdge);
  newRound();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  fitFrame();
}

function fitFrame() {
  sc = min(width / VW, height / VH);
  ox = (width - VW * sc) / 2;
  oy = (height - VH * sc) / 2;
}

function newRound() {
  spotW = max(SPOT_MIN, SPOT_START - round * SPOT_SHRINK);
  spotL = VW / 2 - spotW / 2;
  spotR = spotL + spotW;
  joe = { x: spotR - 40, lane: 0, v: 0, tilt: 0, spin: 0 };   //pulled up alongside the mail truck in front of the spot
  bumps = 0; sticker = null; confetti = []; puffs = []; stillSince = 0; steering = false; newBest = false;
}

//Best park this browser has seen (fewest bumps, then fastest); the game works fine without it
function loadBest() {
  try { return JSON.parse(localStorage.getItem('joe-park-best')) || null; } catch (e) { return null; }
}
function saveBest() {
  try { localStorage.setItem('joe-park-best', JSON.stringify(best)); } catch (e) {}
}

function buzz(pattern) {
  //Browsers refuse to vibrate before the first tap, so skip it until then
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {}
}

// ---------- Input ----------

function toFrame(px, py) { return { x: (px - ox) / sc, y: (py - oy) / sc }; }
function onWheel(p) { return dist(p.x, p.y, WHEEL_BTN.x, WHEEL_BTN.y) < WHEEL_BTN.r; }

//Which pedals are held right now (fingers, the mouse, or the keyboard). The wheel is a tap toggle,
//so one thumb can stay on BACK; on a keyboard, holding space also steers.
function held() {
  const h = { go: false, back: false, wheel: steering };
  const points = touches.length ? touches : (mouseIsPressed ? [{ x: mouseX, y: mouseY }] : []);
  for (const pt of points) {
    const p = toFrame(pt.x, pt.y);
    if (p.y < 640 || onWheel(p)) continue;
    if (p.x < WHEEL_BTN.x) h.back = true;
    else h.go = true;
  }
  if (keyIsDown(RIGHT_ARROW) || keyIsDown(68)) h.go = true;    //the cars face right, so forward is to the right
  if (keyIsDown(LEFT_ARROW) || keyIsDown(65)) h.back = true;
  if (keyIsDown(32) || keyIsDown(UP_ARROW) || keyIsDown(DOWN_ARROW)) h.wheel = true;
  if (points.length === 0 && !keyIsPressed) waitRelease = false;
  if (waitRelease) return { go: false, back: false, wheel: steering };
  return h;
}

function pressed(px, py) {
  if (state === 'start') { state = 'play'; startTime = millis(); waitRelease = true; }
  else if (state === 'parked' && millis() - parkedAt > 900) {
    round++; newRound(); state = 'play'; startTime = millis(); waitRelease = true;
  } else if (state === 'play' && px !== undefined && onWheel(toFrame(px, py))) {
    steering = !steering;
    buzz(15);
  }
}

function mousePressed() { pressed(mouseX, mouseY); }
function touchStarted() {
  const t = touches[touches.length - 1];
  if (t) pressed(t.x, t.y); else pressed();
  return false;
}
function touchEnded() { return false; }
function touchMoved() { return false; }
function keyPressed() { if (key === ' ' || key === 'Enter') pressed(); }

// ---------- Driving ----------

function update(dt) {
  const h = state === 'play' ? held() : { go: false, back: false, wheel: false };
  //GO drives right (+x), BACK drives left
  const want = (h.go ? 1 : 0) - (h.back ? 1 : 0);
  if (want !== 0) joe.v = constrain(joe.v + want * (joe.v * want < 0 ? REVERSE : ACCEL) * dt, -MAX_SPEED, MAX_SPEED);
  else joe.v = abs(joe.v) <= BRAKE * dt ? 0 : joe.v - Math.sign(joe.v) * BRAKE * dt;

  const before = joe.x;
  const dx = joe.v * dt;
  const wasIn = joe.lane > HIT_LANE;
  joe.x += dx;
  //With the wheel turned, driving swings him in toward the curb; at the curb the wheel straightens
  if (h.wheel && dx !== 0) joe.lane = min(1, joe.lane + abs(dx) / TURN_DIST);
  if (joe.lane >= 1) steering = false;
  const turning = h.wheel && dx !== 0 && joe.lane < 1;
  joe.tilt = lerp(joe.tilt, turning ? -Math.sign(dx) * 0.07 : 0, 0.2);

  const half = joeHalf();
  joe.x = constrain(joe.x, SCENE.l + half * 0.4, SCENE.r - half * 0.4);

  //Bumping the parked cars: swinging in while not lined up with the gap stops him at the cars' edge,
  //and driving into a car while already in the row stops him against it
  if (joe.lane > HIT_LANE) {
    const hitL = joe.x - half < spotL - GRACE, hitR = joe.x + half > spotR + GRACE;
    if (!wasIn && (hitL || hitR)) { joe.lane = HIT_LANE; steering = false; bump(null, hitL ? spotL : spotR, hitL); }   //he keeps rolling, just can't turn in
    else if (hitL) bump(spotL - GRACE + half, spotL, true);
    else if (hitR) bump(spotR + GRACE - half, spotR, false);
  }

  //The wheels roll exactly as far as the car moved
  joe.spin += (joe.x - before) / (JOE_WHEELS.r * CAR_LEN * joeScale());

  //Parked: all the way in, inside the gap, and stopped for a moment
  if (state === 'play') {
    const inside = joe.lane >= 0.97 && joe.x - half >= spotL - GRACE && joe.x + half <= spotR + GRACE;
    if (inside && joe.v === 0 && !h.go && !h.back) {
      if (!stillSince) stillSince = millis();
      if (millis() - stillSince > PARK_HOLD) finish();
    } else stillSince = 0;
  }
}

function bump(safeX, contactX, rearHit) {
  if (safeX !== null) { joe.x = safeX; joe.v = -joe.v * 0.3; }
  if (millis() - lastHit > 400) {
    bumps++;
    lastHit = millis();
    shakeUntil = millis() + 250;
    joe.tilt += rearHit ? 0.09 : -0.09;            //the car rocks away from the hit
    sticker = { x: contactX, y: BACK_Y - 80, at: millis() };
    for (let i = 0; i < 8; i++) {                    //paper dust puff
      const a = random(PI, TWO_PI);
      puffs.push({ x: contactX, y: lerp(FRONT_Y, BACK_Y, joe.lane) - 12, vx: cos(a) * random(20, 60), vy: sin(a) * random(15, 45),
        r: random(6, 13), at: millis() });
    }
    buzz(60);
  }
}

function finish() {
  state = 'parked';
  parkedAt = millis();
  endTime = parkedAt - startTime;
  joe.lane = 1; joe.v = 0; steering = false;
  const secs = endTime / 1000;
  stars = bumps === 0 && secs < 15 ? 3 : bumps <= 1 && secs < 25 ? 2 : 1;
  if (!best || bumps < best.bumps || (bumps === best.bumps && endTime < best.time)) {
    newBest = !!best;
    best = { time: endTime, bumps };
    saveBest();
  }
  for (let i = 0; i < 90; i++) {
    confetti.push({ x: random(SCENE.l, SCENE.r), y: random(SCENE.t - 200, SCENE.t), vy: random(60, 140),
      a: random(TWO_PI), spin: random(-4, 4), c: random([YELLOW, "#FFFFFF", "#2848A0", "#E8A088"]) });
  }
  buzz([30, 40, 30]);
}

function joeScale() { return lerp(1, BACK_S, joe.lane); }
function joeHalf() { return CAR_LEN * joeScale() / 2; }

//Would turning in right now (while backing up) swing him into the gap without touching either car?
function linedUp() {
  if (state !== 'play' || joe.lane >= HIT_LANE || joe.v > 0) return false;
  const half = CAR_LEN * lerp(1, BACK_S, HIT_LANE) / 2;
  const x = joe.x - (HIT_LANE - joe.lane) * TURN_DIST;
  return x - half >= spotL && x + half <= spotR;
}

function clock(ms) {
  const secs = floor(ms / 1000);
  return `${floor(secs / 60)}:${nf(secs % 60, 2)}`;
}

// ---------- Drawing ----------

function draw() {
  update(min(deltaTime, 50) / 1000);
  background(RED);
  push();
  translate(ox, oy);
  scale(sc);
  if (millis() < shakeUntil) translate(random(-3, 3), random(-2, 2));

  drawScene();
  drawHeadline();
  drawControls();
  drawScore();
  if (state === 'start') drawPanel(300, ['TAP TO PLAY']);
  if (state === 'parked') drawParked();
  pop();
}

//The street is printed on the torn paper: the paper sits behind, a little bigger, and the street is
//trimmed to the same torn outline so a rim of real paper edge shows all round.
function drawScene() {
  const ctx = drawingContext;
  const pw = SCENE.r - SCENE.l + MAT * 2, ph = SCENE.b - SCENE.t + MAT * 2;
  push();
  ctx.shadowColor = 'rgba(40,31,28,0.35)'; ctx.shadowBlur = 14; ctx.shadowOffsetX = -4; ctx.shadowOffsetY = 6;
  image(paperImg, SCENE.l - MAT, SCENE.t - MAT, pw, ph);
  pop();

  ctx.save();
  noStroke();
  beginShape();
  for (const [u, v] of paperEdge) vertex(lerp(SCENE.l, SCENE.r, u), lerp(SCENE.t, SCENE.b, v));
  endShape(CLOSE);
  ctx.clip();

  image(streetImg, SCENE.l, SCENE.t, SCENE.r - SCENE.l, SCENE.b - SCENE.t);   //cut-paper street, from street_bg.py
  drawSpot();
  drawVehicle(vanImg, spotL - VAN_LEN * BACK_S / 2, BACK_Y, VAN_LEN * BACK_S);
  drawVehicle(truckImg, spotR + TRUCK_LEN * BACK_S / 2, BACK_Y, TRUCK_LEN * BACK_S);
  drawJoe();
  drawPuffs();
  drawSticker();
  drawConfetti();
  ctx.restore();
}

//Dashed outline on the ground: yellow while you are parking, filling green while he holds still in
//it, solid green once he has made it.
function drawSpot() {
  const ok = state === 'parked';
  const fillIn = ok ? 1 : stillSince ? min(1, (millis() - stillSince) / PARK_HOLD) : 0;
  const corners = [spotL + 4, CURB_Y + 14, spotR - 4, CURB_Y + 14, spotR - 8, BACK_Y + 10, spotL, BACK_Y + 10];
  if (fillIn > 0) { noStroke(); fill(110, 220, 120, 130 * fillIn); quad(...corners); }
  stroke(ok || fillIn > 0 ? GREEN : YELLOW); strokeWeight(3.5); noFill();
  drawingContext.setLineDash([9, 7]);
  quad(...corners);
  drawingContext.setLineDash([]);
  noStroke();
}

//Joe's car: happy while driving, angry for a moment after a bump, hopping for joy once parked
function drawJoe() {
  const img = state === 'play' && millis() - lastHit < MAD_TIME ? joeAngry : joeHappy;
  let ground = lerp(FRONT_Y, BACK_Y, joe.lane);
  if (state === 'parked') {
    const t = (millis() - parkedAt) / 1000;
    if (t < 1.4) ground -= abs(sin(t * PI * 3)) * 9 * (1 - t / 1.4);
  }
  drawJoeCar(img, joe.x, ground, CAR_LEN * joeScale(), joe.tilt, joe.spin);
}

//Joe's car centred on x, wheels on the ground line: shadow, then the wheels, then the body over them
function drawJoeCar(img, x, ground, len, tilt, spin) {
  const h = len * img.height / img.width;
  push();
  translate(x, ground);
  noStroke(); fill(40, 31, 28, 80); ellipse(0, 0, len * 0.95, len * 0.07);
  rotate(tilt);
  const top = -h + 1, d = JOE_WHEELS.r * len * 2;
  imageMode(CENTER);
  for (const [fx, fy] of [JOE_WHEELS.rear, JOE_WHEELS.front]) {
    push(); translate(-len / 2 + fx * len, top + fy * h); rotate(spin); image(wheelImg, 0, 0, d, d); pop();
  }
  imageMode(CORNER);
  image(img, -len / 2, top, len, h);
  pop();
}

//A parked cut-out vehicle centred on x with its wheels on the ground line, plus a soft shadow
function drawVehicle(img, x, ground, len) {
  const h = len * img.height / img.width;
  push();
  translate(x, ground);
  noStroke(); fill(40, 31, 28, 80); ellipse(0, 0, len * 0.95, len * 0.07);
  image(img, -len / 2, -h + 1, len, h);
  pop();
}

const STAR = [[0, -60], [16, -18], [60, -16], [24, 10], [38, 54], [0, 28], [-38, 54], [-24, 10], [-60, -16], [-16, -18]];
function drawStar(x, y, s, fillCol) {
  push(); translate(x, y); scale(s);
  fill(fillCol); stroke(INK); strokeWeight(3 / s * 0.6);
  beginShape(); for (const p of STAR) vertex(p[0], p[1]); endShape(CLOSE);
  pop();
}

//BUMP sticker where Joe touched a parked car; it pops in and fades
function drawSticker() {
  if (!sticker) return;
  const t = (millis() - sticker.at) / 900;
  if (t > 1) { sticker = null; return; }
  const grow = t < 0.15 ? 0.3 + 0.7 * t / 0.15 : 1;
  push();
  drawingContext.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1;
  drawStar(sticker.x, sticker.y, 0.6 * grow, YELLOW);
  styledText('BUMP', sticker.x, sticker.y + 2, 15 * grow, '#FFFFFF', 2);
  pop();
}

//Little paper circles that puff out of a bump and fade
function drawPuffs() {
  const dt = min(deltaTime, 50) / 1000;
  puffs = puffs.filter(p => millis() - p.at < 600);
  for (const p of puffs) {
    const t = (millis() - p.at) / 600;
    p.x += p.vx * dt; p.y += p.vy * dt;
    push();
    drawingContext.globalAlpha = 1 - t;
    fill('#F5F0E6'); stroke(INK); strokeWeight(1.2);
    circle(p.x, p.y, p.r * (1 + t));
    pop();
  }
  noStroke();
}

function drawConfetti() {
  const dt = min(deltaTime, 50) / 1000;
  noStroke();
  for (const c of confetti) {
    c.y += c.vy * dt; c.a += c.spin * dt;
    push(); translate(c.x + sin(c.a) * 6, c.y); rotate(c.a); fill(c.c); rect(-6, -3, 12, 6); pop();
  }
}

// ---------- UI ----------

//Yellow headline text with a dark outline and a 3D shadow falling down-left
function styledText(str, x, y, size, fillCol = YELLOW, depth = size * 0.1) {
  textFont('KCBubbleShack'); textSize(size); textAlign(CENTER, CENTER);
  stroke(INK); strokeWeight(size * 0.12); strokeJoin(ROUND); fill(INK);
  for (let i = depth; i > 0; i -= 0.5) text(str, x - i, y + i);
  fill(fillCol); text(str, x, y);
  noStroke();
}

function drawHeadline() {
  styledText('HELP JOE JONAS', VW / 2, 48, 32);
  styledText('PARALLEL PARK', VW / 2, 88, 32);
}

function drawPanel(y, lines, h = 130) {
  image(retryPaper, VW / 2 - 155, y - h / 2, 310, h);
  lines.forEach((l, i) => styledText(l, VW / 2, y + (i - (lines.length - 1) / 2) * 40, 32));
}

function drawParked() {
  const title = stars === 3 ? 'PERFECT PARK' : stars === 2 ? 'NICE PARK' : 'PARKED';
  image(retryPaper, VW / 2 - 155, 185, 310, 160);
  styledText(title, VW / 2, 222, 30);
  for (let i = 0; i < 3; i++) drawStar(VW / 2 - 45 + i * 45, 260, 0.3, i < stars ? YELLOW : '#E6E0D2');
  fill(INK); textFont(monoFont); textSize(11); textAlign(CENTER, CENTER);
  if (best) text(`${newBest ? 'NEW BEST' : 'BEST'}  ${clock(best.time)}  ${best.bumps} BUMP${best.bumps === 1 ? '' : 'S'}`, VW / 2, 291);
  if (millis() - parkedAt > 900) styledText('TAP TO PARK AGAIN', VW / 2, 318, 15, '#FFFFFF', 1.5);
}

function drawControls() {
  const h = state === 'play' ? held() : { go: false, back: false, wheel: false };
  drawPedal(75, 700, 'BACK', YELLOW, h.back);
  drawPedal(315, 700, 'GO', '#58AA5C', h.go);

  //Steering wheel: turned and lit up while steering; pulses when it is the moment to turn
  const hint = round < HINT_ROUNDS && linedUp() && !h.wheel;
  const pulse = hint ? 1 + 0.08 * sin(millis() / 90) : 1;
  push();
  translate(WHEEL_BTN.x, WHEEL_BTN.y + (h.wheel ? 3 : 0));
  scale(pulse);
  noStroke();
  if (h.wheel || hint) { fill(h.wheel ? GREEN : YELLOW); stroke(INK); strokeWeight(3); circle(0, 0, 112); noStroke(); }
  else { fill(40, 31, 28, 70); circle(4, 5, 100); }
  rotate(h.wheel ? -0.7 : 0);
  imageMode(CENTER); image(steerImg, 0, 0, 104, 104); imageMode(CORNER);
  pop();
  noStroke();
  if (hint) styledText('TURN', WHEEL_BTN.x, 645, 18);
}

function drawPedal(x, y, label, col, down) {
  const dy = down ? 3 : 0;
  noStroke(); fill(40, 31, 28, 90); rect(x - 46 + 4, y - 30 + 5, 92, 60, 12);
  fill(down ? lerpColor(color(col), color(0), 0.2) : col); stroke(INK); strokeWeight(3);
  rect(x - 46 + (down ? 2 : 0), y - 30 + dy, 92, 60, 12);
  noStroke(); fill(INK); textFont('KCBubbleShack'); textSize(22); textAlign(CENTER, CENTER);
  text(label, x + (down ? 2 : 0), y + dy);
}

function drawScore() {
  image(scorePaper, VW / 2 - 95, 765, 190, 190 * scorePaper.height / scorePaper.width);
  const t = state === 'play' ? millis() - startTime : state === 'parked' ? endTime : 0;
  fill(INK); textFont(monoFont); textSize(12); textAlign(CENTER, CENTER);
  text(`BUMPS ${bumps}    ${clock(t)}`, VW / 2, 803);
}
