#ifdef GL_ES
precision mediump float;
#endif
#define M_PI 3.141592653589
uniform sampler2D u_texture;
uniform vec2 u_center;
uniform float u_radius;
uniform float u_width;
uniform float u_opening;
uniform vec3 u_color;

varying vec4 v_color;
varying vec2 v_texCoords;

const float smoothing = 1.0/32.0;

float newsmooth(float edge0, float edge1, float x){
    float t;  /* Or genDType t; */
    t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
    return t * t * (3.0 - 2.0 * t);
}
float circle(vec2 uv, float radius, float width, float opening)
{
    vec2 dist = uv-u_center;
    float r = sqrt( dot( dist, dist) );
    float angle = atan(dist.y, dist.x);
    angle = angle/(2.0*M_PI)+0.25;
    // angle = (2.0*M_PI)+0.25;
    dist= normalize(dist);
    if( fract(angle) < opening)
	    return newsmooth(radius-width/2.0, radius,r)-newsmooth(radius, radius+width/2.0,r);
    else{
        float deltaAngle = 1.0-15.0*(fract(angle) - opening);
        width *= 1.0-pow((fract(angle) - opening),2.0);
        return deltaAngle*(newsmooth(radius-width/2.0, radius,r)-newsmooth(radius, radius+width/2.0,r));
    }
}

void main()
{
	vec2 uv = gl_FragCoord.xy;
    float r = circle(uv, u_radius, u_width*0.13, u_opening);
    float r2 = circle(uv, u_radius, u_width, u_opening);
    vec3 color = vec3(r);
    color += u_color * r2;
    float a = texture2D(u_texture, v_texCoords).a*0.0 + max(r, r2);
	gl_FragColor = vec4(color, a);
}
