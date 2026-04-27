#ifdef GL_ES
precision mediump float;
#endif
varying vec4 v_color;
varying vec2 v_texCoords;
uniform sampler2D u_texture;
uniform vec2 resolution;
uniform vec2 position;
uniform float globalTime;
uniform float deltaX;
uniform float deltaY;

void main(){
        vec2 newFragCoord = 2.0*((gl_FragCoord.xy - position.xy)-resolution.xy*.5)/resolution.x;
        newFragCoord.x += deltaX;
        newFragCoord.y += deltaY;
    	float a = atan(newFragCoord.x, newFragCoord.y);
        float r = length(newFragCoord);
        vec2 uv = vec2(0.5*globalTime + 0.01/r, a/6.2812);
        vec3 displace = texture2D( u_texture, newFragCoord ).rba;
        displace.xy -= 0.5;
        displace.xy *= displace.z * 0.1;
        gl_FragColor = texture2D(u_texture, uv + displace.xy)/r;
        gl_FragColor.rgb *= vec3(0.3, 0.3, 1.5);
}