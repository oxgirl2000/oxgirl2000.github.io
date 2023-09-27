/* Returns a float between -1 and 1 */
const randomFloat = () => Math.random() * 2 - 1;

/* Clamps value to within the range. */
const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

/* Normalises value to range of 0 to 1. */
const norm = (val, min, max) => clamp((val - min) / (max - min), 0, 1);

/* Maps normalised value to range. */
const lerp = (val, min, max) => (val * (max - min)) + min;

const map = ( val, minIn, maxIn, minOut, maxOut ) => lerp( norm( val, minIn, maxIn ), minOut, maxOut );

/* If val is outside of range, increase range. Range is array of two numbers. */
const checkRange = (val, range) => { range[0] = Math.min(val, range[0]); range[1] = Math.max(val, range[1]); return range; }

const initRange = ( val, range ) => { range[ 0 ] = val; range[ 1 ] = val; }

export { randomFloat, clamp, norm, lerp, map, checkRange, initRange }