const vertexShader =
    `attribute float size;

    varying vec3 vColor;

    void main() {

        vColor = color;

        vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );

        gl_PointSize = size * ( 300.0 / - mvPosition.z ) ;

        gl_Position = projectionMatrix * mvPosition;

    }`;

const fragmentShader =
    `varying vec3 vColor;
    uniform sampler2D pointTexture;

    void main() {

        if ( length( gl_PointCoord - vec2( 0.5, 0.5 ) ) > 0.4) discard;

        gl_FragColor = vec4( vColor, 1.0);
        gl_FragColor = gl_FragColor * texture2D( pointTexture, gl_PointCoord );
        
    }`;

export { vertexShader, fragmentShader }