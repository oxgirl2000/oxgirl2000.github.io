/**
 * This program is the seventh iteration of a data visualisation experiment for Foresta-Inclusive.
 * The base of the script runs on a THREE.Points object depicting a collection of Particle objects.
 * The Particle object determines the behaviour and functions of each particle, calculated on CPU in this .js file.
 * Once changes are calculated, the position, color, and size of each particle is manually set in arrays used as THREE.BufferAttribute.
 * These arrays are sent to the GPU to be handled by the shaders defined in index.html.
 * 
 *	MQTT messages are regularly received and processed by the messageReceived() function.
 *  Usually, those events then call other separate functions for legibility's sake.
 *  Ideally, values are normalised when goin in between functions for consistency, but this isn't implemented properly yet.
 *
 *  As of now, this workflow is a bit messy.
 *  There are too many global variables with ambiguous names/scopes that change unpredictably.
 *  Since the functions are very interdependent, it's hard to make simple changes without global side-effects.
 *  
 *  TODO:
 *  - Update Particle class functions to include any task that cycles through every particle.
 *  - Create a ParticlSystem class to organise functions dedicated to particleSystem.obj-wide behaviour (movement, shape changes)
 * 
 */

import * as THREE from './lib/three.js';

import Stats from 'https://unpkg.com/three@0.126.0/examples/jsm/libs/stats.module.js';
import { GUI } from 'https://unpkg.com/three@0.126.0/examples/jsm/libs/dat.gui.module.js';

import { OrbitControls } from 'https://unpkg.com/three@0.126.0/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'https://unpkg.com/three@0.126.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.126.0/examples/jsm/postprocessing/RenderPass.js';
import { AfterimagePass } from 'https://unpkg.com/three@0.126.0/examples/jsm/postprocessing/AfterimagePass.js';
import { ShaderPass } from 'https://unpkg.com/three@0.126.0/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'https://unpkg.com/three@0.126.0/examples/jsm/shaders/FXAAShader.js';
import { UnrealBloomPass } from 'https://unpkg.com/three@0.126.0/examples/jsm/postprocessing/UnrealBloomPass.js';

import { randomFloat, clamp, norm, lerp, checkRange, initRange } from './lib/helpers.js';
import * as CONST from './constants.js';
// import "./lib/perlin.js";


import { LeapMotion } from './leapmotion.js';
import { Sensor } from './sensor.js';
import { ParticleSystem } from './particleSystem.js';
import { Flowfield } from './flowfield.js';

//

/************** VARIABLES **************/

// MQTT --------------------
let server;
let client;

//

let container;
let scene;
let camera;
let renderer;

let controls;
let leap;

let stats;

let clock;
let timer;

let gridHelper;

let gui;

//

// CURRENT SENSOR --------------------

let sensor;

// To fill with 23 hours of previous sensor values.
let hourMemory;

/** Placeholder to fill particulate sensor data **/
function randomiseParticulateSensor( sensor ) {
	const randIndex = Math.random() * 100;	// randomise start of perlin traversal
	for ( let i = 0; i < CONST.particulateSizes.length; i++ )
		sensor.particulates[ i ] = Math.random();
}

//

let backgroundColors = [ new THREE.Color( CONST.range.background[ 0 ] ), new THREE.Color( CONST.range.background[ 1 ] ) ]

//

let particleSystem;		// The THREE.Points object containing geometry and material.

let maxParticles; // -----------------------------------------------
let maxPollen;

let maxAmtPerSize;
let particleCount;

// Recycled color object and array.
let color, tempColors;

//

let flowfield;

// The following objects are groupings of related variables.

let params;

//

const shape = {
	radius: 50,
	radii: [],
	innerLimitRadius: 1,
	edgeMode: 5,
	outerRingSize: 0.75,
	innerRingSize: 0.65,
	aisleSeparation: 15
}

//

const navi = {
	autoRotate: false,
	rotateSpeed: 0.001,
	autoZoom: false,
	zoomSpeed: 1,
	camDistance: 450
}

//

const cam = {
	distance: 200,
	focalLength: 80
}

//

let autoZoomReverse;

//

let backgroundColor;

//

let mouseX = 0, mouseY = 0;

let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;

//

let composer, afterimagePass, fxaaPass, bloomPass;

// for morphDensity()


let co2Changed = true;
let breathFreq = 1;
let frameCounter = 0;
let morphStartFrame = 0;
let morphing = false;
let initTailsVal = 0.9;
let lerpVal = 0;

let targetFocalLength = cam.focalLength;
let targetAisleSeparation = shape.aisleSeparation;
let targetCameraDistance;

let initFocalLength;
let initAisleSeparation;
let initCameraDistance;

//

let oldHue;
let zChanged = true;

let prevCam;

let leapTimeoutPeriod;
let leapTimer;
let mouseControlEnabled;
let leapTimerLogged;
let targetLeapCameraPos;

let showStats;

let mouseDown;
let calibrating;

let logDOM;

let bloomParams;

//

/********/
init();
animate();
/********/


function init() {

	params = {
		scale: 5,
		colorHue: 0.5,
		colorSaturation: 1.0,
		baseBrightness: 0.2,
		colorBrightness: 0.2,
		pollenBrightness: 0.4,
		breathDepth: 0.25,
		currentColorOnly: false,
		particleCount: maxParticles,
		backgroundColor: backgroundColors[ 0 ],
		enableBreath: true,

		exposure: 1,
		bloomStrength: 1.5,
		bloomThreshold: 0,
		bloomRadius: 0,

		showGridHelper: false

	}

	// MQTT setup

	server = CONST.shiftrURL;
	client = mqtt.connect( server, { clientId: 'Faadhi-Three' } );

	client.on( 'connect', () => client.subscribe( '#' ) );
	client.on( 'message', ( topic, message ) => messageReceived( topic, message ) );
	client.publish( '/Commands/Request', '1' );		// Sends command to MQTT-VCR to publish 24-hour memory data.

	//

	logDOM = document.getElementById( 'log' );

	showStats = true;
	mouseDown = false;

	// Scene setup

	container = document.getElementById( 'container' );

	scene = new THREE.Scene();

	camera = new THREE.PerspectiveCamera( 20, container.offsetWidth / container.offsetHeight, 1, 10000 );
	prevCam = {
		x: camera.position.x,
		y: camera.position.y,
		z: camera.position.z,
	}

	console.log( { width: container.offsetWidth, height: container.offsetHeight } );
	console.log( { focalLength: camera.getFocalLength() } );

	renderer = new THREE.WebGLRenderer( { antialias: true } );
	renderer.autoClear = true;
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( container.offsetWidth, container.offsetHeight );
	container.appendChild( renderer.domElement );

	controls = new OrbitControls( camera, renderer.domElement );
	controls.addEventListener( 'start', () => mouseDown = true );
	controls.addEventListener( 'end',   () => setTimeout( () => mouseDown = false, CONST.movementFinishedPausePeriod ) );
	controls.enableDamping = true;

	stats = new Stats();
	container.appendChild( stats.dom );

	clock = new THREE.Clock();
	timer = new THREE.Clock();

	gridHelper = new THREE.GridHelper( 100, 10 );
	gridHelper.rotateX( Math.PI * 0.5 );
	gridHelper.visible = false;
	scene.add( gridHelper );

	//

	// Instantiate sensor values.
	sensor = new Sensor();
	hourMemory = [];

	//

	// Manually seed noise with a random value to generate noise-map
	noise.seed( Math.random() );

	// Separate param for background to set color code from GUI.
	backgroundColor = new THREE.Color( params.backgroundColor );
	updateBackground( backgroundColor );

	color = new THREE.Color();
	tempColors = [];

	//

	flowfield = new Flowfield( 24 );
	scene.add( flowfield.lines );

	//

	updateRadii( flowfield.aisles );

	//

	maxParticles = CONST.maxParticles;
	maxPollen = maxParticles / 50;

	//

	particleSystem = new ParticleSystem( scene, maxParticles, maxPollen, flowfield.aisles, shape.radius );

	console.log( { particleSystem: particleSystem } );


	//

	maxAmtPerSize = ( maxParticles - maxPollen ) / 3;
	particleCount = {};
	// For future use: allocate individual particle count per particulate sensor reading.
	for ( let i of CONST.particulateSizes ) {
		let name = ( i * 10 ).toString();
		particleCount[ name ] = maxAmtPerSize;
	}

	particleCount[ 'total' ] = maxParticles;
	particleCount[ 'maxAmtPerSize' ] = maxAmtPerSize;
	particleCount[ 'maxAmtPerSizePerAisle' ] = maxAmtPerSize / 24;
	particleCount[ 'randomise' ] = false;

	particleCount[ 'small' ] = maxAmtPerSize;
	particleCount[ 'medium' ] = maxAmtPerSize;
	particleCount[ 'large' ] = maxAmtPerSize;
	particleCount[ 'pollen' ] = maxAmtPerSize;

	// Fill memory with default sensor values while waiting for response from MQTT-VCR

	for ( let i = 0; i < flowfield.aisles; i++ ) {
		hourMemory.push( sensor );
	}



	//

	particleSystem.updateColor( sensor.light, hourMemory );
	updateVOC( sensor.voc );
	updateCO2( sensor.co2 );

	//

	camera.position.z = cam.distance;
	targetCameraDistance = camera.position.z;

	leap = new LeapMotion();

	leapTimeoutPeriod = 4000;
	leapTimer = Date.now();
	mouseControlEnabled = true;
	leapTimerLogged = false;
	targetLeapCameraPos = { x: 0, y: 0, z: 0 };


	GUI.toggleHide();
	stats.dom.style.display = showStats ? "block" : "none"

	container.style.touchAction = 'none';
	container.addEventListener( 'pointermove', onPointerMove );
	controls.addEventListener( 'mousedown', (onMouseDown) );
	// window.addEventListener( 'pointerup',   (onMouseUp  ) );

	document.addEventListener( 'keypress', onKeyPress );
	window.addEventListener( 'resize', onWindowResize );


	// Post-processing for trails

	composer = new EffectComposer( renderer );
	const renderPass = new RenderPass( scene, camera );
	composer.addPass( renderPass );

	afterimagePass = new AfterimagePass();
	afterimagePass.uniforms[ 'damp' ].value = 0.92;
	composer.addPass( afterimagePass );

	bloomPass = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ), 1.5, 0.4, 0.85 );
	bloomPass.threshold = 0.05;
	bloomPass.strength = 1.5;
	bloomPass.radius = 0.5;
	bloomPass.enable = true;
	composer.addPass( bloomPass );

	// //

	// fxaaPass = new ShaderPass( FXAAShader );

	// const pixelRatio = renderer.getPixelRatio();

	// fxaaPass.material.uniforms[ 'resolution' ].value.x = 1 / ( container.offsetWidth * pixelRatio );
	// fxaaPass.material.uniforms[ 'resolution' ].value.y = 1 / ( container.offsetHeight * pixelRatio );

	// composer.addPass( fxaaPass );

	//

	addGUI();
	GUI.toggleHide();

}

//

/**
 * Animation, movement functions are called from here.
 */
function animate() {

	requestAnimationFrame( animate );

	const f = frameCounter++;
	const dt = clock.getDelta();
	const t = clock.getElapsedTime();

	//

	// publish command for a new 24-hour bank every hour (3600 seconds)
	if ( t > 3600 ) {
		client.publish( '/Commands/Request', '1' );

		// Restart clock
		clock.start();
	}

	//

	// Update the new flowfield directions.
	flowfield.calculate();
	if ( flowfield.show ) { 
		flowfield.showLines();
	}
	else if ( !flowfield.cleared ) { flowfield.clearLines(); }

	//

	if ( leap.hasHands() ) {

		mouseControlEnabled = false;

		// if ( leap.isCloseToCenter() )
		// 	leap.tracking = true;

		// if ( !!leap.tracking )
			targetLeapCameraPos = leap.getMappedPos( CONST.range.camera );

		leapTimerLogged = false;


	} else if ( !!!leapTimerLogged ) {
		
		leapTimer = Date.now();
		leapTimerLogged = true;

	} else if ( Date.now() - leapTimer < leapTimeoutPeriod ) {

		// targetLeapCameraPos = {
		// 	x: camera.position.x,
		// 	y: camera.position.y,
		// 	z: camera.position.z
		// }

	} else if ( !mouseDown ) {

		targetLeapCameraPos = {
			x: 0,
			y: 0,
			z: ( flowfield.aisles * shape.aisleSeparation ) + ( shape.aisleSeparation * 2 )
		};

		// leap.tracking = false;

	}

	targetLeapCameraPos.x = lerp( 1 - CONST.camera.smoothing, camera.position.x, targetLeapCameraPos.x );
	targetLeapCameraPos.y = lerp( 1 - CONST.camera.smoothing, camera.position.y, targetLeapCameraPos.y );
	targetLeapCameraPos.z = lerp( 1 - CONST.camera.smoothing, camera.position.z, targetLeapCameraPos.z );

	camera.position.set( targetLeapCameraPos.x, targetLeapCameraPos.y, targetLeapCameraPos.z );
	// camera.lookAt( 0, 0, Math.abs( targetLeapCameraPos.x * 2 ) );

	prevCam.x = targetLeapCameraPos.x;
	prevCam.y = targetLeapCameraPos.y;
	prevCam.z = targetLeapCameraPos.z;

	if ( f % 60 == 0 ) {
		// console.log( leap.getAverage()) ;
		// console.log( {
		// 	leapTimer: leapTimer,
		// 	leapTimerLogged: leapTimerLogged,
		// 	leapTimeoutPeriod: leapTimeoutPeriod
		// })
	}



	// if ( f % 60 == 0 ) {

	// 	console.log( leap.hasHands() )

	// 	console.log( {
	// 		c: c,
	// 		camPos: camera.position
	// 	} )

	// 	console.log( { lerp: lerp( 0.5, 0, 2 ) } )

	// }

	

	//

	// Update the new positions of the particles by simulating the flowfield forces.
	particleSystem.simulate( hourMemory, shape, flowfield, params.scale );

	
	//
	
	// Find which aisle the camera is closest to.
	const cameraAisleFloat = clamp( ( ( camera.position.z / ( shape.aisleSeparation * flowfield.aisles ) ) * flowfield.aisles ) , 0, 23 );
	const cameraAisleFloor = Math.floor( cameraAisleFloat );
	const nextAisle = cameraAisleFloor < flowfield.aisles - 1 ? cameraAisleFloor + 1 : cameraAisleFloor ;
	
	shape.innerLimitRadius = lerp( ( cameraAisleFloat / flowfield.aisles ), shape.radius, 0 );
	updateRadii( flowfield.aisles );

	// Dynamically change background colour based on the airTemp of that aisle.
	// const lerpAirTemp = lerp( (cameraAisleFloat - cameraAisleFloor), hourMemory[ cameraAisleFloor ].airTemp, hourMemory[ nextAisle ].airTemp ); 	// smoothly lerp between the airtemp of this aisle and the next.
	// const lerpAirTemp = ( (cameraAisleFloat - cameraAisleFloor) * ( hourMemory[ nextAisle ].airTemp - cameraAisleFloor, hourMemory[ cameraAisleFloor ].airTemp )) + hourMemory[ cameraAisleFloor ].airTemp;
	// updateAirTemp( lerpAirTemp );
	
	updateAirTemp( hourMemory[ cameraAisleFloor ].airTemp );

	//

	if ( co2Changed || morphing ) morphDensity( dt );
	// if (params.enableBreath) breathe(f);

	//

	let logContent = ``;

	if ( leap.calibrating ) {

		// const avgHand = leap.getAverage();

		logContent += `
		Calibrating... <br>
		<br>
		CURRENT:<br>
		x = ${leap.handPos.x.toFixed( 2 )}<br>
		z = ${leap.handPos.z.toFixed( 2 )}<br>
		<br>
		RANGE:<br>
		x = { min:${ leap.range.x[ 0 ].toFixed( 2 )}, max: ${ leap.range.x[ 1 ].toFixed( 2 )} }<br>
		z = { min:${ leap.range.z[ 0 ].toFixed( 2 )}, max: ${ leap.range.z[ 1 ].toFixed( 2 )} }<br>
		<br>
		`

	} else {

		logContent += `
		Camera Aisle <br>
		${ cameraAisleFloor } <br>
		<br>
		Next Aisle <br>
		${ nextAisle }<br>
		<br>
		Difference<br>
		${ (cameraAisleFloat - cameraAisleFloor).toFixed(2) }
		<br>
		<br>
		Current temp <br>
		${ hourMemory[ cameraAisleFloor ].airTemp}
		<br>
		<br>
		Next temp<br>
		${ hourMemory[ nextAisle ].airTemp}
		<br>
		<br>
		`
	}
	// Lerped Air Temp <br>
	// ${ lerpAirTemp }

	logDOM.innerHTML = logContent;

	render();
	stats.update();
	controls.update();

}

function render() {
	composer.render();	// Composer is used to run the base render through post-processing effects determined in init()
}


/****************************    Navigation/Interaction     ******************************/

function onWindowResize() {

	windowHalfX = window.innerWidth / 2;
	windowHalfY = window.innerHeight / 2;

	camera.aspect = container.offsetWidth / container.offsetHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( container.offsetWidth, container.offsetHeight );
	composer.setSize( container.offsetWidth, container.offsetHeight );

	const pixelRatio = renderer.getPixelRatio();

	fxaaPass.material.uniforms[ 'resolution' ].value.x = 1 / ( container.offsetWidth * pixelRatio );
	fxaaPass.material.uniforms[ 'resolution' ].value.y = 1 / ( container.offsetHeight * pixelRatio );

}

//

function onPointerMove( event ) {

	if ( event.isPrimary === false ) return;

	mouseX = event.clientX - windowHalfX;
	mouseY = event.clientY - windowHalfY;

}

function onMouseDown ( e ) {
	mouseDown = true;	
	console.log( 'mousedown ');
}

function onMouseUp ( e ) {
	mouseDown = false;	
}

let textureToggle = false;

function onKeyPress( e ) {

	switch ( e.key ) {

		case " ":
			leap.calibrating = !leap.calibrating;
			if ( !!leap.calibrating ) leap.resetRange();
			console.log( '[EVENT]: Calibrating...' )
			break;
			
		case "c":
			// console.log( '[EVENT]: Setting center to current hand position.' )
			// leap.setCenter();
			break;

		case "g":
			GUI.toggleHide();
			showStats = !showStats;
			stats.dom.style.display = showStats ? "block" : "none";
			logDOM.style.display = showStats ? "block" : "none";
			break;

		case "r":
			console.log( leap.range );
			break;

		case 't':
			textureToggle = !textureToggle;
			particleSystem.obj.material.map = textureToggle ? particleSystem.textures.soft : particleSystem.textures.hard;
			break;

		case 'p':
			updateParticleCount();
			break;

	}

	console.log( {
		e: e,
		frameHands: leap.frameHands,
		leap: leap,
		cameraPos: camera.position,
		center: leap.centerPos
	} );

	console.log( {
		windRange: CONST.range.wind,
		hourMemory: hourMemory,
	})

}


/****************************   Global State   ******************************/

/**
 * Smoothly interpolates focalLength, aisleSeparation from current values to target values set by updateCO2().
 * 
 * @param {number} f The current frame count. Used to determine length of interpolation period using morphDurationInFrames.
 */
function morphDensity( f ) {

	if ( !morphing || co2Changed ) {
		co2Changed = false;
		morphing = true;
		morphStartFrame = f;
		initFocalLength = camera.getFocalLength();
		initAisleSeparation = shape.aisleSeparation;

		initCameraDistance = camera.position.z / ( shape.aisleSeparation * flowfield.aisles );
		// initCameraDistance = clamp( Math.floor( ( camera.position.z / ( shape.aisleSeparation * flowfield.aisles ) * flowfield.aisles ) ), 0, 50 );

		initTailsVal = afterimagePass.uniforms[ "damp" ].value;


		// console.log('morph started... at: ', f)
		// console.log('initCameraDistance: ', initCameraDistance)
	} else {

		const morphDurationInFrames = 60;
		// const lerpStep = morphDurationInFrames / 250;

		const morphProgress = ( f - morphStartFrame ) / morphDurationInFrames;
		// const distFromEdge = 0.5 - ( - ( Math.pow( morphProgress * 2 - 1, 3 ) + 0.5 ) );
		// lerpVal += distFromEdge;
		// lerpVal = Math.cbrt( morphProgress * 2 - 1 ) * 0.5 + 0.5;		// ramp up to halfway and slow down before arriving.
		// lerpVal = Math.pow( morphProgress, 0.2);
		// lerpVal = Math.log( morphProgress ) + 1;

		const speed = 1.5;
		const lerpRatio = f * speed;

		lerpVal = lerp( lerpRatio, lerpVal, 1 );

		if ( lerpVal > 0.99 ) {
			// console.log('done');
			morphing = false;
			morphStartFrame = 0;
			lerpVal = 0;
			afterimagePass.uniforms[ "damp" ].value = initTailsVal;
			return false;
		}

		// afterimagePass.uniforms[ "damp" ].value = lerp( lerpVal, afterimagePass.uniforms[ "damp" ].value, CONST.range.tails[0] );

		// const focalLengthLerped = lerp( lerpVal, initFocalLength, targetFocalLength );
		const focalLengthLerped = lerp( lerpRatio, camera.getFocalLength(), targetFocalLength );
		camera.setFocalLength( focalLengthLerped );
		cam.focalLength = focalLengthLerped;

		// shape.aisleSeparation = lerp( lerpVal, initAisleSeparation, targetAisleSeparation );
		shape.aisleSeparation = lerp( lerpRatio, shape.aisleSeparation, targetAisleSeparation );


		// camera.position.z = shape.aisleSeparation * initCameraDistance;
		// camera.position.z = initCameraDistance * ( shape.aisleSeparation * flowfield.aisles );

		// console.log('new Distance: ', camera.position.z );
		// camera.position.z = lerp( lerpVal, initCameraDistance, targetCameraDistance );
		// cam.distance = camera.position.z;



	}
}

/**
 * Pulses the brightness at a frequency controlled by VOC levels.
 * 
 * @param {number} t The current frame count.
 */
function breathe( t ) {

	if ( t % 5 == 0 ) { 		// Only updates the brightness every 5 frames to save processing power.

		// const index = norm( ( 4 / ( 3 * Math.PI ) ) * Math.sin( 3  * frameCounter * 0.01 ), -1, 1);

		// params.colorBrightness = params.baseBrightness + lerp( index, CONST.range.breath.bri[0], CONST.range.breath.bri[1] );

		params.colorBrightness = params.baseBrightness + lerp( norm( noise.perlin2( frameCounter * breathFreq, 0 ), -1, 1 ), CONST.range.breath.bri[ 0 ], CONST.range.breath.bri[ 1 ] );


		particleSystem.updateColor( sensor.light, hourMemory );

	}

}

/**
 * Maps the size of an aisle's radius based on bounds of the total radius and the innerLimitRadius.
 */
function updateRadii( aisles ) {
	shape.radii = [];

	for ( let i = 0; i < aisles; i++ ) {
		let n = i / aisles;
		let r = lerp( n, shape.radius, shape.innerLimitRadius );
		shape.radii.push( r );
	}
}


/****************************    MQTT Update Functions     ******************************/

function messageReceived( topic, payload ) {

	payload = payload.toString();

	if ( !sensor.local ) {

		switch ( topic ) {

			// case 'Lux':
			case 'Light':
				checkRange( payload, CONST.range.light );
				sensor.light = norm( payload, CONST.range.light[ 0 ], CONST.range.light[ 1 ] );
				particleSystem.updateColor( sensor.light, hourMemory );
				break;

			case 'Temp-degree':
			case 'AirTemp':
				sensor.airTemp = payload;
				checkRange( sensor.airTemp, CONST.range.airTemp );
				updateAirTemp( sensor.airTemp );
				break;

			case 'Wind':
				sensor.wind = payload;
				// if ( isNaN( sensor.wind ) ) return;
				CONST.range.wind = checkRange( sensor.wind, CONST.range.wind );
				updateWind( sensor.wind );

				break;

			// case 'Particles2.5':
			// 	sensor.particle2_5 = payload;
			// 	updateParticleCount();

			// 	break;

			// case 'Particles10':
			// 	sensor.particle10 = payload;
			// 	checkRange(sensor.particle10, CONST.range.particle10);
			// 	updatePollen(sensor.particle10);
			// 	break;

			case 'C02':
				sensor.co2 = payload;
				checkRange( sensor.co2, CONST.range.co2 );
				updateCO2( sensor.co2 );
				break;

			case 'VOC':
				sensor.voc = payload;
				checkRange( sensor.voc, CONST.range.voc );
				updateVOC( sensor.voc );
				break;
		}
	}

	if ( topic.split( '/' )[ 0 ] ) {

		let payloadArr = payload.split( ', ' ); // turn comma denominated string into array of values

		let l = topic.length;
		let hourIndex = Number( topic[ l - 2 ] + topic[ l - 1 ] );	// index is last two characters of topic i.e. hour number.

		let hourData = {

			light: norm( payloadArr[ 0 ], CONST.range.light[ 0 ], CONST.range.light[ 1 ] ),
			// wind: norm( payloadArr[ 1 ], CONST.range.wind[ 0 ], CONST.range.wind[ 1 ] ),
			wind: payloadArr[ 1 ],
			wetSoil: payloadArr[ 2 ],
			soilTemp: payloadArr[ 3 ],
			rain: payloadArr[ 4 ],
			airTemp: payloadArr[ 5 ],
			co2: payloadArr[ 6 ],
			voc: payloadArr[ 7 ],

			// particle0_1: Math.random(),
			// particle0_3: Math.random(),
			// particle1: Math.random(),
			// particle2_5: norm( Number( payloadArr[ 8 ] ), CONST.range.particle2_5[0], CONST.range.particle2_5[1] ),
			// particle5: Math.random(),
			// particle10: norm( Number( payloadArr[ 9 ] ), CONST.range.particle10[0], CONST.range.particle10[1] ),
			
			particulates: [

				Math.random(),
				Math.random(),
				Math.random(),
				norm( Number( payloadArr[ 8 ] ), CONST.range.particle2_5[0], CONST.range.particle2_5[1] ),
				Math.random(),
				norm( Number( payloadArr[ 8 ] ), CONST.range.particle10[0], CONST.range.particle10[1] ),
			]

		}

		randomiseParticulateSensor( hourData );

		updateMemory( hourData, hourIndex );

	}

}

function updateMemory( data, index ) {

	if ( hourMemory.length = 24 ) { hourMemory.splice( index, 1, data ); }  // if 24hour memory is filled, replace index (args[1] == 1)
	else { hourMemory.splice( index, 0, data ); }							// else, don't replace and just add.

}

function updateBackground( newCol ) { scene.background = newCol; }

/**
 * WIP: Change the representative size of each particulate sensor size.
 */
function updateParticleSize() {

	const pollenStep = Math.floor( maxParticles / maxPollen );
	let sizeIndex, pollenIndex;

	for ( let j = 0; j < maxParticles; j++ ) {

		if ( particleSystem.particles[ j ].pollenIndex ) {

			sizes[ j ] = CONST.particleSizes.length - 1;
			sizeIndex = CONST.particleSizes.length - 1;
			pollenIndex = true;

		} else {

			let randomSizeIndex = Math.floor( Math.random() * ( CONST.particleSizes.length - 2 ) );

			sizes[ j ] = CONST.particleSizes[ randomSizeIndex ];
			sizeIndex = randomSizeIndex;
		}
	}

}

/**
 * Updates the number of pollen particles available.
 * 
 * @param {number} val particle10 sensor value.
 */
function updatePollen( val ) {

	val = norm( val, CONST.range.particle10[ 0 ], CONST.range.particle10[ 1 ] );

	particleCount.pollen = lerp( val, 0, maxPollen );

	updateParticleCount();

}

/**
 * Updates the particle count by counting down limits on count for each size, aisle, and total.
 */
function updateParticleCount() {



	particleSystem.updateCount( hourMemory )

}

/**
 * Updates flowfield parameters based on wind values.
 * 
 * @param {number} val The live wind sensor value.
 */
function updateWind( val ) {

	val = norm( val, CONST.range.wind[ 0 ], CONST.range.wind[ 1 ] );

	flowfield.noiseVari = lerp( val, CONST.range.noiseVari[ 0 ], CONST.range.noiseVari[ 1 ] );
	flowfield.noiseSpeed = lerp( val, CONST.range.noiseSpeed[ 0 ], CONST.range.noiseSpeed[ 1 ] );
	flowfield.force = lerp( val, CONST.range.force[ 0 ], CONST.range.force[ 1 ] );
	flowfield.maxSpeed = lerp( val, CONST.range.maxSpeed[ 0 ], CONST.range.maxSpeed[ 1 ] );

	// afterimagePass.uniforms[ "damp" ].value = lerp( val, CONST.range.tails[ 0 ], CONST.range.tails[ 1 ] );

}

/**
 * Updates the background based on airTemp. Ranges from dark blue to red.
 * 
 * @param {number} val The live airTemp sensor value.
 */
function updateAirTemp( val ) {

	val = norm( val, CONST.range.airTemp[ 0 ], CONST.range.airTemp[ 1 ] );
	backgroundColor.lerpColors( backgroundColors[ 0 ], backgroundColors[ 1 ], val );
	updateBackground( backgroundColor );

}

/**
 * 
 * @param {number} val 
 */
function updateParticle2_5( val ) {

	val = norm( val, CONST.range.particle2_5[ 0 ], CONST.range.particle2_5[ 1 ] );

}

/**
 * Updates the targets for morphDensity() to morph towards. Flags co2Changed to trigger morphDensity() from animate().
 * 
 * @param {number} val The live co2 sensor value.
 */
function updateCO2( val ) {

	val = norm( val, CONST.range.co2[ 0 ], CONST.range.co2[ 1 ] );

	targetFocalLength = lerp( val, CONST.range.cam.focalLength[ 0 ], CONST.range.cam.focalLength[ 1 ] );
	targetCameraDistance = lerp( val, CONST.range.cam.distance[ 0 ], CONST.range.cam.distance[ 1 ] );
	targetAisleSeparation = lerp( val, CONST.range.aisleSeparation[ 0 ], CONST.range.aisleSeparation[ 1 ] );
	// params.baseBrightness = lerp( val, CONST.range.baseBrightness[ 0 ], CONST.range.baseBrightness[ 1 ] );
	// params.pollenBrightness = params.baseBrightness * 2;

	// camera.position.z = cam.distance;
	// zChanged = true;
	co2Changed = true;
}

/**
 * Determines the frequency of breathe().
 * 
 * @param {number} val The most recent voc sensor data.
 */
function updateVOC( val ) {

	val = norm( val, CONST.range.voc[ 0 ], CONST.range.voc[ 1 ] );

	breathFreq = lerp( val, CONST.range.breath.freq[ 0 ], CONST.range.breath.freq[ 1 ] );

}

function logHTML() {

	

}

/**
 * Static, adds GUI. Sorted by object groupings.
 */
function addGUI() {
	gui = new GUI();

	const folderFF = gui.addFolder( 'Flowfield' );
	const folderPS = gui.addFolder( 'Particle Size' );
	const folderNG = gui.addFolder( 'Navigation' );
	const folderCL = gui.addFolder( 'Colour' );
	const folderSH = gui.addFolder( 'Shape' );
	const folderSN = gui.addFolder( 'Sensor' );
	const folderPC = folderSN.addFolder( 'Particulates' );
	const folderTM = gui.addFolder( 'Time' );
	const folderBP = gui.addFolder( 'Bloom' );
	
	folderFF.add( flowfield, 'show' ).onChange( ( val ) => flowfield.show = val );
	folderFF.add( flowfield, 'noiseVari', 0, 0.2 ).listen();
	folderFF.add( flowfield, 'noiseSpeed', 0, 0.001 ).listen();
	folderFF.add( flowfield, 'force', CONST.range.force[ 0 ], CONST.range.force[ 1 ] ).listen();
	folderFF.add( flowfield, 'maxSpeed', CONST.range.maxSpeed[ 0 ], CONST.range.maxSpeed[ 1 ] ).listen();

	// folderPC.add( particleCount, 'total', 0, CONST.maxParticles ).onChange( () => particleSystem.updateParticleCount( particleCount.total ) );
	// folderPC.add( particleCount, 'small', 0, particleCount.maxAmtPerSize ).onChange( () => updateParticleCount() ).listen();
	// folderPC.add( particleCount, 'medium', 0, particleCount.maxAmtPerSize ).onChange( () => updateParticleCount() ).listen();
	// folderPC.add( particleCount, 'large', 0, particleCount.maxAmtPerSize ).onChange( () => updateParticleCount() ).listen();
	// folderPC.add( particleCount, 'pollen', 0, maxPollen ).onChange( () => updateParticleCount() ).listen();
	

	/**
	*		TODO: Write updateParticleSize. find way to structure particle object to contain previous CONST.particleSizes data.
	* 				Maybe find with particles.size and switch to actual CONST.particleSizes.<size>.
	*/

	// folderPS.add(CONST.particleSizes, 'small',  0, 2).step(0.1).onChange( updateParticleSize );
	// folderPS.add(CONST.particleSizes, 'medium', 0, 3).step(0.1).onChange( updateParticleSize );
	// folderPS.add(CONST.particleSizes, 'large',  0, 4).step(0.1).onChange( updateParticleSize );
	// folderPS.add(CONST.particleSizes, 'pollen', 0, 5).step(0.1).onChange( updateParticleSize );
	// gui.add(params, 'scale', 0, 100);



	folderNG.add( navi, 'autoRotate', 0, 1 );
	folderNG.add( navi, 'rotateSpeed', 0, 0.002 ).step( 0.0001 );
	folderNG.add( navi, 'autoZoom' );
	folderNG.add( navi, 'zoomSpeed', 0, 2 ).step( 0.01 );
	folderNG.add( cam, 'distance', 0, 1000 ).onChange( function () { camera.position.z = cam.distance; } ).listen();

	// folderCL.add(params, 'colorHue', 0, 1024).step(0.1).onChange( () => particleSystem.updateColor(params.color, hourMemoryHue) );

	folderCL.add( params, 'currentColorOnly', 0, 1 ).onChange( () => particleSystem.updateColor( sensor.light, hourMemory ) );
	folderCL.add( params, 'colorSaturation', 0, 1 ).step( 0.01 ).onChange( () => particleSystem.updateColor( sensor.light, hourMemory ) );
	// folderCL.add( params, 'colorBrightness', 0, 1 ).step( 0.01 ).onChange( () => particleSystem.updateColor( sensor.light, hourMemory ) ).listen();
	folderCL.add( params, 'baseBrightness', 0, 1 ).step( 0.01 ).onChange( () => particleSystem.setBrightness( params.baseBrightness ) ).listen();
	folderCL.add( params, 'pollenBrightness', 0, 1 ).step( 0.01 ).onChange( () => particleSystem.updateColor( sensor.light, hourMemory ) );
	folderCL.add( params, 'breathDepth', 0, 0.5 ).step( 0.01 ).onChange( () => { CONST.range.breath.bri[ 0 ] = -params.breathDepth; CONST.range.breath.bri[ 1 ] = params.breathDepth; } );
	// folderCL.addColor( particleSystem.obj.material, 'color' );
	folderCL.addColor( params, 'backgroundColor' ).onChange( () => { backgroundColors[ 1 ].set( params.backgroundColor ); updateAirTemp( sensor.airTemp ); } ).listen();
	folderCL.add( params, 'enableBreath', 0, 1 );

	folderSN.add( sensor, 'local', 0, 1 );
	folderSN.add( sensor, 'light', 0, 1.0 ).step( 0.01 ).onChange( () => particleSystem.updateColor( sensor.light, hourMemory ) ).listen();
	folderSN.add( sensor, 'wind', CONST.range.wind[ 0 ], CONST.range.wind[ 1 ] ).step( 1 ).onChange( () => updateWind( sensor.wind ) ).listen();
	folderSN.add( sensor, 'airTemp', CONST.range.airTemp[ 0 ], CONST.range.airTemp[ 1 ] ).step( 1 ).onChange( () => updateAirTemp( sensor.airTemp ) ).listen();
	folderSN.add( sensor, 'co2', CONST.range.co2[ 0 ], CONST.range.co2[ 1 ] ).step( 1 ).onChange( () => updateCO2( sensor.co2 ) ).listen();
	folderSN.add( sensor, 'voc', CONST.range.voc[ 0 ], CONST.range.voc[ 1 ] ).step( 1 ).onChange( () => updateVOC( sensor.voc ) ).listen();

	folderPC.add( particleCount, 'randomise', 0, 1 ).onChange( () => {
		for ( const data of hourMemory )
			randomiseParticulateSensor( data );
		updateParticleCount();
	} );
	// folderSN.add( sensor, 'particle10', CONST.range.particle10[ 0 ], CONST.range.particle10[ 1 ] ).step( 1 ).onChange( () => updatePollen( sensor.particle10 ) ).listen();
	
	folderSH.add( shape, 'edgeMode', 1, 5 ).step( 1 );
	// folderSH.add(shape, 'radius', 0, 50).step(0.1);
	folderSH.add( shape, 'outerRingSize', 0.01, 0.99 ).step( 0.01 );
	folderSH.add( shape, 'innerRingSize', 0.01, 0.99 ).step( 0.01 );
	
	folderSH.add( shape, 'innerLimitRadius', 0, shape.radius ).step( 1 ).onChange( () => updateRadii( 24 ) ).listen();
	folderSH.add( shape, 'aisleSeparation', 0, 50 ).step( 0.1 ).onChange( () => zChanged = true ).listen();

	folderBP.add( bloomPass, 'enable').onChange( ( value ) => value = value ? composer.addPass( bloomPass ) : composer.removePass( bloomPass ) );
	folderBP.add( bloomPass, 'threshold', 0.0, 1.0 ).step( 0.001 ).onChange( ( value ) => bloomPass.threshold = Number( value ) );
	folderBP.add( bloomPass, 'strength', 0.0, 3.0 ).step( 0.01 ).onChange( ( value ) => bloomPass.strength = Number( value ) );
	folderBP.add( bloomPass, 'radius', 0.0, 1.0 ).step( 0.01 ).onChange( ( value ) => bloomPass.radius = Number( value ) );

	gui.add( cam, 'focalLength', 1, 150 ).onChange( ( val ) => camera.setFocalLength( val )).listen();

	// gui.add( afterimagePass.uniforms[ "damp" ], 'value', CONST.range.tails[ 0 ], CONST.range.tails[ 1 ] ).listen();

	// gui.add( params, 'exposure', 0.1, 2 ).onChange( ( value ) => renderer.toneMappingExposure = Math.pow( value, 4.0 ) );

	gui.add( particleSystem, 'textureMap', { soft: 'soft', hard: 'hard' } ).onChange( (val) => particleSystem.setTextureMap( particleSystem.textures[ val ] ));
	// gui.add( particleSystem.obj.material, 'size', 1, 10 )
	// .onChange( (val) => particleSystem.setSize( val ));

	gui.add( leap, 'centerOffset', -100, 100 ).onChange( ( val ) => leap.centerOffset = val );

	gui.add( params, 'showGridHelper' ).onChange( () => gridHelper.visible = !!params.showGridHelper );
}

