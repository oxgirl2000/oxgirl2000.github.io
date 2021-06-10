// SETTINGS --------------------
const useSlider = true;          // mode: use MQTT sliders for control
const showFlowField = false;     // mode: show flow field visualization
const mirroredEdges = false;     // mode: if particle reaches edge, it reappears on the opposit side
const calibrateTest = true;      // mode: calibrates frame rate for calibLength time at start of sketch
const adjustTest = true;         // mode: adjusts particle by adjustStep amount every second
const frameRateLog = true;       // mode: logs frame rate every second.

const initParticleCount = 200;  // Particle count if !calibrateTest - mouse movement responsive up to 500
const minParticleCount  = 20;

const probSml = 0.6;
const probMed = 0.3;             
const probLrg = 0.3;              // (0-1) probabilities for particle type
const probPollen = 0.25;

const smallParticleSize = 1;
const mediumParticleSize = 2;
const largeParticleSize = 3;
const pollenParticleSize = 4;

const calibLength = 4000;

const adjustInterval = 1000;
const adjustStep = 10;

const flowfieldNoiseSpeed = 0.0005;   // (~0.0005) increase value to increase the speed of change in the flowfield noise
const pollenThreshold = 2;            // Threshold for displaying large pollen dots

const aspectRatio = 16 / 9;

// RANGE & MAP --------------------
const frameRateRange = [30, 40];

const tempRange = [15 , 30];     // high and low range temp (16 degrees vs daytime 20 degrees) selects which color the particles are (from spreadsheet).
const tempMap = [10, 30];

const windRange = [50, 110];     // change this to intensify the response to wind
const windMap = [0.05, 2];

const windScaleRange = [5, 180]; // Used to create the flow field
const windScaleMap = [100, 5];

const lightRange = [0, 1024];     // this changes when the colour changes - change the 150 if you want it to change at lower ranges (change 150 to 20 if using Poetryai)

const pollutionRange = [0, 50];
const pollutionMap = [0, 50];    // Change first two numbers according to insitu environmental conditions

const tailMap = [4, 6];          // How long the particle tails are (0-100) 100 = not tail - 0= long tail

const mouseRange = [1, 40];
const mouseMap = [5, 60];


// MQTT --------------------
const server = "wss://foresta-projects:ADOh7ArkqjIE27zR@foresta-projects.cloud.shiftr.io";
const client = mqtt.connect(server, {
  clientId: 'foresta-faadhi2'
});


// COLOR CODES --------------------
const colorRanges = [   // this changes the colour palette
  0,
  80,
  400,
  700,
  900
];
const colorPaletteCode = [
  ['#0718fa', '#00ecbc'],
  ['#f43b47', '#a92cbf'],
  ['#f9d423', '#f74a05'],
  ['#2be324', '#f5c000'],
  ['#93e909', '#fafef2'],
];
const avoidMouseColorCode = '#f093fb';
const pollenColorCode = '#e3cd07';
const backgroundColorCode = [264, 100, 12]; // '0C001F';


// Variables ++++++++++++++++++++++++++++++

// COLOR --------------------
let avoidMouseColor;
let pollenColor;
let backgroundColor;
let colorPalette = [];

let scale = 50; // change this for density of flowfield
let cols;
let rows;
let inc = 0.07;
let yoff = 0;
let xoff = 0;
let zoff = 0;

// CURRENT SENSOR --------------------
let windSensor = 50;
let particle2_5Sensor = 0;
let particle10Sensor = 0;
let lightSensor = 800;
let tempSensor = 20;

// DECLARATIONS --------------------
let particles = []; // Array of Particle objects.
let flowField = []; // Array of flowfield vectors.

let canvas;
let targetWidth;
let targetHeight;
let fs;
let table;          // csv table
let tailNoiseOffset = 0.0;
let paletteIndex;
let bgHue;
let bgSat;
let bgBri;
let alpha;
let index;
let angle;
let v;
let colorBand = [];
let tempLerpPos; 
let colorPos;
let count = 0;
let totalParticleCount = 0;
let frTest;
let frArray = [];
let frAvg = 0;
let timer = 0;
let logTimer = 0;
let fsButtonSize;
//let pg;

// Declarations for Particle class --------------------
let particleSizeIncreaser = 1;
let particleColor;
let currentSize;


// Functions ++++++++++++++++++++++++++++++

function setup() {
  checkOrientation();
  canvas = createCanvas(targetWidth, targetHeight);
  canvas.parent('p5');
  
  renderColors();
  background(backgroundColor);
  bgHue = hue(backgroundColor);
  bgSat = saturation(backgroundColor);
  bgBri = brightness(backgroundColor);
  textSize(32);

  client.on('connect', function() {
  console.log('connected!');
  client.subscribe('#');
  });
  
  client.on('message', function(topic, message) {
    //console.log(topic + ': ' + message.toString());    // uncomment to receive messages in console.
    messageReceived(topic, message);
  });
  
  //pg = createGraphics(10, 10);
  //pg.background(0, 0, 0, 0);
  //pg.noStroke();
  //pg.ellipse(pg.width / 2, pg.height / 2, 10, 10);
  
  cols = ceil(width / scale);
  rows = ceil(height / scale);
  
  fsButtonSize = width / 20;
  
  calibTestCheck = calibrateTest;
  
  if (!calibTestCheck) {
    addParticles(initParticleCount);
    console.log("Particles In Sketch: ", particles.length);
  }
}

function draw() {
  
  // TAILS
  blendMode(BLEND);                              // if tails doesn't work properly comment/uncomment this line to manually set dault blendMode BLEND
  tailNoiseOffset += 0.01;
  alpha = map(noise(tailNoiseOffset), 0, 1, tailMap[0], tailMap[1]);
  fill(bgHue, bgSat, bgBri, 0.2);
  rect(0, 0, width, height);
  
  fs = fullscreen();
  if (fs) {
    resizeCanvas(windowWidth, windowHeight);
  }
  
  if (calibTestCheck) {
    if (millis() < calibLength) {                // run frame rate tests for length of time in ms
      frAvg = findNewAvg(10);
      //if (frAvg < frameRateRange[0]) {              
      //  totalParticleCount -= adjustStep;      // adjusts particle count depending on frame rate
      //} else if (frAvg > frameRateRange[1]) {
      //  totalParticleCount += adjustStep;
      //}
      if (frAvg < frameRateRange[0]) { 
        removeParticles(adjustStep);
      } else if (frAvg > frameRateRange[1 ]) {
        addParticles(adjustStep);
      }
    } else {
      console.log('Particles in sketch :', totalParticleCount);
      calibTestCheck = false;
    }
    drawCalibBanner();
  }
  
  if (adjustTest && !calibTestCheck) {
    if (millis() >= timer + adjustInterval) {     // run frame rate tests for length of time in ms
      //frAvg = round(frameRate());
      frAvg = findNewAvg(3);
      if (frAvg < frameRateRange[0]) { 
        removeParticles(adjustStep);
        if (frameRateLog) {
          console.log('10 particles removed! Total = ', totalParticleCount);
        }
      } else if (frAvg > frameRateRange[1 ]) {
        addParticles(adjustStep);
        if (frameRateLog) {
          console.log('10 particles added! Total = ', totalParticleCount);
        }
      }
      timer = millis();  
    }
  }
  
  if (frameRateLog) {
    if (millis() >= logTimer+1000) {             // log frame rate every second
      console.log('Frame rate: ' + round(frameRate()));
      logTimer = millis();
    }
  }
  
  //// FLOWFIELD
  yoff = 0;
  for (let y = 0; y < rows; y++) {
    xoff = 0;
    for (let x = 0; x < cols; x++) {
      index = x + y * cols;
      angle = noise(xoff, yoff, zoff) * TWO_PI * 2;    // calculate a random angle based off the 3D noise
      v = p5.Vector.fromAngle(angle);                  // set flowfield vector to angle calculated above

      v.setMag(map(scale, 100, 1, 0.05, 0.12));        // set how strictly the particle will follow the direction of the flowfield 
                                                       // higher value, stricter follow || higher scale, less strict
      
      flowField[index] = v;                            // add the calculated vector to the flowfield 
      xoff += inc;                                     // slightly change 1 dimension of noise

      if (showFlowField) {                             // flowfield visualisation
        push();               
        translate(x * scale, y * scale);
        stroke(255);
        rotate(angle);
        line(0, 0, scale, 0);
        pop();
      }
    }
    yoff += inc;
    zoff += flowfieldNoiseSpeed;                       // increase value to increase the speed of change in the flowfield noise
  }

  //// PARTICLES
  for (let p of particles) {
    p.flow(flowField);                                 // applies acceleration to the particle
    p.updatePosition(windSensor);                      // position of particle and sets acceleration back to zero.
    p.handleEdges();                                   // handles particles that leave the screen
    p.show(particle2_5Sensor, particle10Sensor);
  }
  
  if (!calibTestCheck) {
    drawFSButton();
  }
}

/**
  Checks for portrait (mobile) or landscape (desktop) orientation.
 */
function checkOrientation() {
  if (windowWidth >= windowHeight) {
    targetWidth = windowWidth/2;
  } else {
    targetWidth = windowWidth;
  }
  targetHeight = targetWidth / aspectRatio;
  //targetHeight = windowHeight;
}

/**
  Runs when window is resized. Redraws particles.
 */
function windowResized() {
  let currentCount = totalParticleCount;
  
  checkOrientation();
  resizeCanvas(targetWidth, targetHeight);
  removeParticles(currentCount);
  addParticles(currentCount);
}

/**
  Toggles fullscreen mode when mouse is pressed on fullscreen button.
 */
function mousePressed() {
  if (mouseX > 10 && mouseX < 10 + fsButtonSize && mouseY > height - (10 + fsButtonSize) && mouseY < height) {
    fullscreen(!fs);
  }
}

/**
  Load colors into codes since color() can only be called inside setup() or draw().
 */
function renderColors(){
  colorMode(HSB, 360, 100, 100);
  avoidMouseColor = color(avoidMouseColorCode);
  pollenColor = color(pollenColorCode);
  backgroundColor = color(backgroundColorCode[0], backgroundColorCode[1], backgroundColorCode[2]);
  
  for (i=0; i<colorPaletteCode.length; i++) {
    colorPalette.push([color(colorPaletteCode[i][0]), color(colorPaletteCode[i][1])]);
  }
  
  renderColorBand();
}

/**
  Interpolates between color ranges/palette indices to blend between one palette and another.
 */
function renderColorBand() {
  //let light = map(lightSensor, lightRange[0], lightRange[1], 
  for (let i=0;i<(colorRanges.length-1);i++) {
    if (lightSensor >= colorRanges[i] && lightSensor < colorRanges[i+1]) {
      paletteIndex = i;
      break;
    }
  }
  tempLerpPos = constrain(map(lightSensor, colorRanges[paletteIndex], colorRanges[paletteIndex+1], 0.0, 1.0), 0.0, 1.0);
  
  colorBand[0] = lerpColor(colorPalette[paletteIndex][0], colorPalette[paletteIndex+1][0], tempLerpPos);
  colorBand[1] = lerpColor(colorPalette[paletteIndex][1], colorPalette[paletteIndex+1][1], tempLerpPos);
  
}

/**
  Updates the framerate array and finds the average framerate.
  
  @param {number} avgLength - the amount frames to average.
 */
function findNewAvg (avgLength) {
  let avg = 0;
  while (frArray.length >= avgLength) { 
    frArray.shift();
  }
  frArray.push(round(frameRate()));
  for (let fr of frArray) {
    avg += fr;
  }
  avg = avg / frArray.length; 
  return avg;
}

/**
  Add particles of three sizes randomly according to set probabilities. 
  
  @param {number} count - The amount of particles to add.
 */
function addParticles(count) {
  totalParticleCount += count; 
  while (count > 0) {
    let r = random(0, 1); 
    let temp = random(15, 30);
    if (r < probSml) {
      particles.push(new Particle(random(width), random(height), smallParticleSize, false)); 
      count--;
    }
    if (r < probMed) {
      particles.push(new Particle(random(width), random(height), mediumParticleSize, false)); 
      count--;
    }
    if (r < probLrg) {
      particles.push(new Particle(random(width), random(height), largeParticleSize, false));  
      count--;
    }
    if (r < probPollen) {
      particles.push(new Particle(random(width), random(height), largeParticleSize, true));
      count--;  
    }
  }
}

/**
  Removes particles of count amount if totalParticleCount is more than the minimum.  
  
  @param {number} count - The amount of particles to remove.
 */
function removeParticles(count) {
  totalParticleCount -= count;
  if (totalParticleCount < minParticleCount) {
    while (count > 0) {
      particles.pop();
      count--;
    }
  } else {
    totalParticleCount += count;
  }
}

/**
  Draws the banner during calibration tests.
 */
function drawCalibBanner() {
   fill(backgroundColor);
   rect(0, height-40, width, 40);
   fill(255);
   textSize(12);
   text('calibrating... particles = ' + totalParticleCount, 10, height-10);
}

/**
  Draws the button to toggle fullscreen mode.
 */
function drawFSButton() {
  fill(colorBand[0]);
  let s = fsButtonSize;
  rect(10, height - (s + 10), s, s, s/5, s/5, s/5, s/5);
}

/**
  Runs when a message is received from MQTT server.
  
  @param {string} topic
  @param {number} payload
 */
function messageReceived(topic, payload) {
  
  if (useSlider) {                // takes slider data instead of normal
      if (topic == 'WetSoil') {
      } else if (topic == 'Light-slider' || topic == 'Lux') {
        lightSensor = payload;
        renderColorBand();
      } else if (topic == 'AirTemp-slider' || topic == 'Temp-degree') {
        tempSensor = payload;
        bgBri = map(tempSensor, tempRange[0], tempRange[1], tempMap[0], tempMap[1]);
        backgroundColor = color(bgHue, bgSat, bgBri);
      } else if (topic == 'Wind-slider') {
        windSensor = payload;
      } else if (topic == 'Particles2_5-slider') {
        particle2_5Sensor = payload;
      } else if (topic == 'Particles10-slider') {
        particle10Sensor = payload;
      }
  } else {
      if (topic == 'WetSoil') {
        //println("WetSoil", int(new String(payload)));
      } else if (topic == 'Light' || topic == 'Lux') {
        lightSensor = payload;
        renderColorBand();
      } else if (topic == 'AirTemp' || topic == 'Temp-degree') {  
        tempSensor = payload;
        bgBri = map(tempSensor, tempRange[0], tempRange[1], tempMap[0], tempMap[1]);
        backgroundColor = color(bgHue, bgSat, bgBri);
      } else if (topic == 'Wind') {
        windSensor = payload;
      } else if (topic == 'Particles2.5') {
        particle2_5Sensor = payload;
      } else if (topic == 'Particles10') {
        particle10Sensor = payload;
      }
  }
}    
