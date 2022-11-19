precision highp float;

uniform vec3 uColor;

varying vec3 fNormal;

void main() {
    gl_FragColor = vec4(uColor, 1);
    if(fNormal.y < 0.01)
        gl_FragColor.xyz = gl_FragColor.xyz*0.8;
}