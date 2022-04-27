import * as THREE from './lib/three.js';
import * as CONST from './constants.js';
import {vertexShader, fragmentShader} from './shaders.js';

import { norm, map, clamp, randomFloat } from './lib/helpers.js';

import { Particle, Pollen } from './particle.js';

class ParticleSystem {

    particles = []; 
    obj;
    pos;
    color;
    size;
 
    // Fills palettes with THREE.color objects based on codes.
    colorPalette = [];
    tempColors = [];

    constructor( scene, amount, amountPollen, aisles, radius ) {

        this.amount = amount;
        this.amountPerSize = amount / CONST.particulateSizes.length;
        this.aisles = aisles;
        this.radius = radius;

        this.colorPalette = CONST.colorCodes.map((element) => [new THREE.Color(element[0]), new THREE.Color(element[1])]);
        // initialise THREE.Color objects in two-dimensional array of aisles length
        this.tempColors = [...Array(aisles)].map(() => [new THREE.Color(), new THREE.Color()]);
        
        this.brightness = 0.5;

        this.textures = {
            soft: new THREE.TextureLoader().load( './textures/texture32.png' ),
            hard: new THREE.TextureLoader().load( './textures/circle.png' )
        }

        this.textureMap = ''; // leave empty; placeholder used in GUI

        // for ( let pSize of CONST.particulateSizes.length ) 
        
        // Initialise arrays for buffer attributes.
        const posArr = new Float32Array( amount * 3 );      // positions
        const colArr = new Float32Array( amount * 3 );      // colors
        const sizArr = new Float32Array( amount );          // sizes  
        
        // const pollenStep = Math.floor( amount / amountPollen );
        
        for (let i = 0, i3 = 0; i < amount; i++, i3 += 3) {
            
            // let isPollen = i % pollenStep == 0;
            // if (isPollen) {
            //     this.particles[i] = new Pollen( aisles, radius );
            // } else {
                this.particles[i] = new Particle( aisles, radius );
            // }
            
            //
            
            posArr[i3]     = this.particles[i].pos.x   // x
            posArr[i3 + 1] = this.particles[i].pos.y   // y
            posArr[i3 + 2] = 0;			  	           // z	
            
            colArr[i] = this.particles[i].color;

            sizArr[i] = this.particles[i].size;
            
        }

        const geometry = new THREE.BufferGeometry();
        
        geometry.setAttribute('position', 	new THREE.BufferAttribute(posArr, 3));
        geometry.setAttribute('color', 		new THREE.BufferAttribute(colArr, 3));
        geometry.setAttribute('size', 		new THREE.BufferAttribute(sizArr, 1));
    
        const material = new THREE.ShaderMaterial({
    
            uniforms: {
                'pointTexture': { value: this.textures.soft }
            },
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            blending: THREE.AdditiveBlending,
            depthTest: true,
            transparent: true,			
            vertexColors: true
    
        });

        // PointsMaterial
        // const material = new THREE.PointsMaterial({
    
        //     map: this.textures.soft,
        //     size: 1,
        //     // color: new THREE.Color( 'hsl( 70, 80%, 10% )' ),
        //     blending: THREE.AdditiveBlending,
        //     depthTest: false,
        //     transparent: true,			
        //     vertexColors: true
        // });
    
        this.obj = new THREE.Points(geometry, material);

        this.pos    = this.obj.geometry.attributes.position;
        this.color  = this.obj.geometry.attributes.color;
        this.size   = this.obj.geometry.attributes.size;

        this.distanceVec = new THREE.Vector3();
        this.originVec   = new THREE.Vector3();

        scene.add( this.obj );

    }

    /**
     * Calculates the movements of the particles. TODO: Move a portion of this into the Particle class.
     */
    simulate( hourMemory, shape, flowfield, scale ) {

        const windSpeeds = [];

        for (let hour of hourMemory)
            windSpeeds.push( map(
                hour.wind,
                CONST.range.wind[0],
                CONST.range.wind[1],
                CONST.range.maxSpeed[0],
                CONST.range.maxSpeed[1]));

            // console.log( 'windpspeed length: ', windSpeeds.length);

        for (let i = 0, i3 = 0; i < this.amount; i++, i3 += 3) {

            // Get absolute position of current particle
            let posX = Math.floor(( this.particles[i].pos.x + shape.radius) / scale);
            let posY = Math.floor(( this.particles[i].pos.y + shape.radius) / scale);
           
            // Find the index of the flowfield quadrant that the particle is a part of.
            let index = Math.floor(posX + posY * flowfield.cols);
            index = clamp(index, 0, (flowfield.rows * flowfield.cols) - 1);

            // Adds the flowfield direction unit vector.
            this.particles[i].acc.copy(flowfield.directions[index]);
            this.particles[i].vel.add(this.particles[i].acc);

            // Clamps the velocity to the maxSpeed.
            if ( windSpeeds[ this.particles[ i ].aisleIndex ] ) {
                this.particles[ i ].vel.clampLength(0, windSpeeds[ this.particles[ i ].aisleIndex ]);
            } else {
                this.particles[i].vel.clampLength(0, flowfield.maxSpeed);
            }
            
            // Adds one unit of new velocity to position.
            this.particles[i].pos.add(this.particles[i].vel);

            this._handleEdges(this.particles[i].pos, this.particles[i].vel, i, shape);

            // Tune the inner circles to be gradually smaller from 0 to widest circle at shape.radius
            const radiusRatio = norm(shape.radii[this.particles[i].aisleIndex], 0, shape.radius);
            this.particles[i].pos.multiplyScalar( radiusRatio );

            // Apply new position to pos array.
            this.pos.array[i3]     = this.particles[i].pos.x;
            this.pos.array[i3 + 1] = this.particles[i].pos.y;
            this.pos.array[i3 + 2] = (flowfield.aisles - this.particles[i].aisleIndex) * shape.aisleSeparation;

            // Reset radiusRatio to original pos for easy calculations later.
            this.particles[i].pos.divideScalar( radiusRatio );            

        }

        this.pos.needsUpdate = true;
    }

    /**
     * Detects when a particle's position is beyond the radius and handles behaviour with different options for cases.
     * 
     * @param {number} pos The position of the particle.
     * @param {number} vel The acceleration of the particle.
     * @param {number} j   The index of the particle.
     */
    _handleEdges(pos, vel, j, shape) {

        // const inner = shape.innerRingSize * ( particleSystem.particles[ j ].aisleIndex / flowfield.aisles );
        // const outer = shape.outerRingSize * ( particleSystem.particles[ j ].aisleIndex / flowfield.aisles );

        const inner = shape.innerRingSize;
        const outer = shape.outerRingSize;
        // const radius = shape.radii[ particleSystem.particles[ j ].aisleIndex];
        const radius = shape.radius

        this.distanceVec.set(pos.x, pos.y, 0);
        const dist = this.distanceVec.distanceTo(this.originVec);

        if ( dist > (radius) || dist < (radius * inner)) {
            // if ( distanceVec.distanceTo( originVec ) > ( shape.radius * norm( particleSystem.particles[ j ].aisleIndex, 0, flowfield.aisles ) ) ) {

            let x, y;
            let rand, r, theta;

            switch (shape.edgeMode) {

                case 1: //random in circle

                    rand = 1 - (Math.random() * outer);
                    r = radius * Math.sqrt(rand);
                    theta = Math.random() * 2 * Math.PI;
                    x = r * Math.sin(theta);
                    y = r * Math.cos(theta);
                    break;

                case 2:  // random in square
                    rand = Math.random() * outer; // * norm(noise.perlin3(0, 0, flowfield.zoff), -1, 1)
                    r = radius * Math.sqrt(rand);
                    theta = Math.random() * 2 * Math.PI;
                    x = r * Math.sin(theta);
                    y = r * Math.cos(theta);
                    break;

                case 3:

                    rand = Math.random() * outer;	// what does this line do? or norm(noise.perlin3(0, 0, flowfield.zoff * 50) ^ 2, -1, 1)
                    r = radius * Math.sqrt(rand);
                    theta = Math.random() * 2 * Math.PI;
                    x = r * Math.sin(theta);
                    y = r * Math.cos(theta);
                    break;

                case 4:
                    x = 0; // x
                    y = 0; // y
                    break;

                case 5:
                    theta = 360 * Math.random();
                    const innerSq = Math.pow( ( inner * radius ), 2);
                    const outerSq = Math.pow( ( outer * radius ), 2);
                    const dist = Math.sqrt( Math.random() * ( innerSq - outerSq ) + outerSq );
                    x =  dist * Math.cos(theta);
                    y =  dist * Math.sin(theta);
                    break;

            }

            // x = ( inner + ( x / radius ) * ( outer - inner ) ) * radius;
            // y = ( inner + ( y / radius ) * ( outer - inner ) ) * radius;

            pos.setX(x);
            pos.setY(y);
            vel.set(0, 0, 0);
        }

    }

    /**
     * Updates the palette of particle colors based on live light sensor values or from hourMemory of the particle's corresponding aisle.
     * 
     * @param {number} val 
     */
     updateColor(val, hourMemory) {

        for (let i = 0; i < this.aisles; i++) {

            if (i > 0) val = hourMemory[i].light;		// only aisle 0 has live values.

            let paletteIndex = CONST.colorRanges.findIndex((e, i, a) => e <= val && val < a[i + 1]);	// find the bounds that the val is higher than (inclusive) and lower than (exclusive)
            const hueIndex = norm(val, CONST.colorRanges[paletteIndex], CONST.colorRanges[paletteIndex + 1]);

            if ( paletteIndex == -1 ) paletteIndex = 0;

            this.tempColors[i][0].lerpColors(
                this.colorPalette[paletteIndex][0],
                this.colorPalette[paletteIndex + 1][0],
                hueIndex);
            this.tempColors[i][1].lerpColors(
                this.colorPalette[paletteIndex][1],
                this.colorPalette[paletteIndex + 1][1],
                hueIndex);
        }

        let col;

        for (let i = 0, i3 = 0; i < this.amount; i++, i3 += 3) {

            col = this.tempColors[ this.particles[i].aisleIndex ][ this.particles[i].colorIndex ]

            this.particles[i].updateColor( col, this.brightness );
            
        }
        
        this._updateColorArray();

    }

    setBrightness( bri ) {

        this.brightness = bri;

        // for ( let p of this.particles ) {

        //     this.particles[i].updateBrightness( bri );
        //     this.particles[i].updateColor( col );
            
        // }
        
        // this._updateColorArray();

    }

    changeTotalCount( count ) {

        let c = count;

        for ( let p of this.particles ) {
            p.visib = c < 0;
            p.updateColor( p.color );
            c--;
        }

        this._updateColorArray();

    }

    /**
     * 
     * @param {Array} particulateValuesArray Array of 24 arrays of normalised values for each particulate size reading. 
     */
    updateCount( hourMemory ) {
        
        let counts = [];
        
        console.log( 'before:', {
            hourMemory: hourMemory,
            counts: counts.slice()
        } );

        for ( let hour of hourMemory ) {
            counts.push( hour.particulates.map( val => Math.floor( val * ( this.amountPerSize / 24 ) )) );
        }

        for ( let p of this.particles ) {
            
            const v = counts[ p.aisleIndex ][ p.particulateIndex ] < 0;
            if ( v != p.visib ) {
                p.visib = v;
                p.updateColor( p.color );
            }
            counts[ p.aisleIndex ][ p.particulateIndex ]--;

        }

        console.log( 'after:', {
            hourMemory: hourMemory,
            counts: counts
        } );

        this._updateColorArray();

    }

    _updateColorArray() {

        for (let i = 0, i3 = 0; i < this.amount; i++, i3 += 3) {
            this.color.array[i3]     = this.particles[i].color.r;
            this.color.array[i3 + 1] = this.particles[i].color.g;
            this.color.array[i3 + 2] = this.particles[i].color.b;
        }

        this.color.needsUpdate = true;

    }

    setTextureMap( texture ) {

        this.obj.material.uniforms.pointTexture.value = texture;

    }

    setSize( size ) {
        this.obj.material.size = size;
    }
}

export { ParticleSystem }