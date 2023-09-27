import * as THREE from "./lib/three.js";
// import "./lib/perlin.js";

export class Flowfield {

    rows;
    cols;
    directions = [];

    z = 0;
    show = false;
    cleared = false;

    noiseVari = 0.1;
    noiseSpeed = 0.0001;
    force = 0.0001;
    maxSpeed = 0.01;
    angle;

    
    // For calculating the flowfield
    zoff = 0;
    noisePos = 0;
    tailNoiseOffset = 0.0;
    angle;
    visible;
    index;
    
    // For drawing the flowfield
    lines;
    startVectors = [];  // absolute start positions of each drawn line
    tempVector = new THREE.Vector3();
    lineLength = 5;
    
    seedVec = new THREE.Vector3(1, 0, 0);   // the beginning of rotation
    axisVec = new THREE.Vector3(0, 0, 1);   // the axis to rotate around i.e. in 2D
    maxSpeedVec = new THREE.Vector3(this.maxSpeed, this.maxSpeed, this.maxSpeed);

	constructor( resolution, scale, radius ) {

        noise.seed(Math.random());	// Manually seed noise with a random value to generate noise-map

        const pointsArray  = new Float32Array( this.rows * this.cols * 6 );
        const lineGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pointsArray, 3));
        const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 5 });
        this.lines    = new THREE.LineSegments(lineGeo, lineMat);
        this.linesPosAttr = this.lines.geometry.attributes.position;

        this.show = false;
        this.clear = !this.show;

        this.cols = resolution;
        this.rows = resolution;
        this.aisles = 24; // one aisle per hour of the day

        const points = this.linesPosAttr.array;
        let i = 0;

        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {

                this.directions.push( new THREE.Vector3() );

                const startVector = new THREE.Vector3(
                    (x * ( scale )) - radius,
                    (y * ( scale )) - radius,
                    0);

                this.startVectors.push(startVector);   

                points[i]     = points[i + 3] = startVector.x;
                points[i + 1] = points[i + 4] = startVector.y;
                points[i + 2] = points[i + 5] = startVector.z;

                i += 6;
            }
        }

    }			


    /**
     * Calculates and populates the flowfield array.
     * this.init flags flowfield vectors creation for drawing.
     * this.show flags when flowfield needs to be drawn.
     */
     calculate() {
        
        let i6 = 0;

        this.zoff += this.noiseSpeed;
        let yoff = 0;

        for (let y = 0; y < this.rows; y++) {

            yoff += this.noiseVari;
            let xoff = 0;

            for (let x = 0; x < this.cols; x++) {

                xoff += this.noiseVari;

                const index = x + (y * this.cols);
                const noiseValue = noise.perlin3(xoff, yoff, this.zoff);
                const angle = 2 * Math.PI * noiseValue;	// find angle in radians with perlin noise.

                this.directions[index].copy(this.seedVec).applyAxisAngle(this.axisVec, angle);		// rotate around z-axis i.e. in 2D

                this.directions[index].setLength(this.force);

            }
        }

    }

    showLines() {

        this.clear = false;

        const points = this.linesPosAttr.array;

        for (let i = 0, i6 = 0; i < this.rows * this.cols; i++, i6 += 6) {

            this.tempVector.copy(this.startVectors[i]).addScaledVector(this.directions[i], this.lineLength);

            points[i6 + 3] = this.tempVector.x;
            points[i6 + 4] = this.tempVector.y;
            points[i6 + 2] = points[i6 + 5] = this.z;

        }

        this.linesPosAttr.needsUpdate = true;

    }

    clearLines() {
        
        const points = this.linesPosAttr.array;
        
        for (let i = 0, i6 = 0; i < this.rows * this.cols; i++, i6 += 6) {
            
            points[i6 + 3] = points[i6]
            points[i6 + 4] = points[i6 + 1]
            points[i6 + 5] = points[i6 + 2]
            
        }
        
        this.linesPosAttr.needsUpdate = true;

        this.cleared = true;

    }

    setZ( cameraPositionZ, cameraFocalLength ) {
        this.z = cameraPositionZ - (cameraFocalLength * 10);	// sets flowfield to be constant distance from camera.
    }

}