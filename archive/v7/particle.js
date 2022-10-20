import * as THREE from './lib/three.js';
import * as CONST from './constants.js';
import { randomFloat, clamp, norm, lerp, checkRange } from './lib/helpers.js';

class Particle {

	constructor(aisles, radius ) {
		
		this.pos = new THREE.Vector3(
			randomFloat() * radius,
			randomFloat() * radius,
			0);
		this.vel = new THREE.Vector3();
		this.acc = new THREE.Vector3();

		this.particulateIndex = Math.floor( Math.random() * CONST.particulateSizes.length - 1 );
		this.particulate = CONST.particleSizes[ this.particulateIndex ];
		
		let i = 0;

		switch ( this.particulateIndex ) {
			case 0:
			case 1:
			case 2:
				i = 0;
				break;

			case 3:
				i = 1;
				break;

			case 4:
				i = 2;
				break;

			case 5:
				i = 3;
				break;
		}

		this.size = CONST.particleSizes[ i ]

		this.color = new THREE.Color( 0x000000 );

		this.aisleIndex = Math.floor( Math.random() * aisles );
		this.colorIndex = Math.floor( Math.random() * 2 );

		this.isPollen = false;

		this.visib = true;
	}

	updateColor( newColor, bri ) {
		if (!this.visib) { this.color.set( 0x000000 ); return false; }
		// else if ( this.isPollen ) { this.color.set(_pollenColor); }
		else {

			this.color.set( newColor );
			// this.color.getHSL(this.color);
			// this.color.setHSL(
			// 	this.color.h,
			// 	this.color.s * params.colorSaturation,
			// 	this.color.l * params.pollenBrightness);
	
		}

		this.color.getHSL(this.color);
		this.color.setHSL(
		this.color.h,
		this.color.s * 0.8,
		this.color.l * bri);
	}

	updateBrightness( bri ) {



	}

}

class Pollen extends Particle {

	constructor(aisles, radius) {

		super( aisles, radius );

		this.size = CONST.particleSizes[ ( CONST.particleSizes.length - 1 ) ];

		this.color = new THREE.Color( CONST.pollenColorCode );

		this.isPollen = true;

	}

}

export { Particle, Pollen }