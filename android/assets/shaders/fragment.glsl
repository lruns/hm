#ifdef GL_ES
precision mediump float;
#endif
varying vec4 v_color;
varying vec2 v_texCoords;
uniform sampler2D u_texture;
uniform vec2 resolution;
uniform float time;
uniform float sinX;
uniform float light;

#define TIMESCALE 0.25
#define TILES 8
#define COLOR 0.3, 1.6, 2.8

void main()
{
	vec2 uv = gl_FragCoord.xy / resolution.xy;
	uv.x *= resolution.x / resolution.y;
	
	vec4 noise = texture2D(u_texture, floor(uv * float(TILES)) / float(TILES));
	float p = 1.0 - mod(noise.r + noise.g + noise.b + time * float(TIMESCALE), 1.0);
	p = min(max(p * 3.0 - 1.8, 0.1), 2.0);
	
	vec2 r = mod(uv * float(TILES), 1.0);
	r = vec2(pow(r.x - 0.5, 2.0), pow(r.y - 0.5, 2.0));
	p *= 1.0 - pow(min(1.0, dot(r, r)), 2.0);
	
	gl_FragColor = vec4(COLOR, 1.0) * p * light;
    gl_FragColor.rg *= sinX;
}