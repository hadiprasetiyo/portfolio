/* Hero Horizon: lubang hitam WebGL (ray tracing Schwarzschild), bloom, kanvas efek benda langit, dan koreografi scroll.
   Inti kodenya diangkat apa adanya dari prototipe Horizon v61; yang ditulis baru hanya penyambungnya
   (scroll, resize, kursor, langit global). Ditulis sebagai JS biasa karena sebagian besar isinya shader dan matematika kanvas. */
import { setCursorAttractor } from './cursor';
import { clamp, smooth } from './math';
import { makeRockBody, shadeBody } from './rock';

export function startHero() {
  const root = document.documentElement;
  const app = document;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stacked = matchMedia('(max-width: 900px)');
  const skyCanvas = document.querySelector('.sky');

  const clock = app.querySelector('[data-clock]');
  const totality = app.querySelector('[data-totality]');
  const jakartaTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  let totalityStart = null;
  let lastSecond = -1;
  const tickClocks = () => {
    const second = Math.floor(Date.now() / 1000);
    if (second === lastSecond) return;
    lastSecond = second;
    clock.textContent = jakartaTime.format(new Date());
    if (totalityStart !== null) {
      const elapsed = Math.floor((Date.now() - totalityStart) / 1000);
      totality.textContent = [Math.floor(elapsed / 3600), Math.floor((elapsed % 3600) / 60), elapsed % 60].map((part) => String(part).padStart(2, '0')).join(':');
    }
  };
  tickClocks();
  const ready = () => {
    if (root.classList.contains('is-ready')) return;
    root.classList.add('is-ready');
    totalityStart = Date.now();
    setTimeout(() => root.classList.add('is-settled'), 2800);
  };

  /* ---------- korona WebGL ---------- */
  const vertexSource = 'attribute vec2 p; varying vec2 v_uv; void main() { v_uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }';
  // bloom: bagian terang diambil di resolusi seperempat (4 sampel dirata-rata supaya stabil), dikaburkan, lalu ditambahkan
  const brightSource = `
    precision mediump float;
    varying vec2 v_uv;
    uniform sampler2D u_source;
    uniform vec2 u_texel;
    void main() {
      vec3 color = (texture2D(u_source, v_uv + u_texel * vec2(-1.0, -1.0)).rgb + texture2D(u_source, v_uv + u_texel * vec2(1.0, -1.0)).rgb
        + texture2D(u_source, v_uv + u_texel * vec2(-1.0, 1.0)).rgb + texture2D(u_source, v_uv + u_texel * vec2(1.0, 1.0)).rgb) * 0.25;
      float peak = max(max(color.r, color.g), color.b);
      gl_FragColor = vec4(color * smoothstep(0.5, 0.95, peak), 1.0);
    }`;
  const blurSource = `
    precision mediump float;
    varying vec2 v_uv;
    uniform sampler2D u_source;
    uniform vec2 u_step;
    void main() {
      vec3 color = texture2D(u_source, v_uv).rgb * 0.227;
      color += (texture2D(u_source, v_uv + u_step).rgb + texture2D(u_source, v_uv - u_step).rgb) * 0.195;
      color += (texture2D(u_source, v_uv + u_step * 2.0).rgb + texture2D(u_source, v_uv - u_step * 2.0).rgb) * 0.122;
      color += (texture2D(u_source, v_uv + u_step * 3.0).rgb + texture2D(u_source, v_uv - u_step * 3.0).rgb) * 0.054;
      color += (texture2D(u_source, v_uv + u_step * 4.0).rgb + texture2D(u_source, v_uv - u_step * 4.0).rgb) * 0.016;
      gl_FragColor = vec4(color, 1.0);
    }`;
  // kilatan lensa horizontal (anamorphic): bagian terang ditarik memanjang ke kiri dan kanan; dihitung di resolusi bloom, bukan per piksel layar
  const streakSource = `
    precision mediump float;
    varying vec2 v_uv;
    uniform sampler2D u_source;
    void main() {
      vec3 streak = vec3(0.0);
      for (int i = 1; i <= 8; i++) {
        float offset = float(i) * 0.03;
        float weight = exp(-float(i) * 0.38);
        streak += (texture2D(u_source, v_uv + vec2(offset, 0.0)).rgb + texture2D(u_source, v_uv - vec2(offset, 0.0)).rgb) * weight;
      }
      gl_FragColor = vec4(streak * vec3(0.95, 0.88, 1.0) * 0.22, 1.0);
    }`;
  const combineSource = `
    precision mediump float;
    varying vec2 v_uv;
    uniform sampler2D u_scene;
    uniform sampler2D u_bloom;
    uniform sampler2D u_streakMap;
    uniform float u_strength;
    uniform float u_streak;
    uniform float u_ripple;
    uniform vec2 u_rippleCenter;
    uniform float u_aspect;
    void main() {
      // gelombang gravitasi: cincin yang melebar dari lubang hitam dan membengkokkan gambar yang dilewatinya
      vec2 uv = v_uv;
      vec2 shift = vec2(0.0);
      vec3 color = texture2D(u_scene, uv).rgb;
      if (u_ripple >= 0.0) {
        vec2 d = uv - u_rippleCenter;
        d.x *= u_aspect;
        float dist = length(d);
        float front = u_ripple * 0.75;
        float band = exp(-pow((dist - front) / 0.07, 2.0)) * exp(-u_ripple * 1.1);
        shift = (d / max(dist, 0.0001)) * sin((dist - front) * 70.0) * band * 0.014;
        shift.x /= u_aspect;
        // warna sedikit terpisah di puncak gelombang, seperti lensa yang tertekuk
        color = vec3(texture2D(u_scene, uv + shift * 1.15).r, texture2D(u_scene, uv + shift).g, texture2D(u_scene, uv + shift * 0.85).b);
      }
      color += texture2D(u_bloom, uv + shift).rgb * u_strength;
      color += texture2D(u_streakMap, uv).rgb * u_streak;
      gl_FragColor = vec4(color, 1.0);
    }`;
  // ray tracing lubang hitam Schwarzschild (satuan: jari-jari horizon = 1); sinar dibelokkan tiap langkah
  const fragmentSource = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    uniform vec2 u_center;
    uniform float u_focal;
    uniform float u_time;
    uniform float u_dist;
    uniform float u_elev;
    uniform float u_azim;
    uniform float u_roll;
    uniform float u_glow;

    const float INNER = 3.0;
    const float OUTER = 10.0;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p = p * 2.03 + 17.0;
        a *= 0.5;
      }
      return v;
    }

    // panas: bara jingga di tepi luar, emas, krem, sampai putih kebiruan di sisi yang mendekat
    vec3 palette(float heat) {
      vec3 ember = vec3(0.42, 0.11, 0.03);
      vec3 gold = vec3(1.0, 0.62, 0.26);
      vec3 cream = vec3(1.0, 0.94, 0.84);
      vec3 blue = vec3(0.86, 0.9, 1.0);
      if (heat < 0.5) return mix(ember, gold, heat * 2.0);
      if (heat < 1.0) return mix(gold, cream, heat * 2.0 - 1.0);
      return mix(cream, blue, clamp(heat - 1.0, 0.0, 1.0));
    }

    vec3 starfield(vec3 dir) {
      vec3 col = vec3(0.0);
      for (int layer = 0; layer < 2; layer++) {
        float scale = layer == 0 ? 55.0 : 130.0;
        float limit = layer == 0 ? 0.975 : 0.985;
        vec3 cell = dir * scale;
        vec3 id = floor(cell);
        vec3 local = fract(cell) - 0.5;
        float seed = hash3(id + float(layer) * 17.0);
        if (seed > limit) {
          vec3 offset = vec3(hash3(id + 1.3), hash3(id + 2.7), hash3(id + 4.1)) - 0.5;
          float d = length(local - offset * 0.6);
          float power = (seed - limit) / (1.0 - limit);
          col += mix(vec3(1.0, 0.9, 0.78), vec3(0.8, 0.88, 1.0), hash3(id + 9.0)) * smoothstep(0.16, 0.0, d) * (0.4 + power * 1.6);
        }
      }
      col += vec3(0.035, 0.03, 0.045) * fbm(dir.xz * 2.5 + dir.y * 3.0);
      // nebula: biru tengah malam (lawan warna emas) dan merah mawar seperti gas hidrogen
      float midnight = smoothstep(0.48, 0.86, fbm(dir.xy * 1.8 + vec2(dir.z * 1.3, 0.0)));
      float rose = smoothstep(0.5, 0.9, fbm(dir.zy * 2.4 + 7.0));
      col += vec3(0.05, 0.09, 0.24) * midnight * 0.6 + vec3(0.26, 0.07, 0.13) * rose * 0.4;
      return col;
    }

    // pola piringan pada satu fase waktu; jari-jari berfrekuensi tinggi dan sudut rendah, jadi seratnya memanjang mengikuti orbit
    float diskPattern(float r, float angle, float phase, float seed) {
      float spin = angle - phase * 2.2 / pow(r, 1.5) + seed;
      vec2 around = vec2(cos(spin), sin(spin));
      float clouds = fbm(around * r * 0.6 + 3.0 + seed);
      float streaks = fbm(vec2(r * 5.5, seed) + around * 2.2);
      float filaments = fbm(vec2(r * 24.0, seed) + around * 5.0);
      float lanes = 0.5 + 0.5 * sin(r * 15.0 + clouds * 7.0);
      return pow(0.12 + 0.88 * (streaks * 0.48 + clouds * 0.24 + filaments * 0.28), 1.8) * (0.7 + 0.3 * lanes);
    }

    // titik di piringan: tekstur ikut mengorbit (makin dalam makin cepat), Doppler dan pergeseran merah gravitasi
    vec3 disk(vec3 hit, vec3 ray, out float opacity) {
      float r = length(hit.xz);
      float angle = atan(hit.z, hit.x);
      // dua lapis pola yang bergantian di-reset dan saling memudar (flow map), supaya pola tidak berpilin makin rapat lalu berkedip
      const float CYCLE = 9.0;
      float first = mod(u_time, CYCLE);
      float second = mod(u_time + CYCLE * 0.5, CYCLE);
      float weight = 1.0 - abs(1.0 - 2.0 * first / CYCLE);
      float pattern = diskPattern(r, angle, first, 0.0) * weight + diskPattern(r, angle, second, 4.7) * (1.0 - weight);
      float edge = smoothstep(INNER, INNER + 0.6, r) * (1.0 - smoothstep(OUTER - 4.5, OUTER, r));
      float density = edge * pattern;
      float temperature = pow(INNER / r, 0.75);
      vec3 orbit = normalize(vec3(-hit.z, 0.0, hit.x));
      float beta = sqrt(0.5 / r);
      float gamma = 1.0 / sqrt(1.0 - beta * beta);
      float doppler = 1.0 / (gamma * (1.0 - beta * dot(orbit, -ray)));
      float shift = doppler * sqrt(1.0 - 1.0 / r);
      opacity = clamp(density * 1.5, 0.0, 1.0);
      return palette(temperature * shift * 1.05) * pow(shift, 3.0) * density * 2.0 * u_glow;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy - u_center;
      float c = cos(u_roll);
      float s = sin(u_roll);
      uv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);
      vec3 camera = vec3(cos(u_elev) * cos(u_azim), sin(u_elev), cos(u_elev) * sin(u_azim)) * u_dist;
      vec3 forward = normalize(-camera);
      vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
      vec3 up = cross(right, forward);
      vec3 vel = normalize(forward + (uv.x * right + uv.y * up) / u_focal);
      vec3 pos = camera;
      vec3 momentum = cross(pos, vel);
      float h2 = dot(momentum, momentum);
      float dither = (hash(gl_FragCoord.xy) - 0.5) / 255.0;

      // sinar yang lewat jauh (parameter dampak > tepi piringan) hampir lurus: cukup bintang dengan sedikit pembelokan
      float impact = sqrt(h2);
      if (impact > OUTER + 2.5) {
        vec3 closestPoint = camera + vel * dot(-camera, vel);
        vec3 bent = normalize(vel - normalize(closestPoint) * (2.0 / impact));
        vec3 sky = starfield(bent) + vec3(1.0, 0.8, 0.55) * exp(-(impact - 1.5) * 3.0) * 0.06 * u_glow;
        gl_FragColor = vec4(1.0 - exp(-sky * 1.45) + dither, 1.0);
        return;
      }

      vec3 col = vec3(0.0);
      float alpha = 0.0;
      float closest = 100.0;
      bool captured = false;
      for (int i = 0; i < 160; i++) {
        float r = length(pos);
        closest = min(closest, r);
        // di dalam photon sphere (r = 1.5) sinar yang bergerak ke dalam pasti jatuh, tidak perlu diikuti sampai horizon
        if (r < 1.0 || (r < 1.5 && dot(pos, vel) < 0.0)) {
          captured = true;
          break;
        }
        if (r > OUTER + 3.0 && dot(pos, vel) > 0.0) break;
        // langkah kecil di dekat lubang hitam, besar di ruang kosong
        float dt = clamp(0.06 * r, 0.035, 0.9);
        vec3 previous = pos;
        vel += -1.5 * h2 * pos / pow(r, 5.0) * dt;
        pos += vel * dt;
        if (previous.y * pos.y < 0.0) {
          vec3 hit = mix(previous, pos, previous.y / (previous.y - pos.y));
          float rd = length(hit.xz);
          if (rd > INNER && rd < OUTER) {
            float opacity;
            vec3 light = disk(hit, normalize(vel), opacity);
            col += light * (1.0 - alpha);
            alpha += opacity * (1.0 - alpha);
            if (alpha > 0.98) break;
          }
        }
      }
      if (!captured) {
        col += starfield(normalize(vel)) * (1.0 - alpha);
        col += vec3(1.0, 0.8, 0.55) * exp(-(closest - 1.5) * 3.0) * 0.06 * u_glow;
      }
      col = 1.0 - exp(-col * 1.45);
      gl_FragColor = vec4(col + dither, 1.0);
    }`;

  function createCorona(canvas) {
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
    if (!gl) return null;
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
    };
    const link = (source, names) => {
      const vertex = compile(gl.VERTEX_SHADER, vertexSource);
      const fragment = compile(gl.FRAGMENT_SHADER, source);
      if (!vertex || !fragment) return null;
      const program = gl.createProgram();
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.bindAttribLocation(program, 0, 'p');
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
      return { program, uniform: Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, name)])) };
    };
    const scene = link(fragmentSource, ['u_center', 'u_focal', 'u_time', 'u_dist', 'u_elev', 'u_azim', 'u_roll', 'u_glow']);
    const bright = link(brightSource, ['u_source', 'u_texel']);
    const blur = link(blurSource, ['u_source', 'u_step']);
    const streak = link(streakSource, ['u_source']);
    const combine = link(combineSource, ['u_scene', 'u_bloom', 'u_streakMap', 'u_strength', 'u_streak', 'u_ripple', 'u_rippleCenter', 'u_aspect']);
    if (!scene || !bright || !blur || !streak || !combine) return null;
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const makeTarget = (width, height) => {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const framebuffer = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      return { texture, framebuffer, width, height };
    };
    let targets = null;
    const use = (output, pass) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, output ? output.framebuffer : null);
      gl.viewport(0, 0, output ? output.width : canvas.width, output ? output.height : canvas.height);
      gl.useProgram(pass.program);
    };
    const sample = (unit, texture, location) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(location, unit);
    };
    const draw = () => gl.drawArrays(gl.TRIANGLES, 0, 3);
    return {
      // scene di-ray trace di resolusi lebih kecil dari kanvas lalu diperbesar saat combine; ganti skala cukup alokasi ulang tekstur, kanvas tetap
      resize(width, height, sceneScale) {
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        if (targets) {
          for (const item of Object.values(targets)) {
            gl.deleteTexture(item.texture);
            gl.deleteFramebuffer(item.framebuffer);
          }
        }
        const smallWidth = Math.max(1, Math.round(width / 4));
        const smallHeight = Math.max(1, Math.round(height / 4));
        targets = { scene: makeTarget(Math.max(1, Math.round(width * sceneScale)), Math.max(1, Math.round(height * sceneScale))), first: makeTarget(smallWidth, smallHeight), second: makeTarget(smallWidth, smallHeight) };
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      },
      render(values) {
        if (!targets) return;
        use(targets.scene, scene);
        const uniform = scene.uniform;
        const scale = targets.scene.width / canvas.width;
        gl.uniform2f(uniform.u_center, values.center[0] * scale, values.center[1] * scale);
        gl.uniform1f(uniform.u_focal, values.focal * scale);
        gl.uniform1f(uniform.u_time, values.time);
        gl.uniform1f(uniform.u_dist, values.dist);
        gl.uniform1f(uniform.u_elev, values.elev);
        gl.uniform1f(uniform.u_azim, values.azim);
        gl.uniform1f(uniform.u_roll, values.roll);
        gl.uniform1f(uniform.u_glow, values.glow);
        draw();

        use(targets.first, bright);
        sample(0, targets.scene.texture, bright.uniform.u_source);
        gl.uniform2f(bright.uniform.u_texel, 1 / targets.scene.width, 1 / targets.scene.height);
        draw();
        // dua putaran blur: yang kedua lebih lebar, supaya pendarnya lembut tapi menjangkau jauh
        for (const spread of [1.2, 2.6]) {
          use(targets.second, blur);
          sample(0, targets.first.texture, blur.uniform.u_source);
          gl.uniform2f(blur.uniform.u_step, spread / targets.first.width, 0);
          draw();
          use(targets.first, blur);
          sample(0, targets.second.texture, blur.uniform.u_source);
          gl.uniform2f(blur.uniform.u_step, 0, spread / targets.first.height);
          draw();
        }

        use(targets.second, streak);
        sample(0, targets.first.texture, streak.uniform.u_source);
        draw();

        use(null, combine);
        sample(0, targets.scene.texture, combine.uniform.u_scene);
        sample(1, targets.first.texture, combine.uniform.u_bloom);
        sample(2, targets.second.texture, combine.uniform.u_streakMap);
        gl.uniform1f(combine.uniform.u_strength, 0.75);
        gl.uniform1f(combine.uniform.u_streak, values.streak ?? 0);
        gl.uniform1f(combine.uniform.u_ripple, values.ripple ?? -1);
        gl.uniform2f(combine.uniform.u_rippleCenter, values.rippleCenter ? values.rippleCenter[0] : 0.5, values.rippleCenter ? values.rippleCenter[1] : 0.5);
        gl.uniform1f(combine.uniform.u_aspect, canvas.width / Math.max(1, canvas.height));
        draw();
      },
    };
  }

  const hero = app.querySelector('.hero');
  const stage = app.querySelector('.hero__stage');
  const eclipse = app.querySelector('.eclipse');
  const glCanvas = app.querySelector('.hero__gl');
  const corona = createCorona(glCanvas);
  if (corona) root.classList.add('has-gl');
  // kanvas mulai tajam sampai 1.5x; di GPU lemah biayanya lebih ikut luas kanvas daripada shader, jadi adaptQuality yang mengecilkannya
  let glRatio = Math.min(devicePixelRatio || 1, 1.5);
  // resolusi ray tracing per piksel CSS, terpisah dari kanvas; diatur adaptQuality mengikuti kemampuan GPU
  let quality = Math.min(glRatio, 1);
  let qualityCeiling = glRatio;
  let halfRate = false;
  let renderCount = 0;
  const sky = { width: 0, height: 0, cx: 0, cy: 0, radius: 1 };
  const measureHero = () => {
    const stageBox = stage.getBoundingClientRect();
    const box = eclipse.getBoundingClientRect();
    sky.width = stageBox.width;
    sky.height = stageBox.height;
    sky.baseX = box.left - stageBox.left + box.width / 2;
    sky.baseY = box.top - stageBox.top + box.height / 2;
    sky.cx = sky.baseX;
    sky.cy = sky.baseY;
    sky.radius = box.width / 2;
    if (corona) corona.resize(Math.round(sky.width * glRatio), Math.round(sky.height * glRatio), quality / glRatio);
  };
  measureHero();

  const introStart = { at: null };
  const introLength = 3.1;
  const lean = { x: 0, y: 0, tx: 0, ty: 0 };
  let heroProgress = 0;
  // kamera yang sama dipakai shader dan kanvas efek, supaya asteroid dan komet sejajar dengan piringan
  const view = { dist: 22, elev: 0.14, azim: 0, roll: -0.16, intro: 0, phase: 0 };
  // progres scroll hero yang dihaluskan; semua gerak hero memakai nilai ini supaya tidak tersendat mengikuti roda mouse
  let scrollEase = 0;
  let lastInclination = null;
  const ripple = { start: null };
  const emitRipple = (now) => {
    ripple.start = now;
    flare = Math.min(1, flare + 0.4);
  };
  const stories = [...document.querySelectorAll('.story')];
  // tiap kalimat punya jendela scroll sendiri: masuk dari bawah, diam sebentar, lalu keluar ke atas sambil kabur
  const updateStory = (sweep) => {
    stories.forEach((story, index) => {
      const start = 0.5 + index * 0.13;
      const local = (sweep - start) / 0.15;
      const enter = smooth(0, 0.35, local);
      const leave = index === stories.length - 1 ? smooth(0.8, 1.4, local) : smooth(0.7, 1, local);
      story.style.setProperty('--o', (enter * (1 - leave)).toFixed(3));
      story.style.setProperty('--y', `${((1 - enter) * 30 - leave * 30).toFixed(1)}px`);
      story.style.setProperty('--b', `${((1 - enter) * 10 + leave * 10).toFixed(1)}px`);
    });
  };
  const nameLetters = [...document.querySelectorAll('.hero__name .ch')];
  const surnameShine = document.querySelector('.hero__shine');
  const inclinationText = document.querySelector('[data-inclination]');
  const azimuthText = document.querySelector('[data-azimuth]');
  let lastSweep = -1;
  const updateHeroText = (sweep) => {
    if (Math.abs(sweep - lastSweep) > 0.0005) {
      lastSweep = sweep;
      updateStory(sweep);
      hero.style.setProperty('--q', smooth(0, 0.14, sweep).toFixed(4));
      nameLetters.forEach((letter, index) => {
        const leave = smooth(0, 1, (sweep - 0.01 - index * 0.012) / 0.12);
        letter.style.setProperty('--lift', `${(-leave * 46).toFixed(1)}px`);
        letter.style.setProperty('--fade', (1 - leave).toFixed(3));
        letter.style.setProperty('--blur', `${(leave * 8).toFixed(1)}px`);
      });
      if (surnameShine) surnameShine.style.visibility = sweep > 0.02 ? 'hidden' : '';
    }
    if (inclinationText) {
      const tilt = (view.elev * 180) / Math.PI;
      inclinationText.textContent = `${tilt < 0 ? '−' : ''}${Math.abs(tilt).toFixed(1).padStart(4, '0')}°`;
      const azimuth = ((((view.azim * 180) / Math.PI) % 360) + 360) % 360;
      azimuthText.textContent = `${azimuth.toFixed(1).padStart(5, '0')}°`;
    }
  };
  // fase putaran dikumpulkan per frame supaya piringan bisa melambat tanpa melompat
  let diskPhase = 0;
  let lastRender = null;
  let stepSmooth = 1 / 60;
  const restDistance = 22;
  const renderHero = (now) => {
    if (!corona) return;
    const elapsed = reduce ? 99 : introStart.at === null ? 0 : (now - introStart.at) / 1000;
    const intro = reduce ? 1 : 1 - Math.pow(1 - clamp(elapsed / introLength, 0, 1), 3);
    const rawStep = lastRender === null ? 0 : Math.min(0.05, (now - lastRender) / 1000);
    lastRender = now;
    // langkah waktu dihaluskan supaya putaran piringan tidak ikut tersendat saat satu frame terlambat
    stepSmooth += (rawStep - stepSmooth) * 0.2;
    const step = stepSmooth;
    diskPhase += step * (1 + 5 * Math.pow(1 - intro, 2));
    lean.x += (lean.tx - lean.x) * 0.04;
    lean.y += (lean.ty - lean.y) * 0.04;
    // kamera terbang mendekat saat pembuka, lalu hanya mengorbit; scroll mengitari dan menaikkan kamera, tanpa zoom
    const dist = restDistance + 14 * (1 - intro);
    const degree = Math.PI / 180;
    // babak scroll: pindah ke tengah, turun menembus bidang piringan, lalu naik melihat dari atas
    const sweep = scrollEase;
    const pan = smooth(0.04, 0.28, sweep);
    const dive = smooth(0.08, 0.5, sweep);
    const rise = smooth(0.52, 0.92, sweep);
    const inclination = 8 - 26 * dive + 53 * rise;
    view.dist = dist;
    view.elev = (inclination - lean.y * 5) * degree;
    view.azim = now * 0.00003 + lean.x * 0.18 + smooth(0.04, 0.96, sweep) * 1.4;
    view.roll = (-9 * (1 - pan) + lean.x * 2) * degree;
    sky.cx = sky.baseX + (sky.width / 2 - sky.baseX) * pan;
    sky.cy = sky.baseY + (sky.height * 0.4 - sky.baseY) * pan;
    // tepat saat kamera menembus bidang piringan, gelombang gravitasi dipancarkan
    if (lastInclination !== null && Math.sign(lastInclination) !== Math.sign(inclination) && !reduce) emitRipple(now);
    lastInclination = inclination;
    const edgeOn = Math.exp(-Math.pow(inclination / 4, 2));
    view.intro = intro;
    view.phase = diskPhase;
    if (!halfRate || renderCount++ % 2 === 0) corona.render({
      center: [sky.cx * glRatio, (sky.height - sky.cy) * glRatio],
      focal: (sky.radius * glRatio * restDistance) / 2.6,
      time: diskPhase,
      dist,
      elev: view.elev,
      azim: view.azim,
      roll: view.roll,
      glow: smooth(0, 1, intro) * (1 + flare * 0.7) * (1 - smooth(0.86, 1, sweep) * 0.4),
      streak: (0.12 + edgeOn * 0.9) * smooth(0, 1, intro),
      ripple: ripple.start === null ? -1 : (now - ripple.start) / 1000,
      rippleCenter: [sky.cx / sky.width, 1 - sky.cy / sky.height],
    });
    if (ripple.start !== null && now - ripple.start > 3200) ripple.start = null;
    updateHeroText(sweep);
    if (elapsed > introLength - 0.15) ready();
    if (skyCanvas) skyCanvas.style.opacity = reduce ? '1' : smooth(0.2, 2.2, elapsed).toFixed(3);
  };

  /* ---------- benda langit di sekitar lubang hitam ---------- */
  const fx = app.querySelector('.hero__fx');
  const fxContext = fx.getContext('2d');
  const fxRatio = Math.min(devicePixelRatio || 1, 2);
  const resizeFx = () => {
    fx.width = Math.round(sky.width * fxRatio);
    fx.height = Math.round(sky.height * fxRatio);
    fxContext.setTransform(fxRatio, 0, 0, fxRatio, 0, 0);
  };
  resizeFx();
  addEventListener('resize', resizeFx);

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = (a) => {
    const length = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / length, a[1] / length, a[2] / length];
  };
  // proyeksi titik dunia ke layar dengan rumus kamera yang sama persis dengan shader
  let basis = null;
  const updateBasis = () => {
    const camera = [Math.cos(view.elev) * Math.cos(view.azim) * view.dist, Math.sin(view.elev) * view.dist, Math.cos(view.elev) * Math.sin(view.azim) * view.dist];
    const forward = unit([-camera[0], -camera[1], -camera[2]]);
    const right = unit(cross(forward, [0, 1, 0]));
    basis = { camera, forward, right, up: cross(right, forward), focal: (sky.radius * restDistance) / 2.6, cos: Math.cos(view.roll), sin: Math.sin(view.roll) };
  };
  const project = (point) => {
    const relative = sub(point, basis.camera);
    const depth = dot(relative, basis.forward);
    if (depth < 0.6) return null;
    const x = (dot(relative, basis.right) / depth) * basis.focal;
    const y = (dot(relative, basis.up) / depth) * basis.focal;
    return {
      x: sky.cx + basis.cos * x + basis.sin * y,
      y: sky.cy - (-basis.sin * x + basis.cos * y),
      scale: basis.focal / depth,
      behind: dot(point, basis.forward) > 0,
    };
  };
  // benda di belakang lubang hitam memudar saat proyeksinya masuk ke area bayangan
  const visibleFrom = (screen, margin) => {
    if (!screen.behind) return 1;
    const shadow = sky.radius * (restDistance / view.dist);
    return smooth(shadow * margin, shadow * (margin + 1.4), Math.hypot(screen.x - sky.cx, screen.y - sky.cy));
  };
  const spinRate = (radius) => 2.2 / Math.pow(radius, 1.5);
  const orbitPoint = (radius, angle, height) => [Math.cos(angle) * radius, height, Math.sin(angle) * radius];

  // arah dari batu ke lubang hitam, dipindah ke koordinat layar lalu ke koordinat sprite yang sedang terguling
  const lightFor = (point, spin) => {
    const toward = unit([-point[0], -point[1], -point[2]]);
    const x = dot(toward, basis.right);
    const y = dot(toward, basis.up);
    const screenX = basis.cos * x + basis.sin * y;
    const screenY = -(-basis.sin * x + basis.cos * y);
    const c = Math.cos(spin);
    const s = Math.sin(spin);
    return [c * screenX + s * screenY, -s * screenX + c * screenY, -dot(toward, basis.forward)];
  };
  // gambar batu yang terguling, memanjang ke arah pusat saat dekat horizon (spaghettification)
  const drawBody = (body, screen, size, spin, stretch, point, heat, alpha) => {
    shadeBody(body, lightFor(point, spin), heat);
    fxContext.save();
    fxContext.globalAlpha = alpha;
    fxContext.translate(screen.x, screen.y);
    if (stretch > 0.001) {
      const toward = Math.atan2(sky.cy - screen.y, sky.cx - screen.x);
      fxContext.rotate(toward);
      fxContext.scale(1 + stretch * 1.8, 1 - stretch * 0.45);
      fxContext.rotate(-toward);
    }
    fxContext.rotate(spin);
    fxContext.drawImage(body.canvas, -size, -size, size * 2, size * 2);
    fxContext.restore();
  };

  // asteroid pelan-pelan kehilangan orbit, spiral masuk, memanas, memanjang, lalu ditelan; penggantinya muncul dari tepi luar
  const spawnRock = (anywhere) => ({
    body: makeRockBody(48),
    spin: Math.random() * Math.PI * 2,
    spinRate: (Math.random() - 0.5) * 0.8,
    radius: anywhere ? 11 + Math.random() * 7 : 17 + Math.random() * 2,
    angle: Math.random() * Math.PI * 2,
    height: (Math.random() - 0.5) * 1.6,
    size: 0.1 + Math.random() * 0.24,
    decay: 0.05 + Math.random() * 0.08,
    born: anywhere ? 1 : 0,
  });
  const rocks = Array.from({ length: 16 }, () => spawnRock(true));
  // kilatan piringan (0..1) setiap kali ada benda yang tertelan, seperti flare Sgr A*
  let flare = 0;

  // serpihan batu kecil yang pelan-pelan spiral ke dalam dan makin panas mendekati inti
  const spawnShard = (anywhere) => ({
    body: makeRockBody(20),
    radius: anywhere ? 3.6 + Math.random() * 6 : 8.5 + Math.random() * 1.5,
    angle: Math.random() * Math.PI * 2,
    height: (Math.random() - 0.5) * 0.12,
    drift: 0.04 + Math.random() * 0.08,
    size: 0.05 + Math.random() * 0.07,
    tumble: Math.random() * Math.PI * 2,
    tumbleRate: (Math.random() - 0.5) * 2.4,
    born: anywhere ? 1 : 0,
  });
  const shards = Array.from({ length: stacked.matches ? 14 : 24 }, () => spawnShard(true));
  // titik panas plasma seperti kilatan yang teramati di Sgr A*: mengorbit cepat dekat tepi dalam
  const hotSpots = Array.from({ length: 3 }, (_, index) => ({
    radius: 3.4 + index * 0.55,
    angle: (index / 3) * Math.PI * 2,
    height: 0,
    pulse: Math.random() * Math.PI * 2,
  }));

  const comet = { active: false, wait: 4.5, pos: [0, 0, 0], vel: [0, 0, 0], trail: [], tail: null };
  const launchComet = () => {
    const side = Math.random() > 0.5 ? 1 : -1;
    comet.pos = [-34 * side, 3 + Math.random() * 4, 8 + Math.random() * 10];
    // separuh komet melintas terlalu dekat dan tertelan, sisanya lolos dengan slingshot
    comet.doomed = Math.random() < 0.5;
    const miss = comet.doomed ? 2.2 + Math.random() : 6 + Math.random() * 2.5;
    const aim = [0, 0.4, (Math.random() > 0.5 ? 1 : -1) * miss];
    const heading = unit(sub(aim, comet.pos));
    comet.vel = [heading[0] * 4.4, heading[1] * 4.4, heading[2] * 4.4];
    comet.trail = [comet.pos.slice()];
    comet.tail = null;
    comet.active = true;
  };
  // gravitasi dihitung sungguhan: komet yang lolos melengkung (slingshot), yang terlalu dekat jatuh ke horizon
  const moveComet = (dt) => {
    if (!comet.active) {
      comet.wait -= dt;
      if (comet.wait <= 0) launchComet();
      return;
    }
    for (let index = 0; index < 4; index++) {
      const step = dt / 4;
      const distance = Math.hypot(comet.pos[0], comet.pos[1], comet.pos[2]);
      const pull = -24 / (distance * distance * distance);
      comet.vel = comet.vel.map((value, axis) => value + comet.pos[axis] * pull * step);
      comet.pos = comet.pos.map((value, axis) => value + comet.vel[axis] * step);
    }
    // titik jejak dicatat per jarak tempuh, bukan per frame, supaya panjang ekor sama di fps berapa pun
    const last = comet.trail[comet.trail.length - 1];
    if (Math.hypot(...sub(comet.pos, last)) > 0.22) {
      comet.trail.push(comet.pos.slice());
      if (comet.trail.length > 64) comet.trail.shift();
    }
    const distance = Math.hypot(comet.pos[0], comet.pos[1], comet.pos[2]);
    if (distance < 2.7) {
      comet.active = false;
      comet.wait = 9 + Math.random() * 8;
      flare = 1;
      return;
    }
    if (distance > 48 && dot(comet.pos, comet.vel) > 0) {
      comet.active = false;
      comet.wait = 9 + Math.random() * 8;
    }
  };

  const meteors = [];
  let meteorWait = 2.5;
  const launchMeteor = () => {
    const angle = ((18 + Math.random() * 20) * Math.PI) / 180;
    const speed = 620 + Math.random() * 420;
    meteors.push({
      x: sky.width * (0.25 + Math.random() * 0.75),
      y: sky.height * Math.random() * 0.4,
      vx: -Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      length: 90 + Math.random() * 90,
      age: 0,
      life: 0.9 + Math.random() * 0.6,
    });
  };

  const drawRocks = (dt, warp) => {
    const placed = [];
    for (let index = 0; index < rocks.length; index++) {
      const rock = rocks[index];
      rock.angle += dt * spinRate(rock.radius) * warp;
      rock.spin += rock.spinRate * dt;
      // di luar piringan orbitnya meluruh pelan, di dalam piringan gesekan membuatnya jatuh makin cepat
      rock.radius -= dt * (rock.decay + Math.max(0, 10 - rock.radius) * 0.12);
      rock.born = Math.min(1, rock.born + dt * 0.5);
      if (rock.radius < 3.1) {
        flare = Math.min(1, flare + 0.25);
        rocks[index] = spawnRock(false);
        continue;
      }
      const point = orbitPoint(rock.radius, rock.angle, rock.height * clamp((rock.radius - 3) / 8, 0, 1));
      const screen = project(point);
      if (screen) placed.push({ rock, point, screen });
    }
    placed.sort((a, b) => a.screen.scale - b.screen.scale);
    for (const { rock, point, screen } of placed) {
      const size = Math.min(22, rock.size * screen.scale);
      if (size < 1.5) continue;
      const visible = visibleFrom(screen, 1.2) * rock.born * smooth(3.1, 3.8, rock.radius);
      if (visible <= 0.01) continue;
      const heat = smooth(8, 3.4, rock.radius);
      const stretch = smooth(6, 3.2, rock.radius);
      if (heat > 0.02) {
        const glowRadius = size * (1.6 + heat * 2.2);
        const glow = fxContext.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, glowRadius);
        glow.addColorStop(0, `rgba(255, 170, 90, ${(0.5 * heat).toFixed(3)})`);
        glow.addColorStop(1, 'rgba(255, 140, 60, 0)');
        fxContext.globalAlpha = view.intro * visible;
        fxContext.fillStyle = glow;
        fxContext.beginPath();
        fxContext.arc(screen.x, screen.y, glowRadius, 0, Math.PI * 2);
        fxContext.fill();
      }
      drawBody(rock.body, screen, size, rock.spin, stretch, point, heat, view.intro * visible);
    }
  };

  const drawShards = (dt, warp) => {
    for (let index = 0; index < shards.length; index++) {
      const shard = shards[index];
      shard.angle += dt * spinRate(shard.radius) * warp;
      shard.radius -= shard.drift * dt;
      shard.tumble += shard.tumbleRate * dt;
      shard.born = Math.min(1, shard.born + dt * 0.8);
      if (shard.radius < 3.1) {
        flare = Math.min(1, flare + 0.04);
        shards[index] = spawnShard(false);
        continue;
      }
      const point = orbitPoint(shard.radius, shard.angle, shard.height);
      const screen = project(point);
      if (!screen) continue;
      const size = Math.max(1.6, Math.min(7, shard.size * screen.scale));
      const heat = smooth(6.5, 3.4, shard.radius);
      const alpha = view.intro * visibleFrom(screen, 1) * shard.born * smooth(3.1, 3.7, shard.radius);
      if (alpha <= 0.01) continue;
      // makin dekat inti, batu makin berpendar jingga oleh gesekan dan panas piringan
      if (heat > 0.02) {
        const glowRadius = size * (2.5 + heat * 3);
        const glow = fxContext.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, glowRadius);
        glow.addColorStop(0, `rgba(255, 170, 90, ${(0.55 * heat).toFixed(3)})`);
        glow.addColorStop(1, 'rgba(255, 140, 60, 0)');
        fxContext.globalAlpha = alpha;
        fxContext.fillStyle = glow;
        fxContext.beginPath();
        fxContext.arc(screen.x, screen.y, glowRadius, 0, Math.PI * 2);
        fxContext.fill();
      }
      drawBody(shard.body, screen, size, shard.tumble, smooth(4.5, 3.1, shard.radius), point, heat, alpha);
    }
  };

  const drawHotSpots = (dt, warp, now) => {
    fxContext.globalCompositeOperation = 'lighter';
    for (const spot of hotSpots) {
      spot.angle += dt * spinRate(spot.radius) * warp;
      const point = orbitPoint(spot.radius, spot.angle, spot.height);
      const screen = project(point);
      if (!screen) continue;
      // sisi yang bergerak mendekati kamera tampak lebih terang (Doppler)
      const motion = [-Math.sin(spot.angle), 0, Math.cos(spot.angle)];
      const approach = -dot(motion, basis.forward);
      const brightness = clamp(0.45 + approach * 0.55, 0.1, 1) * (0.75 + 0.25 * Math.sin(now * 0.0015 + spot.pulse));
      const radius = clamp(screen.scale * 0.28, 6, 16);
      const glow = fxContext.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, radius);
      glow.addColorStop(0, 'rgba(255, 244, 222, 0.9)');
      glow.addColorStop(0.35, 'rgba(255, 196, 120, 0.35)');
      glow.addColorStop(1, 'rgba(255, 170, 90, 0)');
      fxContext.globalAlpha = view.intro * visibleFrom(screen, 1) * brightness * 0.8;
      fxContext.fillStyle = glow;
      fxContext.beginPath();
      fxContext.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
      fxContext.fill();
    }
    fxContext.globalCompositeOperation = 'source-over';
  };

  // pita yang melebar dari kepala ke ujung, diisi gradasi: bentuk ekor debu di foto komet sungguhan
  const drawRibbon = (points, widthAt, gradient) => {
    const left = [];
    const right = [];
    points.forEach((point, index) => {
      const before = points[Math.max(0, index - 1)];
      const after = points[Math.min(points.length - 1, index + 1)];
      const tx = after.x - before.x;
      const ty = after.y - before.y;
      const length = Math.hypot(tx, ty) || 1;
      const width = widthAt(index / (points.length - 1));
      left.push([point.x - (ty / length) * width, point.y + (tx / length) * width]);
      right.push([point.x + (ty / length) * width, point.y - (tx / length) * width]);
    });
    fxContext.fillStyle = gradient;
    fxContext.beginPath();
    fxContext.moveTo(left[0][0], left[0][1]);
    for (const [x, y] of left) fxContext.lineTo(x, y);
    for (let index = right.length - 1; index >= 0; index--) fxContext.lineTo(right[index][0], right[index][1]);
    fxContext.closePath();
    fxContext.fill();
  };

  const drawComet = () => {
    if (!comet.active || comet.trail.length < 2) return;
    const head = project(comet.pos);
    if (!head) return;
    const distance = Math.hypot(comet.pos[0], comet.pos[1], comet.pos[2]);
    const alpha = view.intro * smooth(46, 36, distance) * visibleFrom(head, 1.1) * (comet.doomed ? smooth(2.7, 4.5, distance) : 1);
    if (alpha < 0.01) return;
    // hanya potongan jejak yang menyambung sampai ke kepala yang dipakai, supaya tidak ada garis lompat
    const points = [];
    for (const point of [...comet.trail, comet.pos]) {
      const screen = project(point);
      if (screen) points.push(screen);
      else points.length = 0;
    }
    const size = clamp(head.scale / 40, 0.6, 1.5);
    fxContext.globalCompositeOperation = 'lighter';
    fxContext.globalAlpha = alpha;
    if (points.length > 2) {
      const end = points[0];
      const dust = fxContext.createLinearGradient(head.x, head.y, end.x, end.y);
      dust.addColorStop(0, 'rgba(255, 226, 178, 0.5)');
      dust.addColorStop(0.35, 'rgba(240, 200, 150, 0.2)');
      dust.addColorStop(1, 'rgba(220, 180, 140, 0)');
      drawRibbon(points, (t) => 1 + (1 - t) * 16 * size, dust);
      const core = fxContext.createLinearGradient(head.x, head.y, end.x, end.y);
      core.addColorStop(0, 'rgba(255, 240, 210, 0.55)');
      core.addColorStop(0.5, 'rgba(255, 230, 190, 0)');
      drawRibbon(points, (t) => 0.6 + (1 - t) * 4 * size, core);
    }

    // ekor ion: beberapa berkas biru tipis yang membuntuti, sedikit condong menjauhi cahaya
    const back = project(sub(comet.pos, [comet.vel[0] * 0.15, comet.vel[1] * 0.15, comet.vel[2] * 0.15]));
    const behindX = back ? back.x - head.x : 0;
    const behindY = back ? back.y - head.y : 0;
    const behindLength = Math.hypot(behindX, behindY) || 1;
    const awayX = head.x - sky.cx;
    const awayY = head.y - sky.cy;
    const awayLength = Math.hypot(awayX, awayY) || 1;
    const target = [(behindX / behindLength) * 0.85 + (awayX / awayLength) * 0.15, (behindY / behindLength) * 0.85 + (awayY / awayLength) * 0.15];
    comet.tail = comet.tail ? [comet.tail[0] + (target[0] - comet.tail[0]) * 0.12, comet.tail[1] + (target[1] - comet.tail[1]) * 0.12] : target;
    const baseAngle = Math.atan2(comet.tail[1], comet.tail[0]);
    const reach = clamp(80 + head.scale * 3, 80, 200);
    fxContext.lineCap = 'round';
    for (const [offset, lengthFactor, width, strength] of [[0, 1, 1.6, 0.6], [-0.05, 0.75, 0.9, 0.35], [0.06, 0.85, 0.8, 0.3]]) {
      const endX = head.x + Math.cos(baseAngle + offset) * reach * lengthFactor;
      const endY = head.y + Math.sin(baseAngle + offset) * reach * lengthFactor;
      const ion = fxContext.createLinearGradient(head.x, head.y, endX, endY);
      ion.addColorStop(0, `rgba(140, 205, 255, ${strength})`);
      ion.addColorStop(1, 'rgba(140, 205, 255, 0)');
      fxContext.strokeStyle = ion;
      fxContext.lineWidth = width;
      fxContext.beginPath();
      fxContext.moveTo(head.x, head.y);
      fxContext.lineTo(endX, endY);
      fxContext.stroke();
    }

    // koma: kabut lebar yang samar, lalu inti kecil yang terang
    const haze = 22 * size;
    const outer = fxContext.createRadialGradient(head.x, head.y, 0, head.x, head.y, haze);
    outer.addColorStop(0, 'rgba(180, 225, 255, 0.28)');
    outer.addColorStop(1, 'rgba(180, 225, 255, 0)');
    fxContext.fillStyle = outer;
    fxContext.beginPath();
    fxContext.arc(head.x, head.y, haze, 0, Math.PI * 2);
    fxContext.fill();
    const nucleus = fxContext.createRadialGradient(head.x, head.y, 0, head.x, head.y, 5 * size);
    nucleus.addColorStop(0, 'rgba(250, 253, 255, 1)');
    nucleus.addColorStop(1, 'rgba(210, 240, 255, 0)');
    fxContext.fillStyle = nucleus;
    fxContext.beginPath();
    fxContext.arc(head.x, head.y, 5 * size, 0, Math.PI * 2);
    fxContext.fill();
    fxContext.globalCompositeOperation = 'source-over';
  };

  const drawMeteors = (dt) => {
    meteorWait -= dt;
    if (meteorWait <= 0) {
      launchMeteor();
      meteorWait = 3.5 + Math.random() * 5.5;
    }
    const horizon = sky.radius * (restDistance / view.dist);
    fxContext.lineCap = 'round';
    for (let index = meteors.length - 1; index >= 0; index--) {
      const meteor = meteors[index];
      // gravitasi di bidang layar: makin dekat ke lubang hitam, lintasan makin melengkung ke arahnya
      const towardX = sky.cx - meteor.x;
      const towardY = sky.cy - meteor.y;
      const distance = Math.hypot(towardX, towardY) || 1;
      const accel = 2.6e7 / Math.max(distance * distance, horizon * horizon);
      meteor.vx += (towardX / distance) * accel * dt;
      meteor.vy += (towardY / distance) * accel * dt;
      meteor.x += meteor.vx * dt;
      meteor.y += meteor.vy * dt;
      meteor.age += dt;
      const progress = meteor.age / meteor.life;
      if (distance < horizon * 1.05) {
        flare = Math.min(1, flare + 0.08);
        meteors.splice(index, 1);
        continue;
      }
      if (progress >= 1) {
        meteors.splice(index, 1);
        continue;
      }
      // terang di tengah perjalanan, meredup kalau tertelan, tanpa muncul atau hilang mendadak
      const envelope = Math.sin(Math.PI * progress) * smooth(horizon * 1.05, horizon * 1.8, distance);
      const speed = Math.hypot(meteor.vx, meteor.vy) || 1;
      const tailX = meteor.x - (meteor.vx / speed) * meteor.length * envelope;
      const tailY = meteor.y - (meteor.vy / speed) * meteor.length * envelope;
      // badan meruncing dari ekor ke kepala, kepala sedikit kehijauan seperti meteor sungguhan
      const normalX = -meteor.vy / speed;
      const normalY = meteor.vx / speed;
      const width = 1.5;
      const streak = fxContext.createLinearGradient(meteor.x, meteor.y, tailX, tailY);
      streak.addColorStop(0, 'rgba(240, 255, 238, 0.95)');
      streak.addColorStop(0.25, 'rgba(255, 244, 222, 0.5)');
      streak.addColorStop(1, 'rgba(255, 236, 210, 0)');
      fxContext.globalCompositeOperation = 'lighter';
      fxContext.globalAlpha = view.intro * envelope;
      fxContext.fillStyle = streak;
      fxContext.beginPath();
      fxContext.moveTo(tailX, tailY);
      fxContext.lineTo(meteor.x + normalX * width, meteor.y + normalY * width);
      fxContext.lineTo(meteor.x - normalX * width, meteor.y - normalY * width);
      fxContext.closePath();
      fxContext.fill();
      const glow = fxContext.createRadialGradient(meteor.x, meteor.y, 0, meteor.x, meteor.y, 6);
      glow.addColorStop(0, 'rgba(230, 255, 236, 0.85)');
      glow.addColorStop(1, 'rgba(230, 255, 236, 0)');
      fxContext.fillStyle = glow;
      fxContext.beginPath();
      fxContext.arc(meteor.x, meteor.y, 6, 0, Math.PI * 2);
      fxContext.fill();
      fxContext.globalCompositeOperation = 'source-over';
    }
  };

  // garis orbit tipis di bidang piringan: ikut perspektif kamera, bagian di belakang bayangan memudar
  const drawOrbitRing = (radius, alpha) => {
    const steps = 180;
    fxContext.setLineDash([3, 7]);
    fxContext.lineWidth = 1;
    fxContext.strokeStyle = 'rgba(217, 194, 154, 0.6)';
    let previous = null;
    for (let index = 0; index <= steps; index++) {
      const screen = project(orbitPoint(radius, (index / steps) * Math.PI * 2, 0));
      if (screen && previous) {
        // busur depan memudar di bagian bawah layar supaya tidak menembus nama dan baris bawah
        const lower = 1 - smooth(sky.height * 0.5, sky.height * 0.68, screen.y);
        fxContext.globalAlpha = alpha * lower * Math.min(visibleFrom(screen, 1.05), visibleFrom(previous, 1.05)) * (screen.behind ? 0.45 : 1);
        fxContext.beginPath();
        fxContext.moveTo(previous.x, previous.y);
        fxContext.lineTo(screen.x, screen.y);
        fxContext.stroke();
      }
      previous = screen;
    }
    fxContext.setLineDash([]);
  };

  // label bergaya pelat jurnal astronomi: titik di objek, garis siku, lalu teks kecil
  const annotate = (anchor, dx, dy, title, detail, alpha) => {
    const elbowX = anchor.x + dx;
    const elbowY = anchor.y + dy;
    const toRight = dx >= 0;
    const endX = elbowX + (toRight ? 22 : -22);
    fxContext.globalAlpha = alpha;
    fxContext.strokeStyle = 'rgba(217, 194, 154, 0.75)';
    fxContext.lineWidth = 0.8;
    fxContext.beginPath();
    fxContext.moveTo(anchor.x, anchor.y);
    fxContext.lineTo(elbowX, elbowY);
    fxContext.lineTo(endX, elbowY);
    fxContext.stroke();
    fxContext.fillStyle = '#D9C29A';
    fxContext.beginPath();
    fxContext.arc(anchor.x, anchor.y, 2, 0, Math.PI * 2);
    fxContext.fill();
    fxContext.textAlign = toRight ? 'left' : 'right';
    fxContext.textBaseline = 'middle';
    if ('letterSpacing' in fxContext) fxContext.letterSpacing = '1.6px';
    const textX = endX + (toRight ? 8 : -8);
    fxContext.fillStyle = 'rgba(242, 238, 230, 0.85)';
    fxContext.font = '400 10.5px "Geist Mono", ui-monospace, monospace';
    fxContext.fillText(title, textX, elbowY - 6);
    fxContext.fillStyle = 'rgba(142, 138, 130, 0.95)';
    fxContext.font = '400 9.5px "Geist Mono", ui-monospace, monospace';
    fxContext.fillText(detail, textX, elbowY + 8);
    if ('letterSpacing' in fxContext) fxContext.letterSpacing = '0px';
  };

  let annotationsIn = 0;
  const drawAnnotations = (dt) => {
    if (root.classList.contains('is-ready')) annotationsIn = Math.min(1, annotationsIn + dt * 0.5);
    const alpha = view.intro * smooth(0, 1, annotationsIn) * clamp(1 - scrollEase * 7, 0, 1);
    if (alpha < 0.01) return;
    drawOrbitRing(13, alpha * 0.8);
    drawOrbitRing(17, alpha * 0.5);
    // label hanya di layar lebar, di HP terlalu sesak
    if (stacked.matches) return;
    const horizon = sky.radius * (restDistance / view.dist);
    const edge = (angle) => ({ x: sky.cx + Math.cos(angle) * horizon, y: sky.cy + Math.sin(angle) * horizon });
    // titik di bidang piringan diambil di sisi kiri dan kanan kamera, supaya label selalu menunjuk ke bagian yang terlihat
    const side = unit([basis.right[0], 0, basis.right[2]]);
    const inner = project([-side[0] * 3.05, 0, -side[2] * 3.05]);
    const outer = project([side[0] * 6.5, 0, side[2] * 6.5]);
    // bayangan yang terlihat sekitar 2,6 kali horizon; horizon sendiri tersembunyi di dalamnya
    const eventHorizon = horizon / 2.6;
    fxContext.globalAlpha = alpha * 0.7;
    fxContext.strokeStyle = 'rgba(217, 194, 154, 0.55)';
    fxContext.lineWidth = 0.8;
    fxContext.setLineDash([2, 4]);
    fxContext.beginPath();
    fxContext.arc(sky.cx, sky.cy, eventHorizon, 0, Math.PI * 2);
    fxContext.stroke();
    fxContext.setLineDash([]);
    const inside = { x: sky.cx + Math.cos(0.7) * eventHorizon, y: sky.cy + Math.sin(0.7) * eventHorizon };
    annotate(inside, 200, 108, 'EVENT HORIZON', '1 Rs · hidden inside the shadow', alpha);
    annotate(edge(-0.55), 70, -70, 'PHOTON RING', 'edge of the shadow · light in orbit', alpha);
    if (inner) annotate(inner, -70, -150, 'ISCO', '3 Rs · last stable orbit', alpha);
    if (outer) annotate(outer, 40, 58, 'ACCRETION DISK', 'Doppler-brightened side', alpha);
  };

  const drawFx = (dt, now) => {
    updateBasis();
    fxContext.clearRect(0, 0, sky.width, sky.height);
    flare = Math.max(0, flare - dt * 0.8);
    const warp = 1 + 5 * Math.pow(1 - view.intro, 2);
    drawAnnotations(dt);
    drawRocks(dt, warp);
    drawHotSpots(dt, warp, now);
    drawShards(dt, warp);
    moveComet(dt);
    drawComet();
    drawMeteors(dt);
    fxContext.globalAlpha = 1;
  };

  // resolusi render menyesuaikan kecepatan frame GPU
  const frameTimes = [];
  // detik-detik awal masih memuat font dan tekstur; tersendat di sini bukan tanda GPU lemah
  let warmup = 90;
  const adaptQuality = (delta) => {
    if (warmup > 0) {
      warmup -= 1;
      return;
    }
    frameTimes.push(delta);
    if (frameTimes.length < 30) return;
    const average = frameTimes.reduce((sum, value) => sum + value, 0) / frameTimes.length;
    // frame tercepat kira-kira satu jeda refresh layar; rata-rata yang dekat dengannya berarti tidak ada frame yang terlewat
    const keepingUp = average < Math.min(...frameTimes) * 1.2;
    frameTimes.length = 0;
    // biaya scene sebanding jumlah piksel, jadi turun langsung sebesar kelebihannya; naik pelan dan tidak melewati titik yang pernah terlalu berat
    let next = quality;
    const previousRatio = glRatio;
    // patokannya 60 fps, juga di layar 120 Hz ke atas: di bawah itu hero terasa tersendat dibanding section lain
    if (average > 17) {
      // urutan mundur: resolusi scene, lalu luas kanvas (1.5x, 1x, 0.75x), terakhir lubang hitam digambar tiap dua frame
      if (quality <= 0.41 && glRatio <= 0.75) halfRate = true;
      if (quality <= 0.41) glRatio = glRatio > 1 ? 1 : Math.min(glRatio, 0.75);
      qualityCeiling = quality * 0.95;
      next = Math.max(0.4, quality * Math.sqrt(14 / average));
    } else if (keepingUp || average < 14) next = Math.min(qualityCeiling, glRatio, quality + 0.1);
    if (Math.abs(next - quality) > 0.01 || glRatio !== previousRatio) {
      quality = next;
      corona.resize(Math.round(sky.width * glRatio), Math.round(sky.height * glRatio), quality / glRatio);
    }
  };


  /* ---------- penyambung: scroll, resize, kursor, dan putaran frame ---------- */
  // posisi hero di dokumen disimpan sekali per resize; membaca getBoundingClientRect tiap frame memaksa layout dihitung ulang
  const heroPlace = { top: 0, height: 0 };
  const measurePlace = () => {
    heroPlace.top = hero.getBoundingClientRect().top + scrollY;
    heroPlace.height = hero.offsetHeight;
  };
  measurePlace();
  const heroBottom = () => heroPlace.top + heroPlace.height - scrollY;
  // mask pudar di kanvas hero baru dipasang saat hero mulai ditinggalkan; selama mask aktif tiap frame kanvas dikomposisi ulang lewat surface tambahan
  const setProgress = (progress) => {
    hero.style.setProperty('--p', progress.toFixed(4));
    const exiting = progress * 1.5 - 0.35 > 0;
    if (exiting !== stage.classList.contains('is-exiting')) stage.classList.toggle('is-exiting', exiting);
  };
  const onScroll = () => {
    heroProgress = clamp((scrollY - heroPlace.top) / (heroPlace.height - innerHeight), 0, 1);
    if (reduce) {
      scrollEase = heroProgress;
      setProgress(heroProgress);
      hero.style.setProperty('--q', smooth(0, 0.14, heroProgress).toFixed(4));
      updateStory(heroProgress);
    }
  };
  onScroll();
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => {
    measurePlace();
    measureHero();
    resizeFx();
    onScroll();
  });

  if (reduce) {
    ready();
    setInterval(tickClocks, 1000);
    renderHero(0);
    addEventListener('scroll', () => renderHero(0), { passive: true });
    return;
  }
  if (!corona) setTimeout(ready, 400);

  // piringan sedikit miring dan berputar mengikuti posisi kursor di layar
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  addEventListener('pointermove', (event) => {
    pointer.x = (event.clientX - innerWidth / 2) / innerWidth;
    pointer.y = (event.clientY - innerHeight / 2) / innerHeight;
    lean.tx = (event.clientX / innerWidth - 0.5) * 2;
    lean.ty = (event.clientY / innerHeight - 0.5) * 2;
  });
  stage.addEventListener('click', () => {
    if (corona && root.classList.contains('is-ready')) emitRipple(performance.now());
  });
  // scroll saat pembuka masih berjalan langsung menuntaskannya
  addEventListener('scroll', () => {
    if (scrollY > 40 && introStart.at !== null && performance.now() - introStart.at < introLength * 1000) introStart.at = performance.now() - introLength * 1000;
  }, { passive: true });

  // kursor terhisap ke inti lubang hitam selama hero masih di layar
  setCursorAttractor(() => {
    if (!corona) return null;
    // panggung sticky menempel di atas layar sampai ujung hero, lalu ikut naik
    const bottom = heroBottom();
    const stageTop = Math.min(Math.max(heroPlace.top - scrollY, 0), bottom - innerHeight);
    return {
      x: sky.cx,
      y: stageTop + sky.cy,
      horizon: sky.radius * (restDistance / view.dist),
      active: bottom > 0 && heroProgress < 0.6,
    };
  });

  let previousFrame = null;
  // selang waktu dihaluskan supaya gerak benda langit tidak ikut tersendat saat satu frame terlambat
  let fxDelta = 1 / 60;
  requestAnimationFrame(function frame(now) {
    if (introStart.at === null) introStart.at = now;
    const frameDelta = previousFrame === null ? 0 : now - previousFrame;
    const bottom = heroBottom();
    const visible = bottom > 0;
    previousFrame = now;
    // selama lubang hitam menutup layar penuh, langit global di belakangnya tidak perlu digambar
    const covered = String(Boolean(corona) && bottom >= innerHeight && scrollEase < 0.2);
    if (root.dataset.skyCovered !== covered) root.dataset.skyCovered = covered;
    if (visible) {
      if (frameDelta) adaptQuality(frameDelta);
      tickClocks();
      pointer.sx += (pointer.x - pointer.sx) * 0.03;
      pointer.sy += (pointer.y - pointer.sy) * 0.03;
      stage.style.setProperty('--mx', (pointer.sx * 2).toFixed(3));
      stage.style.setProperty('--my', (pointer.sy * 2).toFixed(3));
      scrollEase += (heroProgress - scrollEase) * 0.1;
      setProgress(scrollEase);
      renderHero(now);
      fxDelta += (Math.min(0.05, frameDelta / 1000 || 1 / 60) - fxDelta) * 0.2;
      if (corona) drawFx(fxDelta, now);
    }
    requestAnimationFrame(frame);
  });
}
