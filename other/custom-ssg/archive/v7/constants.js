
const shiftrURL = "wss://poetryai:605k8jiP5ZQXyMEJ@poetryai.cloud.shiftr.io"
// 'wss://foresta-projects:ADOh7ArkqjIE27zR@foresta-projects.cloud.shiftr.io'

const maxParticles = 50000;

// Ranges of inputs and outputs. [low, high].
const range = {
	//input
	light: [ 0, 1024 ],
	wind: [ 75, 85 ],
	airTemp: [ 10, 35 ],
	co2: [ 400, 500 ],
	voc: [ 0, 100 ],
	particle2_5: [ 0, 10 ],
	particle10: [ 0, 10 ],

	//output
	noiseVari: [ 0.1, 0.05 ],  //how much variation between each flowfield quadrant - the higher the number the higher the variations btween each quadrant.
	noiseSpeed: [ 0.0001, 0.001 ], // how fast the flowfield moves and changes (the lower - the slower it changes)
	force: [ 0.0001, 0.002 ], // how much force the flowfield puts out
	maxSpeed: [ 0.01, 0.4 ], // max speed of the particles (the wider the range - the more obvious the speed of wind)
	tails: [ 0.985, 0.95 ], //length of tails on particles
	cam: {
		distance: [ 380, 1100 ],
		focalLength: [ 5, 20 ]
	},
	camera: {
		x: [ 200, -200 ],
		y: [ 0, 0 ],
		z: [ 0, 800 ]
	},
	aisleSeparation: [ 5, 20 ],  // aisles
	baseBrightness: [ 0.3, 0.5 ], // brightness of the particulates
	breath: {  //VOC
		freq: [ 0.001, 0.05 ],
		bri: [ -0.05, 0.05 ]
	},

	background: [ 0x000022, 0x220000 ]  // two different colours - left cool - right warm

}

const camera = {
	default: {
		x: 0,
		y: 0,
		z: 600
	},
	smoothing: 0.98		// [0.0 - 0.99] How smoothly the camera moves with a Leap
}

const particleSizes = [
	1, // small
	2, //medium
	3, //large
	4, //pollen
	// 6
]

// Array of particulate sensor sizes to be used in the future.
const particulateSizes = [
	0.1,
	0.3,
	1,
	2.5,
	5,
	10
];

// Markers for the boundaries of each color palette.
const colorRanges = [
	0, // 0-153
	0.15, //154-409
	0.4, //409-664
	0.65, //664 - 950
	0.9, //950-1023
	1.0
];


const colorCodes = [

	[ '#0718fa', '#00ecbc' ], //blue
	[ '#f43b47', '#a92cbf' ], //purple/orange
	[ '#f9d423', '#f74a05' ], //orange/yellow
	[ '#2be324', '#f5c000' ], //orange/green
	[ '#93e909', '#fafef2' ], //green/white
	[ '#93e909', '#fafef2' ], //green/white

];

const pollenColorCode = '#e3cd07';

// Amount of time in ms that the view stays still after movement is finished e.g. Leap stops detecting hand or mous drag stops.
const movementFinishedPausePeriod = 4000;

export {
	shiftrURL,
	range,
	maxParticles,
	particleSizes,
	particulateSizes,
	colorRanges,
	colorCodes,
	pollenColorCode,
	movementFinishedPausePeriod,
	camera
}