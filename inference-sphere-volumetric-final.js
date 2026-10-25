(() => {
  const canvas = document.getElementById("inference-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  );

  const couplingInput = document.getElementById("coupling");
  const dispersionInput = document.getElementById("dispersion");
  const phaseLagInput = document.getElementById("phase-lag");
  const phaseLagValue = document.getElementById("phase-lag-value");
  const couplingValue = document.getElementById("coupling-value");
  const dispersionValue = document.getElementById("dispersion-value");
  const orderOutput = document.getElementById("order-parameter");
  const perturbButton = document.getElementById("perturb");
  const resetButton = document.getElementById("reset-model");

const heroOrder =
    document.getElementById("hero-order");

  const demoMode = Boolean(couplingInput);

  let N = demoMode ? 72 : 66;
  let K = demoMode ? 1.5 : 1.8;
  let sigma = 0.7;
  let alpha = 0;

  let phases = [];
  let frequencies = [];
  let particles = [];

  let elapsed = 0;
  let paused = false;
  let history = [];

  const chart = document.getElementById("synchronization-chart");
  const chartCtx = chart?.getContext("2d");
  const pauseButton = document.getElementById("pause-model");
  const exportButton = document.getElementById("export-model");
  const simulationTime = document.getElementById("simulation-time");
  let animationId = null;
  let lastFrame = 0;

  const dt = 0.04;


  // Preserve parameters as they were when each sample was recorded.
  function recordSample(event = "step") {
    history.push({
      time: elapsed,
      R: getOrderParameter().R,
      K,
      sigma,
      alpha,
      dt,
      integrator: "RK4",
      event
    });

    // Bound the history retained in browser memory.
    if (history.length > 1500) history.shift();
  }

  function initialize() {
    const population = core.initializePopulation(N, sigma);

    phases = population.phases;
    frequencies = population.frequencies;
    particles = [];

    for (let i = 0; i < N; i++) {
      particles.push({
        latitude: Math.acos(1 - 2 * (i + 0.5) / N),
        longitude: i * 2.399963,
        depthOffset: Math.sin(i * 1.618),
        size: 1.1 + (i % 4) * 0.4
      });
    }

    elapsed = 0;
    lastFrame = 0;
    history = [];
    recordSample("initial");


    updateLabels();
  }

  const core = window.KuramotoCore;

  if (!core) {
    console.error("KuramotoCore was not loaded.");
    return;
  }

  function getOrderParameter() {
    return core.orderParameter(phases);
  }


  // LIVING_NETWORK_V1 — visual layer only.
  let livingNetwork = true;

  const livingToggle =
    document.getElementById("living-network-toggle");

  livingToggle?.addEventListener("click", () => {
    livingNetwork = !livingNetwork;

    livingToggle.setAttribute(
      "aria-pressed", String(livingNetwork)
    );

    livingToggle.textContent = livingNetwork
      ? "✧ Living network: On"
      : "✧ Living network: Off";

    draw();
  });

  let resonantReflected = false;

  const reflectionButton =
    document.getElementById("resonant-reflection");

  function updateResonantMeasurements() {
    if (!phases.length) return;

    const n = phases.length;
    let c1 = 0, s1 = 0, c2 = 0, s2 = 0;

    for (const theta of phases) {
      c1 += Math.cos(theta);
      s1 += Math.sin(theta);
      c2 += Math.cos(2 * theta);
      s2 += Math.sin(2 * theta);
    }

    c1 /= n;
    s1 /= n;
    c2 /= n;
    s2 /= n;

    const R1 = Math.hypot(c1, s1);
    const R2 = Math.hypot(c2, s2);

    const rates = core.derivative(
      phases, frequencies, K, alpha
    );

    let cDot = 0;
    let sDot = 0;

    for (let i = 0; i < n; i++) {
      cDot -= Math.sin(phases[i]) * rates[i];
      sDot += Math.cos(phases[i]) * rates[i];
    }

    cDot /= n;
    sDot /= n;

    const Omega = R1 > 1e-10
      ? (c1 * sDot - s1 * cDot) / (R1 * R1)
      : NaN;

    const format = v =>
      Number.isFinite(v) ? v.toFixed(3) : "—";

    document.getElementById("resonant-r1").textContent =
      format(R1);

    document.getElementById("resonant-r2").textContent =
      format(R2);

    document.getElementById("resonant-omega").textContent =
      format(Omega);
  }

  reflectionButton?.addEventListener("click", () => {
    // Reflect the CURRENT state, preserving its
    // synchronization magnitudes.
    phases = phases.map(theta => -theta);
    frequencies = frequencies.map(omega => -omega);
    alpha = -alpha;

    if (phaseLagInput) {
      phaseLagInput.value = String(alpha);
    }

    if (phaseLagValue) {
      phaseLagValue.textContent = alpha.toFixed(2);
    }

    resonantReflected = !resonantReflected;

    reflectionButton.setAttribute(
      "aria-pressed",
      String(resonantReflected)
    );

    reflectionButton.textContent = resonantReflected
      ? "↻ Original"
      : "↺ Reflection";

    recordSample("reflection");
    draw();
  });

  function simulateStep() {
    const tau = 2 * Math.PI;

    const next = core.rk4Step(
      phases,
      frequencies,
      K,
      alpha,
      dt
    );

    // Preserve the original phase-wrapping behavior.
    // Preserve unwrapped phases for continuous orbital motion.
    phases = next;

    elapsed += dt;
    recordSample("step");
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();

    if (!rect.width || !rect.height) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    draw();
  }


  function getPositions() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    const cx = width / 2;
    const cy = height / 2;
    const synchronization = core.orderParameter(phases).R;

    const breathing = 1 + 0.04 * synchronization;

    const radius =
      Math.min(width, height) * 0.43 * breathing;

    // Gentle visual viewpoint rotation.
    // This does not affect Kuramoto dynamics.
    const yaw = elapsed * 0.035;
    const tilt = 0.48;

    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    const cosTilt = Math.cos(tilt);
    const sinTilt = Math.sin(tilt);

    return particles.map((particle, i) => {
      const theta = phases[i];

      // Phase-driven orbital movement.
      // We use continuous, unwrapped phases.
      const longitude =
        particle.longitude + 0.55 * theta;

      const latitude = particle.latitude;

      const radial =
        0.80 +
        0.05 * Math.sin(theta) +
        0.025 * particle.depthOffset;

      // Position in three-dimensional coordinates.
      const x = Math.cos(longitude) * Math.sin(latitude);
      const y = Math.sin(longitude) * Math.sin(latitude);
      const z = Math.cos(latitude);

      // Rotate the viewing angle around the Y axis.
      const rotatedX = x * cosYaw + z * sinYaw;
      const rotatedZ = -x * sinYaw + z * cosYaw;

      // Tilt the viewing angle.
      const rotatedY =
        y * cosTilt - rotatedZ * sinTilt;

      const depthZ =
        y * sinTilt + rotatedZ * cosTilt;

      // Gentle perspective scaling.
      const perspective = 1 + 0.18 * depthZ;

      return {
        x: cx + radius * radial * rotatedX * perspective,
        y: cy + radius * radial * rotatedY * perspective,
        depth: (depthZ + 1) / 2,
        phase: theta,
        size: particle.size
      };
    });
  }


  function drawChart() {
    if (!chart || !chartCtx || history.length === 0) return;

    const rect = chart.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    if (w < 1 || h < 1) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const cw = Math.round(w * dpr);
    const ch = Math.round(h * dpr);

    if (chart.width !== cw || chart.height !== ch) {
      chart.width = cw;
      chart.height = ch;
    }

    chartCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    chartCtx.clearRect(0, 0, w, h);

    const left = 40;
    const right = 12;
    const top = 14;
    const bottom = 32;

    const pw = w - left - right;
    const ph = h - top - bottom;

    if (pw <= 0 || ph <= 0) return;

    const end = history[history.length - 1].time;
    const start = Math.max(0, end - 40);
    const span = Math.max(1, end - start);

    const x = t => left + (t - start) / span * pw;
    const y = r => top + (1 - r) * ph;

    chartCtx.font = "11px Inter, Arial, sans-serif";
    chartCtx.fillStyle = "#617985";
    chartCtx.strokeStyle = "#d9e7ea";
    chartCtx.lineWidth = 1;

    // Reference lines.
    for (const value of [0, 0.5, 1]) {
      chartCtx.beginPath();
      chartCtx.moveTo(left, y(value));
      chartCtx.lineTo(w - right, y(value));
      chartCtx.stroke();

      chartCtx.fillText(String(value), 8, y(value) + 4);
    }

    chartCtx.beginPath();
    chartCtx.strokeStyle = "#137c99";
    chartCtx.lineWidth = 2;

    let first = true;

    for (const sample of history) {
      if (sample.time < start) continue;

      const px = x(sample.time);
      const py = y(sample.R);

      if (first) {
        chartCtx.moveTo(px, py);
        first = false;
      } else {
        chartCtx.lineTo(px, py);
      }
    }

    chartCtx.stroke();

    chartCtx.fillStyle = "#617985";
    chartCtx.fillText(
      "Time: " + start.toFixed(1) + "–" + end.toFixed(1),
      left,
      h - 9
    );
  }


  // HOMEPAGE LIVING COLOR V1
  // Cyclic color encoding for oscillator phase.
  function phaseColor(theta, lightness = 65, opacity = 1) {
    const tau = 2 * Math.PI;

    const phase =
      ((theta % tau) + tau) % tau;

    const hue = 170 + 360 * phase / tau;

    return `hsla(${hue}, 65%, ${lightness}%, ${opacity})`;
  }


  // LOCALIZED OSCILLATOR INTERACTION V1
  // Pointer coordinates refer to the rendered sphere.
  // The mathematical coupling remains all-to-all.

  let pointerPosition = null;

  function pointerCoordinates(event) {
    const rect = canvas.getBoundingClientRect();

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  function localDisturbance(x, y) {
    if (demoMode) return;

    const positions = getPositions();

    const radius =
      Math.min(canvas.clientWidth, canvas.clientHeight) * 0.24;

    phases = phases.map((theta, i) => {
      const point = positions[i];

      const distance = Math.hypot(
        point.x - x,
        point.y - y
      );

      const influence = Math.exp(
        -0.5 * (distance / radius) ** 2
      );

      return theta + 1.6 * influence;
    });

    draw();
  }

  canvas.addEventListener("pointermove", event => {
    if (demoMode) return;

    pointerPosition = pointerCoordinates(event);
    draw();
  });

  canvas.addEventListener("pointerleave", () => {
    pointerPosition = null;
    draw();
  });

  canvas.addEventListener("click", event => {
    if (demoMode) return;

    const point = pointerCoordinates(event);

    localDisturbance(point.x, point.y);
  });

  function draw() {
    updateResonantMeasurements();
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (!width || !height) return;

    ctx.clearRect(0, 0, width, height);

    const points = getPositions();
    const { R } = getOrderParameter();

    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.49;

    ctx.save();

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();


    // Balanced illustrative network.
    // The Kuramoto model remains mathematically all-to-all.

    const threshold = radius * 0.56;
    const maxEdges = 160;
    const maxPerParticle = 6;

    const candidates = [];
    const connections = new Array(points.length).fill(0);

    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i];
        const b = points[j];

        const distance = Math.hypot(
          a.x - b.x,
          a.y - b.y
        );

        if (distance >= threshold) continue;

        const proximity = 1 - distance / threshold;
        const coherence =
          (1 + Math.cos(a.phase - b.phase)) / 2;

        const strength = proximity * coherence;

        candidates.push({
          i, j, strength
        });
      }
    }

    // Prefer coherent and nearby connections.
    candidates.sort((a, b) => b.strength - a.strength);

    let edges = 0;
    const selected = new Set();

    // First pass: ensure broad particle coverage.
    for (const candidate of candidates) {
      if (edges >= maxEdges) break;

      const { i, j, strength } = candidate;
      const key = `${i}:${j}`;

      if (selected.has(key)) continue;

      if (
        connections[i] >= maxPerParticle ||
        connections[j] >= maxPerParticle
      ) continue;

      // Prioritize particles without visible connections.
      if (connections[i] > 0 && connections[j] > 0) {
        continue;
      }

      drawConnection(i, j, strength);
      selected.add(key);
      connections[i]++;
      connections[j]++;
      edges++;
    }

    // Second pass: fill in the remaining network.
    for (const candidate of candidates) {
      if (edges >= maxEdges) break;

      const { i, j, strength } = candidate;
      const key = `${i}:${j}`;

      if (selected.has(key)) continue;

      if (
        connections[i] >= maxPerParticle ||
        connections[j] >= maxPerParticle
      ) continue;

      drawConnection(i, j, strength);
      selected.add(key);
      connections[i]++;
      connections[j]++;
      edges++;
    }

  
  
function drawConnection(i, j, strength) {
    // LIVING_DEPTH_V3 — depth-aware visual rendering only.
    const a = points[i];
    const b = points[j];

    const depth = Math.max(
      0,
      Math.min(1, (a.depth + b.depth) / 2)
    );

    // Back-facing links fade into the sphere.
    const depthVisibility = 0.34 + 0.66 * depth;
    const opacity = Math.min(
      0.60,
      (0.11 + 0.43 * strength) * depthVisibility
    );

    if (!livingNetwork) {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);

      ctx.strokeStyle =
        `rgba(57,132,157,${opacity})`;

      ctx.lineWidth =
        (0.35 + 0.65 * strength) *
        (0.55 + 0.65 * depth);

      ctx.stroke();
      return;
    }

    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;

    const dx = b.x - a.x;
    const dy = b.y - a.y;

    // Subtle curvature: retain organic filaments
    // without obscuring perspective.
    const bend =
      0.060 * Math.sin(i * 2.31 + j * 0.73);

    const cx = mx - dy * bend;
    const cy = my + dx * bend;

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(cx, cy, b.x, b.y);

    ctx.strokeStyle =
      `rgba(65,151,160,${opacity})`;

    ctx.lineWidth =
      (0.40 + 0.95 * strength) *
      (0.45 + 0.85 * depth);

    ctx.stroke();


    // LIVING_SIGNALS_V4
    // Luminous visual signals, not simulated biological transport.

    if (
      reducedMotion.matches ||
      strength < 0.10 ||
      (i + j) % 3 !== 0
    ) return;

    const speed = 0.28 + 0.30 * strength;

    const t = (
      elapsed * speed +
      i * 0.137 +
      j * 0.071
    ) % 1;

    const u = 1 - t;

    const px =
      u*u*a.x + 2*u*t*cx + t*t*b.x;

    const py =
      u*u*a.y + 2*u*t*cy + t*t*b.y;

    const pulseDepth = Math.max(
      0,
      Math.min(1, a.depth * u + b.depth * t)
    );

    const visibility = 0.40 + 0.60 * pulseDepth;

    const radius =
      (1.0 + 1.5 * strength) *
      (0.65 + 0.65 * pulseDepth);

    // Subtle cyan halo surrounding a neon-white core.
    ctx.save();

    ctx.globalAlpha = visibility;
    ctx.shadowColor = "rgba(130,255,245,0.95)";
    ctx.shadowBlur = 9 + 8 * strength;

    ctx.beginPath();
    ctx.arc(px, py, radius * 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(100,255,240,0.22)";
    ctx.fill();

    ctx.shadowBlur = 5;

    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(245,255,255,0.98)";
    ctx.fill();

    ctx.restore();
  }

    // SOFT POINTER FIELD V1
    // Visual feedback for the pointer position.
    // This does not change oscillator equations.
    if (!demoMode && pointerPosition) {
      const fieldRadius = 72;

      const gradient = ctx.createRadialGradient(
        pointerPosition.x,
        pointerPosition.y,
        0,
        pointerPosition.x,
        pointerPosition.y,
        fieldRadius
      );

      gradient.addColorStop(
        0,
        "rgba(210, 245, 238, 0.28)"
      );

      gradient.addColorStop(
        0.5,
        "rgba(158, 218, 230, 0.12)"
      );

      gradient.addColorStop(
        1,
        "rgba(158, 218, 230, 0)"
      );

      ctx.beginPath();
      ctx.arc(
        pointerPosition.x,
        pointerPosition.y,
        fieldRadius,
        0,
        Math.PI * 2
      );

      ctx.fillStyle = gradient;
      ctx.fill();
    }

    // Pointer illumination is visual only.
    // It does not modify oscillator dynamics.
    if (!demoMode && pointerPosition) {
      for (const point of points) {
        const distance = Math.hypot(
          point.x - pointerPosition.x,
          point.y - pointerPosition.y
        );

        const proximity = Math.exp(
          -0.5 * (distance / 42) ** 2
        );

        if (proximity < 0.03) continue;

        ctx.beginPath();

        ctx.arc(
          point.x,
          point.y,
          point.size * (2.4 + proximity * 2),
          0,
          Math.PI * 2
        );

        ctx.fillStyle =
          `rgba(174,235,225,${proximity * 0.55})`;

        ctx.fill();
      }
    }

    // Each oscillator's hue represents its instantaneous phase.
    // Equal phases produce equal hues, independent of phase wrapping.
    for (const point of points) {
      const normalizedPhase =
        ((point.phase % (2 * Math.PI)) + 2 * Math.PI)
        % (2 * Math.PI);

      // Cyclic hue mapping: 0 and 2π have matching colors.
      const hue =
        175 + 65 * Math.sin(normalizedPhase);

      const saturation = 72;
      const lightness = 56 + point.depth * 13 + R * 8;
      const opacity = 0.12 + point.depth * 0.88;

      const particleRadius =
        point.size * (1.25 + point.depth * 1.15);

      ctx.beginPath();
      ctx.arc(
        point.x,
        point.y,
        particleRadius,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        phaseColor(
          point.phase,
          lightness,
          opacity
        );

      ctx.fill();
    }

    ctx.restore();

if (orderOutput) {
      orderOutput.textContent = R.toFixed(3);
    }

    if (simulationTime) {
      simulationTime.textContent = elapsed.toFixed(2);
    }

    drawChart();
  }

  function updateLabels() {
    if (couplingValue) {
      couplingValue.textContent = K.toFixed(1);
    }

    if (dispersionValue) {
      dispersionValue.textContent = sigma.toFixed(1);
    }
  }

  function frame(now) {
    if (now - lastFrame >= 33) {
      lastFrame = now;

      // Fixed simulation increment per rendered frame.
      // This is a visualization clock, not wall-clock physics.
      if (!paused) simulateStep();
      draw();
    }

    animationId = requestAnimationFrame(frame);
  }

  function stopAnimation() {
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  function updateAnimation() {
    stopAnimation();

    if (document.hidden) {
      draw();
    } else {
      animationId = requestAnimationFrame(frame);
    }
  }

  couplingInput?.addEventListener("input", event => {
    K = Number(event.target.value);
    recordSample("coupling_change");
    updateLabels();
    draw();
  });

  phaseLagInput?.addEventListener("input", event => {
    alpha = Number(event.target.value);
    recordSample("phase_lag_change");

    if (phaseLagValue) {
      phaseLagValue.textContent = alpha.toFixed(2);
    }

    draw();
  });

  dispersionInput?.addEventListener("input", event => {
    sigma = Number(event.target.value);

    // Recalculate natural frequencies without resetting phases.
    for (let i = 0; i < N; i++) {
      frequencies[i] = (resonantReflected ? -1 : 1) * sigma * (
        Math.sin(i * 12.9898) * 0.65 +
        Math.cos(i * 7.233) * 0.35
      );
    }

    recordSample("dispersion_change");
    updateLabels();
    draw();
  });

  perturbButton?.addEventListener("click", () => {
    // Deterministic phase disturbance.
    phases = phases.map((theta, i) =>
      theta + Math.sin(i * 3.17 + elapsed) * 1.8
    );

    recordSample("perturbation");
    draw();
  });



  pauseButton?.addEventListener("click", () => {
    paused = !paused;
    pauseButton.textContent = paused ? "Resume" : "Pause";
    pauseButton.setAttribute("aria-pressed", String(paused));
    draw();
  });

  exportButton?.addEventListener("click", () => {
    const lines = ["time,R,K,sigma,alpha,dt,integrator,event"];

    for (const sample of history) {
      lines.push([
        sample.time.toFixed(4),
        sample.R.toFixed(8),
        sample.K.toFixed(4),
        sample.sigma.toFixed(4),
        sample.alpha.toFixed(4),
        sample.dt.toFixed(4),
        sample.integrator,
        sample.event
      ].join(","));
    }

    const blob = new Blob(
      [lines.join("\n") + "\n"],
      { type: "text/csv;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "kuramoto-simulation.csv";
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  resetButton?.addEventListener("click", () => {
    paused = false;
    if (pauseButton) {
      pauseButton.textContent = "Pause";
      pauseButton.setAttribute("aria-pressed", "false");
    }
    resonantReflected = false;

    if (reflectionButton) {
      reflectionButton.setAttribute("aria-pressed", "false");
      reflectionButton.textContent = "↺ Reflection";
    }

    initialize();
    draw();
  });

  const sphereResizeObserver = new ResizeObserver(() => {
    resize();
  });

  sphereResizeObserver.observe(canvas);

  if (canvas.parentElement) {
    sphereResizeObserver.observe(canvas.parentElement);
  }

  reducedMotion.addEventListener(
    "change",
    updateAnimation
  );

  document.addEventListener(
    "visibilitychange",
    updateAnimation
  );

  initialize();
  resize();
  updateAnimation();
})();
