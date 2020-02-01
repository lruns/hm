precision lowp float;

varying vec4 v_color;
varying vec2 v_texCoords;
uniform sampler2D u_texture;
uniform sampler2D u_texture1;
uniform vec2 resolution;
uniform float percent;

void main(){
            vec2 uv = gl_FragCoord.xy / resolution.xy;

            gl_FragColor = texture2D(u_texture, uv);

            //determine origin
            vec2 position = uv - vec2(0.5);

            //determine the vector length of the center position
           	position.x *= resolution.x / resolution.y;
            float len = length(position);
            float st = step(percent, len);

            if(st == 0.0){
                 gl_FragColor = texture2D(u_texture1, uv);
            }
}