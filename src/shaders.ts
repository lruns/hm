// GLSL for PixiJS v8 (Filter/GlProgram). v8 conventions: `in/out`, `texture()`,
// `out vec4 finalColor;`, the sampler is named uTexture. Pixi prepends version and
// precision itself.

// The standard Pixi v8 filter vertex shader (copied from the engine, verbatim).
export const FILTER_VERT = /* glsl */ `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition( void )
{
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord( void )
{
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void)
{
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
}
`

// Hyperjump tunnel (modelled on the Bejeweled 2 transition): radial rays run out of a
// dark wandering core hole, the color drifts along the spectrum, and at the end a white
// arrival flash. uProgress 0->1 = acceleration.
export const TUNNEL_FRAG = /* glsl */ `
in vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform highp vec4 uInputSize;
uniform highp vec4 uOutputFrame;

// ! TRAP: filter uniforms must be highp - otherwise some drivers (and always when the
// same name is declared in the vertex shader) fail with "Could not initialize shader".
uniform highp float uTime;
uniform highp float uProgress;  // 0..1
uniform highp float uAspect;
uniform highp vec3  uAccent;
uniform highp vec3  uMid;
uniform highp float uHue;   // 0..1 - hue of the world the tunnel drifts around
uniform highp float uBurst; // vibe.portalBurst flag: 1 - burst on, 0 - frame as before it existed

out vec4 finalColor;

float hash(float n){ return fract(sin(n * 127.1) * 43758.5453); }

void main(void)
{
    vec2 uv = vTextureCoord * uInputSize.xy / uOutputFrame.zw;
    vec2 p = uv - 0.5;
    p.x *= uAspect;
    // the core hole wanders a little - keeps the flight alive (as in the original)
    p += 0.05 * vec2(sin(uTime * 1.7), cos(uTime * 1.3)) * (1.0 - uProgress * 0.7);

    float r = length(p);
    float a = atan(p.y, p.x);

    float speed = 2.0 + uProgress * 7.0;
    // thin radial rays: a narrow line inside each angular segment
    float segs = 240.0;
    float sa = (a / 6.2831853 + 0.5) * segs;
    float seg = floor(sa);
    float h = hash(seg);
    float line = smoothstep(0.5, 0.08, abs(fract(sa) - 0.5));
    // long dashes running outwards (motion-blur warp lines)
    float dash = pow(fract(r * 1.6 - uTime * speed * (0.6 + 0.4 * h) - h * 7.0), 2.0);
    float rayI = line * dash * (0.25 + 0.75 * hash(seg + 41.0)) * smoothstep(0.03, 0.35, r);

    // TUNNEL COLOR ("palette of the moment", as in Tetris Effect): the spectrum used
    // to cycle the whole circle every ~0.9s - eye-stabbing. Now a narrow corridor of
    // +-0.09 of a turn around the world hue (uHue), a slow drift plus 22% desaturation:
    // the tunnel stays ONE gamut instead of a rainbow
    float hue = uHue + 0.09 * sin(uTime * 0.55 + r * 2.2 + h * 0.35);
    vec3 spectral = 0.5 + 0.5 * cos(6.2831853 * (hue + vec3(0.0, 0.33, 0.67)));
    spectral = mix(vec3(dot(spectral, vec3(0.299, 0.587, 0.114))), spectral, 0.78);
    // the rays are white-cyan over the spectral field (their warp lines)
    vec3 rayCol = mix(vec3(0.75, 0.95, 1.0), vec3(1.0), 0.5 + 0.5 * sin(uTime * 3.0));
    vec3 col = rayCol * rayI * 0.9;
    col += spectral * rayI * (0.55 + uProgress * 0.5);
    // the filled field: faint spectral haze between the rays (purple/magenta in the original)
    col += mix(uMid, spectral, 0.6) * 0.10 * smoothstep(0.05, 0.5, r);

    // spiral iridescent core: a small vortex inside a white halo ring
    float swirl = a + 22.0 * r - uTime * 6.0;
    float coreSwirl = smoothstep(0.16, 0.02, r) * (0.5 + 0.5 * sin(swirl * 3.0));
    col += spectral * coreSwirl * 1.2;

    // concentric pulse ring (a shock wave at mid radius)
    float ringR = fract(uTime * 0.9) * 0.9 + 0.1;
    float ring = smoothstep(0.05, 0.0, abs(r - ringR)) * (1.0 - ringR) * 0.8;
    col += (vec3(0.8) + spectral * 0.4) * ring;

    // dark hole with a bright rim
    float holeR = 0.10 + 0.03 * sin(uTime * 2.0);
    float hole = smoothstep(holeR * 0.55, holeR * 1.7, r);
    float rim = smoothstep(holeR * 0.5, holeR * 1.2, r) * smoothstep(holeR * 2.6, holeR * 1.2, r);
    col = col * hole + (uAccent * 0.7 + vec3(0.45)) * rim * 0.7;

    // ── PORTAL BURST (flag portalBurst) ───────────────────────────────────
    // The tunnel eclipse before arrival blooms into a violet-white STAR: the window
    // lives only at the end of the flight (0.72..0.95 of the acceleration, fading by
    // 1.0), 12 long rays + a growing core. uBurst=0 multiplies it all by zero.
    float burst = smoothstep(0.72, 0.95, uProgress) * smoothstep(1.0, 0.90, uProgress) * uBurst;
    if (burst > 0.001) {
        vec3 violet = vec3(0.72, 0.42, 1.0);
        // abs(cos) - 12 petals. abs, not bare cos: pow() of a negative base is
        // undefined in GLSL (we would get NaN holes).
        float rays = pow(abs(cos(a * 6.0)), 40.0) * smoothstep(1.15, 0.04, r);
        col += mix(violet, vec3(1.0), 0.55) * rays * burst * 2.6;
        float coreR = 0.05 + 0.22 * burst;              // the core GROWS with the flash
        col += mix(violet, vec3(1.0), 0.75) * smoothstep(coreR, 0.0, r) * burst * 2.2;
        col += violet * exp(-r * 3.2) * burst * 0.55;   // violet breathing around it
    }

    // white arrival flash at the very end
    col += vec3(1.0) * smoothstep(0.9, 1.0, uProgress) * max(0.0, 1.15 - r);

    float alpha = clamp(max(max(col.r, col.g), col.b), 0.0, 1.0);
    finalColor = vec4(col, alpha);
}
`

// Portal vortex: polar swirl + spiral rings + a white core.
// uProgress 0->1 drives the acceleration and the pull-in.
export const PORTAL_FRAG = /* glsl */ `
in vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform highp vec4 uInputSize;
uniform highp vec4 uOutputFrame;

// highp - the same trap as in the tunnel (see the comment above)
uniform highp float uTime;
uniform highp float uProgress;  // 0..1
uniform highp float uAspect;
uniform highp vec3  uAccent;
uniform highp vec3  uMid;
uniform highp float uBurst;     // vibe.portalBurst flag

out vec4 finalColor;

void main(void)
{
    // the filter texture is padded larger than the frame - normalize to the visible
    // area, otherwise the center (0.5) drifts into a corner
    vec2 uv = vTextureCoord * uInputSize.xy / uOutputFrame.zw;
    vec2 p = uv - 0.5;
    p.x *= uAspect;

    float r = length(p);
    float a = atan(p.y, p.x);

    // the closer to the center and the further along the progress, the stronger the swirl
    float swirl = a + (0.6 / (r + 0.12)) * (0.8 + uProgress * 3.5) + uTime * 1.2;

    // spiral arms
    float arms = sin(swirl * 3.0 - r * 22.0 + uTime * 4.0) * 0.5 + 0.5;
    float rings = sin(r * 40.0 - uTime * 6.0 - uProgress * 10.0) * 0.5 + 0.5;

    // the core grows with progress: small at first (arms visible), it swallows the screen at the end
    float coreR = 0.16 + uProgress * uProgress * 0.55;
    float core = smoothstep(coreR, 0.0, r) * (0.6 + uProgress * 1.4);
    float body = arms * rings * smoothstep(0.8, 0.03, r);

    vec3 col = mix(uMid, uAccent, arms);
    col += vec3(1.0) * core;
    col *= (0.5 + body * 2.2 + core * 1.3);

    // vignette at the edges so the vortex lives in the center
    float vig = smoothstep(0.95, 0.25, r);

    // ── PORTAL BURST (flag portalBurst) - the same as in the tunnel, but the window
    // is later: the vortex explodes when the core has almost swallowed the screen
    // (uProgress > 0.8). The term is added ON TOP of the vignette, otherwise its edge
    // would cut the long rays. uBurst = 0 -> exactly the previous frame.
    float burst = smoothstep(0.80, 0.96, uProgress) * smoothstep(1.0, 0.92, uProgress) * uBurst;
    vec3 burstCol = vec3(0.0);
    float burstA = 0.0;
    if (burst > 0.001) {
        vec3 violet = vec3(0.72, 0.42, 1.0);
        float rays = pow(abs(cos(a * 6.0)), 40.0) * smoothstep(1.15, 0.04, r);
        float coreI = smoothstep(0.05 + 0.22 * burst, 0.0, r);
        burstCol = mix(violet, vec3(1.0), 0.55) * rays * burst * 2.6
                 + mix(violet, vec3(1.0), 0.75) * coreI * burst * 2.2
                 + violet * exp(-r * 3.2) * burst * 0.55;
        burstA = clamp((rays * 1.4 + coreI) * burst, 0.0, 1.0);
    }

    float alpha = clamp((body * 1.6 + core * 1.2) * vig + burstA, 0.0, 1.0);

    finalColor = vec4(col * vig + burstCol, alpha);
}
`

// The disc as a faceted gem (material taken from the Bejeweled 2 analysis):
// a white specular hotspot up-left, gradient bevels (light from the upper left ->
// shadow to the lower right), a dark outline for readability, a saturated shadow side
// and a rare idle glint as a 4-ray star (uGlint from the engine).
//
// Fixed against live WebGL: an earlier version built the body from uDeep (uDeep*0.30 in
// the core!) and darkened the center by 42% - in real WebGL that read as a BLACK HOLE
// with a bright rim, the number hanging in emptiness. The light direction was wrong: a
// Bejeweled gem glows FROM THE INSIDE. So the material is built from uMid/uAccent: the
// wall is the saturated mid tone of the world, the heart is LIGHTER than the wall (light
// gathers in the core), with soft caustic veins on top. The number lies on a glowing
// bed; readability comes not from darkness but from contrast (white number + dark text
// outline in the engine) and a moderate core lightness (~0.35-0.5, not white).
export const GEM_FRAG = /* glsl */ `
in vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform highp vec4 uInputSize;
uniform highp vec4 uOutputFrame;

uniform float uTime;
uniform float uGlint;      // 0..1 idle glint flash (the engine fades it itself)
uniform vec2  uGlintPos;   // where it sparkles (in p coordinates, -0.5..0.5)
uniform float uPulse;      // 0..1 breathing
uniform vec3  uDeep;
uniform vec3  uMid;
uniform vec3  uAccent;

out vec4 finalColor;

void main(void)
{
    vec2 uv = vTextureCoord * uInputSize.xy / uOutputFrame.zw;
    vec2 p = uv - 0.5;           // the sprite is square: aspect 1
    float r = length(p) * 2.08;  // 1.0 at the disc edge (a little slack for the outline)
    float a = atan(p.y, p.x);

    // transparent outside the disc
    float mask = smoothstep(1.0, 0.965, r);

    // ── GLASS GLOWING FROM THE INSIDE ──────────────────────────────────────
    // The body is built FROM THE LIGHT: the wall is the saturated mid tone of the
    // world, the heart is lighter (light gathers in the core of the lens), and towards
    // the very center a soft subsurface glow is added - the bed under the number,
    // breathing with the pulse.
    vec2 lightDir = normalize(vec2(-0.6, -0.8));
    float rc = min(r, 1.0);
    float shade = dot(normalize(p + vec2(1e-5)), lightDir) * rc;
    float depth = 1.0 - rc * rc;                 // 1 in the center -> 0 at the wall
    vec3 wall  = mix(uDeep, uMid, 0.62);         // at the wall: the world tone, not blackness
    // The heart keeps the HUE OF THE MID tone, lightened towards white instead of
    // being mixed with the accent: in warm worlds the accent is complementary to the
    // mid (rose + gold) and their mix produced a dirty brick-lettuce color. The accent
    // arrives only as light - glow, caustics, rim.
    vec3 heart = mix(uMid, vec3(1.0), 0.18) * 0.72;
    vec3 body = mix(wall, heart, pow(depth, 0.75));
    // inner glow under the number (Bejeweled: the gem glows FROM THE INSIDE)
    body += mix(uMid, uAccent, 0.40) * exp(-r * r * 2.4) * (0.18 + 0.05 * uPulse);
    // soft shading (not a gouache ball): only +-16%
    body *= 1.0 + shade * 0.16;

    // ── CAUSTICS: slow veins of light inside the glass ──────────────────────
    // The product of two angular waves raised to a power gives rare narrow veins; the
    // mask keeps them in the 0.28..0.92 ring, so the center (under the number) is clean.
    float w1 = sin(a * 3.0 + r * 7.0 - uTime * 0.55);
    float w2 = sin(a * 2.0 - r * 11.0 + uTime * 0.40);
    float cau = pow(max(0.0, w1 * w2), 4.0);
    float cauMask = smoothstep(0.28, 0.62, r) * smoothstep(0.95, 0.80, r);
    body += mix(uAccent, vec3(1.0), 0.30) * cau * cauMask * 0.30;

    // ── BEVELS: narrower and softer ───────────────────────────────────────
    // Was: 12 sectors by floor() - hard petal-like facets across the whole disc
    // (0.66..0.985). Now: 18 narrow bevels ONLY at the very edge (0.84..0.99), and the
    // light between neighbouring facets is INTERPOLATED - the seam does not cut the
    // eye, it reads as cut glass instead of a star.
    float band = smoothstep(0.84, 0.905, r) * smoothstep(0.995, 0.955, r);
    float N = 18.0;
    float sa = (a / 6.2831853 + 0.5) * N;
    float fi = floor(sa);
    float ff = fract(sa);
    // normals of the neighbouring facets + a smooth transition between them
    float fa0 = (fi + 0.5) / N * 6.2831853 - 3.14159265;
    float fa1 = (fi + 1.5) / N * 6.2831853 - 3.14159265;
    float lit0 = 0.5 + 0.5 * dot(vec2(cos(fa0), sin(fa0)), lightDir);
    float lit1 = 0.5 + 0.5 * dot(vec2(cos(fa1), sin(fa1)), lightDir);
    float lit = mix(lit0, lit1, smoothstep(0.28, 0.72, ff));
    // slope: the outer edge of a bevel is darker
    float bevel = smoothstep(0.88, 0.985, r);
    vec3 facet = mix(uMid * 0.78, uAccent * 0.92, lit) * (1.0 - bevel * 0.28);
    facet += vec3(1.0) * pow(lit, 9.0) * 0.22; // highlight only on the brightest ones
    vec3 col = mix(body, facet, band * 0.85);   // the bevel is blended in, it does not replace

    // ── RIM LIGHT: a thin glowing edge (glass catches the light) ───────────
    // A narrow line at the very edge: brighter on the light side, but never fully off -
    // that is exactly what the edge of a glass lens looks like.
    float rimBand = smoothstep(0.945, 0.985, r) * smoothstep(1.0, 0.986, r);
    float rimLit = 0.35 + 0.65 * (0.5 + 0.5 * dot(normalize(p + vec2(1e-5)), lightDir));
    col += mix(uAccent, vec3(1.0), 0.55) * rimBand * rimLit * 1.25;

    // dark outline along the silhouette (readable on any background) - thinner, so it
    // does not eat the new rim
    float outline = smoothstep(0.972, 0.998, r) * mask;
    col = mix(col, uDeep * 0.18, outline * 0.8);

    // ── SPECULAR: smaller and sharper (it used to be a smeared plastic halo) ─
    // It matters not only to shrink it but to remove the PLATEAU: the old smoothstep
    // gave a flat milky spot with a visible border - that is what read as plastic.
    // pow(smoothstep) is an honest gradient that fades towards the edge.
    vec2 sp = (p - vec2(-0.165, -0.215)) * vec2(1.9, 3.0);
    float sd = length(sp);
    col += vec3(1.0) * pow(smoothstep(0.26, 0.0, sd), 2.0) * 0.16; // soft halo
    col += vec3(1.0) * smoothstep(0.052, 0.006, sd) * 0.85;        // sharp core
    // faint reflection of the world from below (candy gloss) - a gradient too, not a spot
    vec2 rp = (p - vec2(0.05, 0.30)) * vec2(1.3, 2.2);
    col += uAccent * pow(smoothstep(0.55, 0.0, length(rp)), 2.0) * 0.11;

    // number protector: a light lens darkening in the core. It used to be 42% - that
    // is exactly what made the "hole". 18% is enough: a white number with a dark
    // outline reads over the glowing bed and the gem stays a gem.
    col *= 1.0 - smoothstep(0.60, 0.0, r) * (0.18 - uPulse * 0.04);

    // idle glint: a white 4-ray star (a cross with a hot core), warm rim
    vec2 gp = p - uGlintPos;
    float star = exp(-abs(gp.x) * 70.0) * exp(-abs(gp.y) * 16.0)
               + exp(-abs(gp.y) * 70.0) * exp(-abs(gp.x) * 16.0);
    star += exp(-length(gp) * 30.0) * 1.4;
    col += mix(vec3(1.0, 0.99, 0.88), vec3(1.0), 0.6) * star * uGlint * 0.9;

    finalColor = vec4(col * mask, mask);
}
`

// Flow threads: a vertical shader river THROUGH the disc (his signature 2017 threads,
// done in a modern way). A ribbon with flow distortion + running droplet cores.
// uFlow (0..1 from the streak) drives width and brightness, uHush cuts it off on a
// mistake, uMult: x2 - two channels, x3 - spectrum. Without WebGL the fallback is the
// storm particles.
export const FLOW_FRAG = /* glsl */ `
in vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform highp vec4 uInputSize;
uniform highp vec4 uOutputFrame;

uniform float uTime;
uniform float uFlow;    // 0..1 accumulated flow
uniform float uHush;    // 0..1 silence after a mistake - the river breaks off
uniform float uMult;    // 1 | 2 | 3
uniform vec3  uAccent;
uniform vec3  uMid;

out vec4 finalColor;

float hash(float n){ return fract(sin(n * 127.1) * 43758.5453); }

void main(void)
{
    vec2 uv = vTextureCoord * uInputSize.xy / uOutputFrame.zw;
    float x = uv.x - 0.5;       // -0.5..0.5 across the ribbon
    float y = uv.y;             // 0 top, 1 bottom

    float power = uFlow * (1.0 - uHush);
    if (power < 0.003) { finalColor = vec4(0.0); return; }

    vec3 col = vec3(0.0);
    float lanes = uMult >= 2.0 ? 2.0 : 1.0;
    for (float li = 0.0; li < 2.0; li++) {
        if (li >= lanes) break;
        float lane = lanes < 2.0 ? 0.0 : (li * 2.0 - 1.0) * 0.16;
        // flow distortion: the channel wanders by sines over height and time
        float wob = sin(y * 7.0 - uTime * 2.1 + li * 2.7) * 0.045
                  + sin(y * 13.0 + uTime * 1.3 + li * 5.1) * 0.02;
        float dx = x - lane - wob * (0.5 + power);
        // ribbon: soft glow of the channel, the width grows with the flow
        float w = 0.035 + 0.075 * power;
        float ribbon = exp(-dx * dx / (w * w));
        // droplet cores: rows run UPWARDS, each with its own offset and flicker
        float rows = 14.0;
        float yy = y * rows + uTime * (3.2 + power * 2.5) + li * 3.3;
        float cell = floor(yy);
        float f = fract(yy) - 0.5;
        float cx = (hash(cell + li * 91.0) - 0.5) * 0.10;
        float dcx = dx - cx;
        float core = exp(-dcx * dcx / 0.0009) * exp(-f * f / 0.02)
                   * (0.55 + 0.45 * hash(cell + 7.0));
        vec3 laneCol = mix(uMid, uAccent, 0.65);
        if (uMult >= 3.0) {
            // x3: not a rainbow around the whole circle but ONE gamut of the world -
            // a slow drift deep -> accent -> white along the channel
            float d = 0.5 + 0.5 * sin(y * 2.2 + uTime * 0.7 + li * 1.3);
            laneCol = mix(mix(uMid, uAccent, 0.55), vec3(1.0), 0.12 + 0.48 * d);
        }
        col += laneCol * ribbon * (0.16 + 0.30 * power);
        col += mix(laneCol, vec3(1.0), 0.75) * core * (0.5 + 0.6 * power);
    }
    // dissolve towards the top and bottom edges
    float fade = smoothstep(0.0, 0.12, y) * smoothstep(1.0, 0.88, y);
    col *= fade;
    float alpha = clamp(max(max(col.r, col.g), col.b), 0.0, 1.0);
    finalColor = vec4(col, alpha);
}
`
