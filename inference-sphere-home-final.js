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
    const yaw = elapsed * 0.020;
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
      const perspective = 1 + 0.10 * depthZ;

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
      const a = points[i];
      const b = points[j];

      const depth =
        (points[i].depth + points[j].depth) / 2;

      const opacity =
        (0.10 + strength * (0.29 + 0.16 * R)) *
        (0.35 + depth * 0.65);

      ctx.strokeStyle =
        `rgba(57, 132, 157, ${opacity})`;

      ctx.lineWidth = 0.5 + strength * 0.55;

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
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
