/**
 * The vortex behind a summoned creature (as on the cards' back): bright arms coiling in to a dark eye, in the
 * creature's colors, soft (it lies under its aura). A WebGL shader on a canvas; `draw(ms)` paints it at that moment of
 * the summon: it opens once the creature is there and closes into its eye before the creature goes.
 */
export interface SummonVortex {
  draw(ms: number): void;
  destroy(): void;
}

const VERTEX = 'attribute vec2 p; varying vec2 uv; void main(){ uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0., 1.); }';
const FRAGMENT = `precision mediump float;
varying vec2 uv;
uniform vec2 size;
uniform float t, open, strength;
uniform vec3 c1, c2;
void main(){
  vec2 q = (uv - vec2(0.5, 0.55)) * vec2(size.x / size.y, 1.0);
  float r = length(q) / max(open, 0.001);
  float a = atan(q.y, q.x);
  float spin = t * 0.9 + (1.0 - open) * 6.0;
  float arms = sin(a * 5.0 + log(r + 0.02) * 5.5 - spin);
  float band = smoothstep(-0.1, 0.9, arms);
  float body = smoothstep(0.62, 0.12, r);
  float eye = smoothstep(0.16, 0.0, r);
  vec3 col = mix(c2 * 0.35, c1, band * 0.85);
  col = mix(col, vec3(0.02, 0.03, 0.08), eye * 0.85);
  float haze = smoothstep(0.9, 0.3, r) * 0.35;
  float alpha = clamp(body * (0.35 + band * 0.65) + haze, 0.0, 1.0) * open * strength;
  gl_FragColor = vec4(col * (0.55 + band * 0.6 * strength) + c2 * haze, alpha);
}`;

/** `rgb(r g b)` → [0..1]×3. */
function channels(css: string): [number, number, number] {
  const [r, g, b] = (css.match(/\d+/g) ?? ['200', '200', '200']).map(Number);
  return [r / 255, g / 255, b / 255];
}

/**
 * Draws the vortex on `canvas` with the colors `main` and `second`; null where WebGL is not there (no vortex then).
 * `hold`: how long the creature stays (ms), `openAt`/`openFor`/`closeFor`: when it opens and how long it takes.
 */
export function summonVortex(
  canvas: HTMLCanvasElement,
  main: string,
  second: string,
  timing: { hold: number; openAt: number; openFor: number; closeFor: number },
): SummonVortex | null {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: false, alpha: true });
  if (!gl) return null;
  const shader = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const program = gl.createProgram()!;
  gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const at = gl.getAttribLocation(program, 'p');
  gl.enableVertexAttribArray(at);
  gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
  gl.uniform3fv(gl.getUniformLocation(program, 'c1'), channels(main));
  gl.uniform3fv(gl.getUniformLocation(program, 'c2'), channels(second));
  gl.uniform1f(gl.getUniformLocation(program, 'strength'), 0.55);
  const uSize = gl.getUniformLocation(program, 'size');
  const uTime = gl.getUniformLocation(program, 't');
  const uOpen = gl.getUniformLocation(program, 'open');
  return {
    draw(ms: number) {
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
      const kin = Math.min(1, Math.max(0, (ms - timing.openAt) / timing.openFor));
      const kout = Math.min(1, Math.max(0, (ms - (timing.hold - timing.closeFor - 200)) / timing.closeFor));
      gl.uniform2f(uSize, canvas.width, canvas.height);
      gl.uniform1f(uTime, ms / 1000);
      gl.uniform1f(uOpen, (1 - Math.pow(1 - kin, 3)) * (1 - kout * kout));
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    destroy() {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
