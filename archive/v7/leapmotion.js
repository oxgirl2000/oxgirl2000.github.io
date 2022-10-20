// import 'https://js.leapmotion.com/leap-1.1.0.js';
// import 'https://js.leapmotion.com/leap-plugins-0.1.12.js';
import { initRange, checkRange, map, lerp, norm } from './lib/helpers.js';

export class LeapMotion {

    constructor () {

        // this.camera = camera;

        this.scale = 0.25;

        //  Retrieved from prior calibration.
         this.range = {
            x: [ 0, 500 ],
            y: [ 0, 500 ],
            z: [ -300, 300 ]
        };
        //  this.range = {
        //     x: [ 0, 0 ],
        //     y: [ 0, 0 ],
        //     z: [ 0, 0 ]
        // };

        this.handPos = {
            x: 0,
            y: 0,
            z: 0
        }

        this.centerPos = {
            x: lerp( 0.5, this.range.x[0], this.range.x[1]),
            y: lerp( 0.5, this.range.y[0], this.range.y[1]),
            z: lerp( 0.5, this.range.z[0], this.range.z[1]),
        }

        this.centerOffset = 0;

        this.previousHands = [];
        this.smoothingFrames = 5;

        this.frameHands = [];

        this.tracking = false;
        this.calibrating = false;

        this._initLeap();

    }

    _initLeap() {

        console.log( this );
        const self = this;

        Leap.loop( function ( frame ) {

            self.frameHands = frame.hands;

            // frame.hands.forEach( function ( hand, index ) {
            if ( self.hasHands() ) {

                const hand = frame.hands[ 0 ];

                const pos = hand.screenPosition();

                // // Limit to  two decimal places
                // pos[ 0 ] = pos[ 0 ].toFixed( 2 )
                // pos[ 1 ] = pos[ 1 ].toFixed( 2 )
                // pos[ 2 ] = pos[ 2 ].toFixed( 2 )

                // Update pos values
                self.handPos.x = parseInt( pos[ 0 ], 10 );
                self.handPos.y = parseInt( pos[ 1 ], 10 );
                self.handPos.z = parseInt( pos[ 2 ], 10 );

                // Expand the range.
                checkRange( pos[ 0 ], self.range.x );
                checkRange( pos[ 1 ], self.range.y );
                checkRange( pos[ 2 ], self.range.z );

                self.previousHands.push( self.handPos );
                if ( self.previousHands.length > self.smoothingFrames ) self.previousHands.shift();

            }


        } ).use( 'screenPosition', { scale: self.scale } );

    }

    /**
     * 
     * @param {*} cameraPos Object with xyz properties denoting current camera position.
     * @param {*} range Object with xyz properties which are all pairs of min max values.
     * @returns Object with xyz properties of new camera position.
     */
    getMappedPos( cameraRange ) {

        const avgHand = this.getAverage();
        const xOffset = 40;

        let x = this.centerOffset + map( avgHand.x, this.range.x[ 0 ], this.range.x[ 1 ], cameraRange.x[ 0 ], cameraRange.x[ 1 ] ) * norm( avgHand.z, this.range.z[0], this.range.z[1] );
        const y = 0;
        // const y = map( this.handPos.y, this.range.y[0], this.range.y[1], cameraRange.y[0], cameraRange.y[1] );
        const z = map( avgHand.z, this.range.z[ 0 ], this.range.z[ 1 ], cameraRange.z[ 0 ], cameraRange.z[ 1 ] );

        // let lo, hi;

        // if ( this.handPos.x < this.centerPos.x ) {
        //     lo = this.range[0];
        //     hi = this.centerPos.x;
        // } else {
        //     lo = this.centerPos.x;
        //     hi = this.range[1];
        // }

        // const x = map( this.handPos.x, this.range.x[0], this.range.x[1], cameraRange.x[0], cameraRange.x[1] );
        // const y = 0;
        // // const y = map( this.handPos.y, this.range.y[0], this.range.y[1], cameraRange.y[0], cameraRange.y[1] );
        // const z = map( this.handPos.z, this.range.z[0], this.range.z[1], cameraRange.z[0], cameraRange.z[1] );

        // x -= xOffset;


        return { x: x, y: y, z: z };

    }

    hasHands() {

        return this.frameHands.length > 0;

    }

    getAverage() {

        if ( this.previousHands.length > 0 ) {

            const avgHand = {
                x: 0,
                y: 0,
                z: 0
            };

            for ( let hand of this.previousHands ) {
                avgHand.x += hand.x;
                avgHand.y += hand.y;
                avgHand.z += hand.z;
            }

            // console.log( this.handPos );

            for ( let prop in avgHand ) {

                if ( avgHand[prop] != 0 ) avgHand[prop] /= this.previousHands.length;

            }

            // avgHand.x /= this.previousHands.length;
            // avgHand.y /= this.previousHands.length;
            // avgHand.z /= this.previousHands.length;

            return avgHand;

        } else {
            return this.handPos;
        }


    }

    setCenter() {

        this.centerPos = {

            x: this.handPos.x,
            y: this.handPos.y,
            z: this.handPos.z,

        }

    }

    isCloseToCenter( ) {

        const threshold = 50;

        return (
            Math.abs( this.centerPos.x - this.handPos.x ) < threshold &&
            Math.abs( this.centerPos.z - this.handPos.z ) < threshold 
        )

    }

    resetRange() {

        initRange( this.handPos.x, this.range.x );
        initRange( this.handPos.y, this.range.y );
        initRange( this.handPos.z, this.range.z );

    }

    print( div ) {

        div.innerHTML =
            `
            CURRENT:<br>
            x = ${this.handPos}<br>
            y = ${this.handPos}<br>
            z = ${this.handPos}<br>
            <br>
            RANGE:<br>
            x = { min:${this.range.x[ 0 ]}, max: ${this.range.x[ 1 ]} }<br>
            y = { min:${this.range.y[ 0 ]}, max: ${this.range.y[ 1 ]} }<br>
            z = { min:${this.range.z[ 0 ]}, max: ${this.range.z[ 1 ]} }<br>
            <br>
            `;

        return div;

    }



}