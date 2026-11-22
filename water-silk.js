// One viewport-sized simulation supplies the moving backdrop throughout the page.
const page = document.documentElement;
const field = document.querySelector('.silk-field');
const canvas = document.getElementById('fluid');
const motion = document.querySelector('.motion');
const preference = matchMedia('(prefers-reduced-motion: reduce)');
let paused = preference.matches;

let renderer;
let handle = 0;
let last = 0;
let elapsed = 0;
let failed = false;

function updateControl() {
  const label = paused ? 'Play animation' : 'Pause animation';
  motion.textContent = label;
  page.classList.toggle('motion-paused', paused);
}

function stopRenderer() {
  failed = true;
  cancelAnimationFrame(handle);
  page.classList.remove('animated');
}

function frame(now) {
  handle = 0;
  if (paused || document.hidden || failed) return;
  if (!renderer) {
    try {
      renderer = createRenderer();
    } catch {
      stopRenderer();
      return;
    }
  }
  // Cap the simulation at 30 frames per second.
  if (now - last >= 32) {
    const dt = Math.min((now - last) / 1000, 0.04);
    elapsed += dt;
    try {
      if (renderer(dt, elapsed)) page.classList.add('animated');
    } catch {
      stopRenderer();
      return;
    }
    last = now;
  }
  handle = requestAnimationFrame(frame);
}

function sync() {
  cancelAnimationFrame(handle);
  handle = 0;
  updateControl();
  if (failed || paused || document.hidden) return;
  last = performance.now();
  handle = requestAnimationFrame(frame);
}

motion.addEventListener('click', () => {
  paused = !paused;
  sync();
});
preference.addEventListener('change', () => {
  paused = preference.matches;
  if (paused) { finishOpening(); page.classList.remove('animated'); }
  sync();
});
canvas.addEventListener('webglcontextlost', stopRenderer);
document.addEventListener('visibilitychange', sync);
const opening = document.querySelector('.opening');
function finishOpening() {
  page.classList.remove('show-opening');
}
// A slow script may arrive after the CSS reveal has already finished.
const reveal = opening?.getAnimations().find(animation => animation.animationName === 'open-silk');
if (reveal) reveal.finished.then(finishOpening, finishOpening);
else finishOpening();
for (const event of ['pointerdown', 'keydown', 'scroll']) {
  window.addEventListener(event, finishOpening, { once: true, passive: true });
}
page.classList.add('motion-enabled');
motion.hidden = false;
sync();

function createRenderer() {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false });
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) throw Error('WebGL unavailable');
  gl.getExtension('OES_texture_float_linear');
  const compiler = gl.getExtension('KHR_parallel_shader_compile');
  const linking = [];
const vertex=`#version 300 es
in vec2 a;out vec2 uv;void main(){uv=a*.5+.5;gl_Position=vec4(a,0.,1.);}`;
const prefix=`#version 300 es
precision highp float;precision highp sampler2D;in vec2 uv;out vec4 frag;
`;

function program(fragment) {
  function shader(type, code) {
    const result = gl.createShader(type);
    gl.shaderSource(result, code);
    gl.compileShader(result);
    return result;
  }
  const result = gl.createProgram();
  gl.attachShader(result, shader(gl.VERTEX_SHADER, vertex));
  gl.attachShader(result, shader(gl.FRAGMENT_SHADER, prefix + fragment));
  gl.linkProgram(result);
  linking.push(result);
  return result;
}
const advect=program(`uniform sampler2D velocity;uniform sampler2D source;uniform vec2 texel;uniform float dt;uniform float decay;void main(){vec2 coord=uv-dt*texture(velocity,uv).xy*texel;frag=texture(source,coord)*decay;}`);
const splat=program(`uniform sampler2D source;uniform vec2 point;uniform vec3 color;uniform float radius;uniform float aspect;void main(){vec2 p=uv-point;p.x*=aspect;float force=exp(-dot(p,p)/radius);frag=texture(source,uv)+vec4(color*force,0.);}`);
const curlP=program(`uniform sampler2D velocity;uniform vec2 texel;void main(){float l=texture(velocity,uv-vec2(texel.x,0)).y;float r=texture(velocity,uv+vec2(texel.x,0)).y;float b=texture(velocity,uv-vec2(0,texel.y)).x;float t=texture(velocity,uv+vec2(0,texel.y)).x;frag=vec4(.5*(r-l-t+b),0,0,1);}`);
const vortex=program(`uniform sampler2D velocity;uniform sampler2D curl;uniform vec2 texel;uniform float dt;void main(){float l=abs(texture(curl,uv-vec2(texel.x,0)).x);float r=abs(texture(curl,uv+vec2(texel.x,0)).x);float b=abs(texture(curl,uv-vec2(0,texel.y)).x);float t=abs(texture(curl,uv+vec2(0,texel.y)).x);float c=texture(curl,uv).x;vec2 f=.5*vec2(t-b,r-l);f/=length(f)+.0001;f*=5.*c;f.y*=-1.;frag=vec4(clamp(texture(velocity,uv).xy+f*dt,vec2(-900.),vec2(900.)),0,1);}`);
const divergenceP=program(`uniform sampler2D velocity;uniform vec2 texel;void main(){float l=texture(velocity,uv-vec2(texel.x,0)).x;float r=texture(velocity,uv+vec2(texel.x,0)).x;float b=texture(velocity,uv-vec2(0,texel.y)).y;float t=texture(velocity,uv+vec2(0,texel.y)).y;vec2 c=texture(velocity,uv).xy;if(uv.x<texel.x)l=-c.x;if(uv.x>1.-texel.x)r=-c.x;if(uv.y<texel.y)b=-c.y;if(uv.y>1.-texel.y)t=-c.y;frag=vec4(.5*(r-l+t-b),0,0,1);}`);
const pressureP=program(`uniform sampler2D pressure;uniform sampler2D divergence;uniform vec2 texel;void main(){float l=texture(pressure,uv-vec2(texel.x,0)).x;float r=texture(pressure,uv+vec2(texel.x,0)).x;float b=texture(pressure,uv-vec2(0,texel.y)).x;float t=texture(pressure,uv+vec2(0,texel.y)).x;float d=texture(divergence,uv).x;frag=vec4((l+r+b+t-d)*.25,0,0,1);}`);
const gradientP=program(`uniform sampler2D pressure;uniform sampler2D velocity;uniform vec2 texel;void main(){float l=texture(pressure,uv-vec2(texel.x,0)).x;float r=texture(pressure,uv+vec2(texel.x,0)).x;float b=texture(pressure,uv-vec2(0,texel.y)).x;float t=texture(pressure,uv+vec2(0,texel.y)).x;frag=vec4(texture(velocity,uv).xy-vec2(r-l,t-b),0,1);}`);
const clearP=program(`uniform sampler2D source;void main(){frag=texture(source,uv)*.75;}`);
const display=program(`uniform sampler2D dye;uniform vec2 dyeTexel;uniform float time;
vec3 spectrum(float h){vec3 p=abs(fract(vec3(h)+vec3(0.,.666667,.333333))*6.-3.);return mix(vec3(1.),clamp(p-1.,0.,1.),.94);}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
 vec3 raw=texture(dye,uv).rgb;
 vec3 d=raw*.56;
 d+=texture(dye,uv+vec2(dyeTexel.x*5.,0)).rgb*.11;
 d+=texture(dye,uv-vec2(dyeTexel.x*5.,0)).rgb*.11;
 d+=texture(dye,uv+vec2(0,dyeTexel.y*5.)).rgb*.11;
 d+=texture(dye,uv-vec2(0,dyeTexel.y*5.)).rgb*.11;
 float intensity=max(d.r,max(d.g,d.b));
 vec3 col=vec3(.007,.011,.019)+(1.-exp(-d*1.5))*.68;
 float l=length(texture(dye,uv-vec2(dyeTexel.x*2.,0)).rgb);
 float r=length(texture(dye,uv+vec2(dyeTexel.x*2.,0)).rgb);
 float b=length(texture(dye,uv-vec2(0,dyeTexel.y*2.)).rgb);
 float t=length(texture(dye,uv+vec2(0,dyeTexel.y*2.)).rgb);
 vec2 slope=vec2(r-l,t-b);
 // Close-packed elongated hexagonal scales, with tapered ends and raised keels.
 vec2 warped=uv+vec2(sin(uv.y*9.+time*.23),cos(uv.x*10.-time*.19))*.035+clamp(slope,vec2(-.7),vec2(.7))*.018;
 vec2 tiles=warped*vec2(70.,30.);
 // Two offset lattices select the nearest scale centre; the resulting cells
 // meet edge-to-edge, rather than leaving isolated rings or scalloped arcs.
 vec2 period=vec2(1.,1.30);
 vec2 a=mod(tiles,period)-period*.5;
 vec2 bb=mod(tiles-period*.5,period)-period*.5;
 vec2 cell=dot(a,a)<dot(bb,bb)?a:bb;
 vec2 q=abs(cell);
 float boundary=min(.5-q.x,(.33625-.5*q.x-.65*q.y)/.82006);
 float edgeWidth=max(fwidth(boundary),.006);
 float groove=1.-smoothstep(.006,.028+edgeWidth,boundary);
 float bevel=exp(-abs(boundary-.043)*48.);
 float dome=smoothstep(.01,.24,boundary);
 float keel=exp(-abs(cell.x)*42.)*(1.-smoothstep(.03,.42,q.y));
 float facets=.54+.46*sin(cell.x*3.8+cell.y*2.2+time*.35+warped.x*7.);
 float lit=smoothstep(.035,.55,intensity);
 float shimmer=(bevel*.32+keel*.15)*(.55+.45*facets)*lit;
 vec3 pearl=mix(normalize(d+.001),vec3(.75,.94,1.),.4);
 col+=pearl*shimmer;
 col+=pearl*dome*.075*lit;
 // Dark seams and one-sided edge shading make each scale look raised.
 col*=1.-groove*.50*lit;
 col*=1.-exp(-abs(boundary-.023)*60.)*.16*lit*(.5+.5*sign(cell.x));
 col+=pow(clamp(length(slope)*1.3,0.,1.),2.)*.06*vec3(.6,.8,1.);
 // Tiny flakes drift in layers and light up where the fluid passes beneath them.
 for(int layer=0;layer<3;layer++){
  float z=float(layer);
  vec2 field=warped*vec2(44.+z*21.,25.+z*12.);
  field+=vec2(time*(.21+z*.07),sin(time*.18+uv.x*5.)*.8+time*.06);
  vec2 id=floor(field),q=fract(field)-.5;
  float seed=hash(id+z*17.);
  q-=vec2(hash(id+3.1),hash(id+8.7))*.58-.29;
  float angle=seed*6.28+time*.16;
  q=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*q;
  float diamond=abs(q.x)*.78+abs(q.y)*1.35;
  float flake=1.-smoothstep(.018,.06+seed*.04,diamond);
  float dust=exp(-dot(q,q)*1350.);
  float flicker=.45+.55*pow(.5+.5*sin(time*1.1+seed*40.),3.);
  float visibility=smoothstep(.03,.7,intensity)*(.35+seed*.65)+.045;
  col+=(flake*.64+dust*.65)*visibility*flicker*mix(pearl,vec3(.93,.98,1.),.72);
 }
 col*=1.-.18*pow(length((uv-.5)*vec2(1.,.65)),1.4);
 float grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
 col+=(grain-.5)*.007;
 frag=vec4(col,1.);
}`);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  function texture(filter) {
    const result = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, result);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return result;
  }
  function target(w, h, filter = gl.LINEAR) {
    const tex = texture(filter);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw Error('Incomplete buffer');
    return { tex, fbo, w, h };
  }
  function pair(w, h) {
    return { read: target(w, h), write: target(w, h), swap() { [this.read, this.write] = [this.write, this.read]; } };
  }
  const sw = 192, sh = 108, dw = 640, dh = 360;
  const velocity = pair(sw, sh), dye = pair(dw, dh), pressure = pair(sw, sh);
  const curl = target(sw, sh, gl.NEAREST), divergence = target(sw, sh, gl.NEAREST);
  const locations = new Map();
  function draw(p, output, values) {
    gl.useProgram(p);
    if (!locations.has(p)) {
      const uniforms = {};
      for (const name of Object.keys(values)) uniforms[name] = gl.getUniformLocation(p, name);
      const attribute = gl.getAttribLocation(p, 'a');
      gl.enableVertexAttribArray(attribute);
      gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
      locations.set(p, uniforms);
    }
    let unit = 0;
    for (const [name, value] of Object.entries(values)) {
      const loc = locations.get(p)[name];
      if (value.tex) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, value.tex);
        gl.uniform1i(loc, unit++);
      } else if (Array.isArray(value)) {
        if (value.length === 2) gl.uniform2f(loc, ...value);
        else gl.uniform3f(loc, ...value);
      } else gl.uniform1f(loc, value);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, output?.fbo ?? null);
    gl.viewport(0, 0, output?.w ?? canvas.width, output?.h ?? canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  function resize() {
    const bounds = field.getBoundingClientRect();
    const scale = Math.min(devicePixelRatio, 1.5, 1920 / bounds.width);
    canvas.width = Math.round(bounds.width * scale);
    canvas.height = Math.round(bounds.height * scale);
  }
  resize();
  new ResizeObserver(resize).observe(field);
  function inject(x, y, dx, dy, color, radius) {
    draw(splat, velocity.write, { source: velocity.read, point: [x, y], color: [dx, dy, 0], radius, aspect: 16/9 });
    velocity.swap();
    draw(splat, dye.write, { source: dye.read, point: [x, y], color, radius: radius * .68, aspect: 16/9 });
    dye.swap();
  }
  const palette = [[.03,.72,.8],[.06,.26,.95],[.47,.12,.9],[.83,.12,.48],[.9,.46,.12],[.03,.72,.8]];
  function rainbow(hue, amount) {
    const index = (hue % 1) * (palette.length - 1);
    const i = Math.floor(index), f = index - i;
    return palette[i].map((v, j) => (v * (1-f) + palette[i+1][j] * f) * amount);
  }
  const streams = [];
  let pointer = null, previous = null;
  window.addEventListener('pointermove', event => {
    const rect = field.getBoundingClientRect();
    pointer = { x: (event.clientX - rect.left) / rect.width, y: 1 - (event.clientY - rect.top) / rect.height };
  });
  window.addEventListener('pointerleave', () => { pointer = previous = null; });
  const texel = [1/sw, 1/sh];
  return function render(dt, t) {
    if (linking.length) {
      if (compiler && linking.some(p => !gl.getProgramParameter(p, compiler.COMPLETION_STATUS_KHR))) return false;
      for (const p of linking) {
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(p));
      }
      linking.length = 0;
    }
    if (pointer && previous && pointer !== previous) {
      inject(pointer.x, pointer.y, (pointer.x-previous.x)*sw*5, (pointer.y-previous.y)*sh*5, rainbow(t*.09,.7), .003);
    }
    previous = pointer;
    for (let j = 0; j < 3; j++) {
      const a = t * (.37 + j * .055) + j * 2.0944;
      const x = .5 + (.30 + .05 * Math.sin(t*.21+j)) * Math.cos(a);
      const y = .49 + .30 * Math.sin(a*1.24+j*.35);
      const prev = streams[j] ?? { x, y };
      inject(x, y, (x-prev.x)*sw*13, (y-prev.y)*sh*13, rainbow(j/3+t*.027,.23), .0022+.0007*Math.sin(a)**2);
      streams[j] = { x, y };
    }
    draw(curlP, curl, { velocity: velocity.read, texel });
    draw(vortex, velocity.write, { velocity: velocity.read, curl, texel, dt });
    velocity.swap();
    draw(divergenceP, divergence, { velocity: velocity.read, texel });
    draw(clearP, pressure.write, { source: pressure.read });
    pressure.swap();
    for (let i = 0; i < 16; i++) {
      draw(pressureP, pressure.write, { pressure: pressure.read, divergence, texel });
      pressure.swap();
    }
    draw(gradientP, velocity.write, { pressure: pressure.read, velocity: velocity.read, texel });
    velocity.swap();
    draw(advect, velocity.write, { velocity: velocity.read, source: velocity.read, texel, dt, decay: Math.exp(-dt*.35) });
    velocity.swap();
    draw(advect, dye.write, { velocity: velocity.read, source: dye.read, texel, dt, decay: Math.exp(-dt*.86) });
    dye.swap();
    draw(display, null, { dye: dye.read, dyeTexel: [1/dw,1/dh], time: t });
    return true;
  };
}
