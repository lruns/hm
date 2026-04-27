#ifdef GL_ES
precision mediump float;
#endif
uniform sampler2D u_texture;
uniform sampler2D u_texture1;
uniform vec2 resolution;
uniform float time;

varying vec4 v_color;
varying vec2 v_texCoords;

float newsmooth(float edge0, float edge1, float x){
    float t;  /* Or genDType t; */
    t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
    return t * t * (3.0 - 2.0 * t);
    }
float r(in vec2 p)
    {
    return fract(cos(p.x*42.98 + p.y*43.23) * 1127.53);
    }

    // using noise functions from: https://www.shadertoy.com/view/XtXXD8
    float n(in vec2 p)
    {
    vec2 fn = floor(p);
    vec2 sn = newsmooth(vec2(0), vec2(1), fract(p));

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


    void main() {
        vec2 uv = v_texCoords.xy/resolution.xy;

        float t = mod(time*.15, 1.2);

        // fade to black
        gl_FragColor = mix(texture2D(u_texture, uv), vec4(0), newsmooth(t + .1, t - .1, noise(p * .4)));

        // burning on the edges (when c.a < .1)
        gl_FragColor.rgb = clamp(c.rgb + step(c.a, .1) * 1.6 * noise(2000. * uv) * vec3(1.2,.5,.0), 0., 1.);

        if(gl_FragColor.a < .01)
                 c = texture(u_texture1, uv);
    }