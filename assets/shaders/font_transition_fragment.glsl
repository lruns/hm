#ifdef GL_ES
precision mediump float;
#endif
varying vec4 v_color;
varying vec2 v_texCoords;
uniform sampler2D u_texture;
uniform sampler2D u_texture1;

uniform float percent;
//uniform float time;


// -----------------------------------------------------
//  "Simple Noise Fade" by Krzysztof Kondrak @k_kondrak
// -----------------------------------------------------
/*
float r(in vec2 p)
{
    return fract(cos(p.x*42.98 + p.y*43.23) * 1127.53);
}


// using noise functions from: https://www.shadertoy.com/view/XtXXD8
float n(in vec2 p)
{
    vec2 fn = floor(p);
    vec2 sn = smoothstep(vec2(0), vec2(1), fract(p));

    float h1 = mix(r(fn), r(fn + vec2(1,0)), sn.x);
    float h2 = mix(r(fn + vec2(0,1)), r(fn + vec2(1)), sn.x);
    return mix(h1 ,h2, sn.y);
}

float noise(in vec2 p)
{
    return n(p/32.) * 0.58 +
           n(p/16.) * 0.2  +
           n(p/8.)  * 0.1  +
           n(p/4.)  * 0.05 +
           n(p/2.)  * 0.02 +
           n(p)     * 0.0125;
}
*/
// -----------------------------------------------------
//  Transition shader
// -----------------------------------------------------


void main()
{
    vec2 uv = v_texCoords;

    float freq = 3.0*sin(0.3*percent);
    vec2 warp = 0.5000*cos( uv.xy*1.0*freq + vec2(0.0,1.0) + percent ) +
               0.2500*cos( uv.yx*2.3*freq + vec2(1.0,2.0) + percent) +
               0.1250*cos( uv.xy*4.1*freq + vec2(5.0,3.0) + percent ) +
               0.0625*cos( uv.yx*7.9*freq + vec2(3.0,4.0) + percent );

	vec2 st = uv + warp*0.5*freq;

    // Time varying pixel color
    //vec3 col = 0.5 + 0.5*cos(iTime+uv.xyx+vec3(0,2,4));

   // float pct =  abs(sin(10.0 * time));


    vec4 colorA = texture2D(u_texture, st);
    vec4 colorB = texture2D(u_texture1, uv);

    // Mix uses pct (a value from 0-1) to
    // mix the two colors
    vec4 color = mix(colorA, colorB, percent);


    // fade to black
     //color =  mix(color, vec4(0), step(pct , noise(fragCoord * .4)));

    gl_FragColor = color;

}
