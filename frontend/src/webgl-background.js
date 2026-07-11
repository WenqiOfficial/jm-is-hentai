/**
 * WebGL Fluid Gradient Background
 * 
 * Uses WebGL 1.0 Fragment Shader for maximum compatibility.
 * Renders soft, organic fluid gradient blobs that drift slowly.
 * Supports dynamic color updates with smooth internal interpolation.
 * Falls back to CSS gradient animation if WebGL is unavailable.
 * 
 * Performance strategy (per STYLE.md):
 * - Frame rate capped at ~30fps
 * - Render resolution at 0.5x device pixel ratio
 * - Pauses when tab is not visible (visibilitychange)
 * - Uses WebGL 1.0 only (no WebGL 2.0 features)
 */

const VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision mediump float;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform vec3 u_color1;
uniform vec3 u_color2;
uniform vec3 u_color3;

// Simple value noise for organic texture
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f); // smoothstep

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  float t = u_time * 0.12;

  // Three organically drifting blob centers
  vec2 p1 = vec2(0.35 + 0.25 * sin(t * 0.7 + 1.0), 0.45 + 0.25 * cos(t * 0.5));
  vec2 p2 = vec2(0.65 + 0.25 * cos(t * 0.6 + 2.0), 0.35 + 0.25 * sin(t * 0.8 + 0.5));
  vec2 p3 = vec2(0.50 + 0.20 * sin(t * 0.5 + 3.0), 0.65 + 0.20 * cos(t * 0.7 + 1.5));

  // Gaussian-like distance weights (soft, no hard edges)
  float d1 = length(uv - p1);
  float d2 = length(uv - p2);
  float d3 = length(uv - p3);

  // Organic pulsing per blob
  float pulse1 = 0.9 + 0.1 * sin(t * 1.5);
  float pulse2 = 0.9 + 0.1 * cos(t * 1.3 + 1.0);
  float pulse3 = 0.9 + 0.1 * sin(t * 1.1 + 2.0);

  float w1 = exp(-d1 * d1 * 6.0) * pulse1;
  float w2 = exp(-d2 * d2 * 6.0) * pulse2;
  float w3 = exp(-d3 * d3 * 6.0) * pulse3;

  // Subtle mouse light follow
  vec2 mouseUV = u_mouse / u_resolution;
  float dm = length(uv - mouseUV);
  float wm = exp(-dm * dm * 8.0) * 0.2;

  // Warm white base to prevent dark spots
  vec3 baseColor = vec3(0.97, 0.98, 0.99);
  float baseWeight = 0.15;

  float total = w1 + w2 + w3 + wm + baseWeight + 0.001;
  vec3 color = (w1 * u_color1 + w2 * u_color2 + w3 * u_color3 + wm * u_color1 + baseWeight * baseColor) / total;

  // Subtle noise texture for organic feel
  float n = noise(uv * 3.0 + t * 0.3) * 0.03;
  color += n;

  // Gentle vignette for depth
  float vignette = 1.0 - 0.12 * length(uv - 0.5);
  color *= vignette;

  gl_FragColor = vec4(color, 0.75);
}
`;

export class WebGLBackground {
  constructor(container) {
    this.container = container;
    this.canvas = null;
    this.gl = null;
    this.program = null;
    this.animFrameId = null;
    this.lastFrameTime = 0;
    this.frameInterval = 1000 / 30; // 30fps cap
    this.startTime = Date.now();
    this.isRunning = false;

    // Colors in normalized [0,1] range
    this.currentColors = {
      color1: [0.655, 0.780, 0.906], // #A7C7E7 Baby Blue
      color2: [1.000, 0.718, 0.698], // #FFB7B2 Pastel Pink
      color3: [0.992, 0.992, 0.588], // #FDFD96 Pastel Yellow
    };
    this.targetColors = {
      color1: [...this.currentColors.color1],
      color2: [...this.currentColors.color2],
      color3: [...this.currentColors.color3],
    };

    this.mousePos = { x: 0, y: 0 };
    this.uniforms = {};

    this.initialized = this._init();
  }

  _init() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'webgl-canvas';
    this.container.appendChild(this.canvas);

    // Force WebGL 1.0 for maximum compatibility
    this.gl = this.canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      powerPreference: 'low-power',
    });

    if (!this.gl) {
      console.warn('WebGL not available, CSS fallback will be used.');
      this.canvas.remove();
      return false;
    }

    // Hide the CSS fallback gradient
    const cssFallback = this.container.querySelector('.fluid-gradient');
    if (cssFallback) cssFallback.style.display = 'none';

    // Compile shaders
    const vs = this._compileShader(this.gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = this._compileShader(this.gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) {
      console.warn('Shader compilation failed, CSS fallback will be used.');
      this.canvas.remove();
      if (cssFallback) cssFallback.style.display = '';
      return false;
    }

    this.program = this.gl.createProgram();
    this.gl.attachShader(this.program, vs);
    this.gl.attachShader(this.program, fs);
    this.gl.linkProgram(this.program);

    if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
      console.error('Shader program link failed:', this.gl.getProgramInfoLog(this.program));
      this.canvas.remove();
      if (cssFallback) cssFallback.style.display = '';
      return false;
    }

    this.gl.useProgram(this.program);

    // Full-screen quad geometry (2 triangles via triangle strip)
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);

    const posLoc = this.gl.getAttribLocation(this.program, 'a_position');
    this.gl.enableVertexAttribArray(posLoc);
    this.gl.vertexAttribPointer(posLoc, 2, this.gl.FLOAT, false, 0, 0);

    // Cache uniform locations
    this.uniforms = {
      time: this.gl.getUniformLocation(this.program, 'u_time'),
      resolution: this.gl.getUniformLocation(this.program, 'u_resolution'),
      mouse: this.gl.getUniformLocation(this.program, 'u_mouse'),
      color1: this.gl.getUniformLocation(this.program, 'u_color1'),
      color2: this.gl.getUniformLocation(this.program, 'u_color2'),
      color3: this.gl.getUniformLocation(this.program, 'u_color3'),
    };

    this._resize();
    this._bindEvents();
    this.start();

    return true;
  }

  _compileShader(type, source) {
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  _resize() {
    if (!this.canvas || !this.gl) return;
    // Render at reduced resolution (0.5x) for performance — 
    // soft gradients don't need full resolution
    const scale = Math.min(window.devicePixelRatio || 1, 1.5) * 0.5;
    const w = Math.floor(this.canvas.clientWidth * scale);
    const h = Math.floor(this.canvas.clientHeight * scale);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.gl.viewport(0, 0, w, h);
    }
  }

  _bindEvents() {
    // Resize handler
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => this._resize(), 100);
    });

    // Mouse tracking for subtle light follow
    document.addEventListener('mousemove', (e) => {
      const scale = Math.min(window.devicePixelRatio || 1, 1.5) * 0.5;
      this.mousePos.x = e.clientX * scale;
      this.mousePos.y = (window.innerHeight - e.clientY) * scale; // Flip Y for GL coords
    });

    // Pause rendering when tab not visible (per STYLE.md)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stop();
      } else {
        this.start();
      }
    });
  }

  _render(timestamp) {
    if (!this.isRunning) return;

    this.animFrameId = requestAnimationFrame((t) => this._render(t));

    // Frame rate limiting to ~30fps
    if (timestamp - this.lastFrameTime < this.frameInterval) return;
    this.lastFrameTime = timestamp;

    // Smooth color interpolation (exponential ease-out)
    const lerpSpeed = 0.04;
    for (const key of ['color1', 'color2', 'color3']) {
      for (let i = 0; i < 3; i++) {
        this.currentColors[key][i] +=
          (this.targetColors[key][i] - this.currentColors[key][i]) * lerpSpeed;
      }
    }

    const elapsed = (Date.now() - this.startTime) / 1000;

    this.gl.uniform1f(this.uniforms.time, elapsed);
    this.gl.uniform2f(this.uniforms.resolution, this.canvas.width, this.canvas.height);
    this.gl.uniform2f(this.uniforms.mouse, this.mousePos.x, this.mousePos.y);
    this.gl.uniform3fv(this.uniforms.color1, this.currentColors.color1);
    this.gl.uniform3fv(this.uniforms.color2, this.currentColors.color2);
    this.gl.uniform3fv(this.uniforms.color3, this.currentColors.color3);

    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.animFrameId = requestAnimationFrame((t) => this._render(t));
  }

  stop() {
    this.isRunning = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  /**
   * Smoothly transition to new colors.
   * @param {number[]} color1 - RGB [r, g, b] in 0–255 range
   * @param {number[]} color2 - RGB [r, g, b] in 0–255 range
   * @param {number[]} color3 - RGB [r, g, b] in 0–255 range
   */
  setColors(color1, color2, color3) {
    this.targetColors.color1 = color1.map((c) => c / 255);
    this.targetColors.color2 = color2.map((c) => c / 255);
    this.targetColors.color3 = color3.map((c) => c / 255);
  }

  /** Reset to default macaron palette */
  resetColors() {
    this.targetColors.color1 = [0.655, 0.780, 0.906];
    this.targetColors.color2 = [1.000, 0.718, 0.698];
    this.targetColors.color3 = [0.992, 0.992, 0.588];
  }
}
