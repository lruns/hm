#ifdef GL_ES
precision mediump float;
#endif
varying vec4 v_color;
varying vec2 v_texCoords;
uniform sampler2D u_texture;
uniform float time;

void main()
{
	vec4 color = v_color * texture2D(u_texture, v_texCoords);
	color.r *= abs(sin(time));
    color.g *= abs(cos(time));
    color.b *= abs(sin(time) * cos(time));
    gl_FragColor = color;
}