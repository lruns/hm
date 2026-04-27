#ifdef GL_ES
precision mediump float;
#endif

uniform sampler2D u_texture;

varying vec4 v_color;
varying vec2 v_texCoords;

const float smoothing = 1.0/32.0;

float newsmooth(float edge0, float edge1, float x){
    float t;  /* Or genDType t; */
    t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
    return t * t * (3.0 - 2.0 * t);
}

void main() {
    float distance = texture2D(u_texture, v_texCoords).a;
    float alpha = newsmooth(0.5 - smoothing, 0.5 + smoothing, distance);
    gl_FragColor = vec4(v_color.rgb, v_color.a * alpha);
}
