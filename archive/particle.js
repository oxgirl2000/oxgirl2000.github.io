class Particle {

  constructor(posX, posY, particleSize, isPollen) {
    this.position = createVector(posX, posY);
    this.velocity = createVector(0, 0);
    this.acceleration = createVector(0, 0);
    this.size = particleSize;
    this.isPollen = isPollen;
    do {
      this.lerpPos = random(0, 1);                      // randomise interpolation position 
    } while (this.lerpPos < 0.3 && this.lerpPos > 0.7); // keep values closer to edges for more distinct colour contrast
  }
  
  flow(vectors) {
    let x = floor(this.position.x / scale);
    let y = floor(this.position.y / scale);
    let index = floor(x + y * cols);
    this.acceleration.add(vectors[index]);
  }

  // Handles the movement of the particle (do not change)
  updatePosition(wind) {
    let maxSpeed = map(wind, windRange[0], windRange[1], windMap[0], windMap[1]);
    this.velocity. limit(maxSpeed);
    this.velocity.add(this.acceleration);
    this.position.add(this.velocity);
    this.acceleration.set(0, 0);
  }

  // Reset particle position to randon postion if offscreen
  handleEdges() {
    if (mirroredEdges) {                // mode: if particle reaches edge, it reappears on the opposite side
      if (this.position.x < 0) {
        this.position.set(width, this.position.y);
      } else if (this.position.x > width) {
        this.position.set(0, this.position.y);
      } else if (this.position.y < 0) {
        this.position.set(this.position.x, height);
      } else if (this.position.y > height) {
        this.position.set(this.position.x, 0);
      }
    } else {                            // default mode: if particle reaches edge, it appears in random position
        if (this.position.x > width || this.position.x < 0 || this.position.y > height || this.position.y < 0) {
            this.position.set(random(0, width), random(0, height));
        }
    }
  }
  
  // Returns true if the mouse is influencing this particle
  avoidUser() {
    let rawMouseSpeed = dist(mouseX, mouseY, pmouseX, pmouseY);    // maps the speed of the mouse to radius particles should be repelled to
    let smoothedSpeedToRadius = map(rawMouseSpeed, mouseRange[0], mouseRange[1], mouseMap[0], mouseMap[1]);

    if (dist(this.position.x, this.position.y, mouseX, mouseY) < smoothedSpeedToRadius) {
      let mouse = createVector(mouseX, mouseY);
      mouse.sub(this.position);              // gets the position of the particle in relation to the mouse
      mouse.setMag(random(-5, -1));          // sets the strength of the avoidance (negatives numbers repel, positive numbers attract);
      this.acceleration = mouse;
      particleSizeIncreaser += 0.20;         // increases the thickness of the particle the longer the mouse is close to it
      return true;
    }
    
    if (particleSizeIncreaser > 1) {
      particleSizeIncreaser -= 0.10;
    }
    return false;
  }
  
  // Main method to generate particles
  show(particle2_5Sensor, particle10Sensor) {
    particleColor = lerpColor(colorBand[0], colorBand[1], this.lerpPos);          // interpolates between colour band
    
    if (this.avoidUser() == true) {
      particleColor = lerpColor(particleColor, avoidMouseColor, this.lerpPos);
    }
    
    if (this.isPollen == true && particle10Sensor > pollenThreshold ) {
      fill(pollenColor);
      currentSize = pollenParticleSize;
    } else {
      let pcHue = hue(particleColor);
      let pcSat = saturation(particleColor);
      let pcBri = brightness(particleColor);
      let particlePollutionMapper = constrain(map(particle2_5Sensor, pollutionRange[0], pollutionRange[1], pollutionMap[0], pollutionMap[1]), pollutionMap[0], pollutionMap[1]);
      fill(pcHue, pcSat - particlePollutionMapper, pcBri - (particlePollutionMapper * 0.8));
      currentSize = this.size;
    }
    
    //noFill();
    noStroke();
    circle(this.position.x, this.position.y, currentSize,currentSize);   // create particle shape
    //image(pg, this.position.x, this.position.y, currentSize, currentSize);
  }
}
