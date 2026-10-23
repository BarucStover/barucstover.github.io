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
  const couplingValue = document.getElementById("coupling-value");
  const dispersionValue = document.getElementById("dispersion-value");
  const orderOutput = document.getElementById("order-parameter");
  const perturbButton = document.getElementById("perturb");
  const resetButton = document.getElementById("reset-model");

  const demoMode = Boolean(couplingInput);

  let N = demoMode ? 72 : 66;
  let K = demoMode ? 1.5 : 1.8;
  let sigma = 0.7;

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

  function initialize() {
    phases = [];
    frequencies = [];
    particles = [];

    for (let i = 0; i < N; i++) {
      const phase = (i * 2.399963) % (2 * Math.PI);

      // Deterministic frequency distribution.
      const frequency = sigma * (
        Math.sin(i * 12.9898) * 0.65 +
        Math.cos(i * 7.233) * 0.35
      );

      phases.push(phase);
      frequencies.push(frequency);

      particles.push({
        latitude: Math.acos(1 - 2 * (i + 0.5) / N),
        longitude: i * 2.399963,
        depthOffset: Math.sin(i * 1.618),
        size: 1.1 + (i % 4) * 0.4
      });
    }

    elapsed = 0;
    lastFrame = 0;
    history = [{ time: 0, R: getOrderParameter().R }];

    updateLabels();
  }

  function getOrderParameter() {
    let real = 0;
    let imaginary = 0;

    for (const theta of phases) {
      real += Math.cos(theta);
      imaginary += Math.sin(theta);
    }

    real /= N;
    imaginary /= N;

    return {
      R: Math.hypot(real, imaginary),
      psi: Math.atan2(imaginary, real)
    };
  }

  function simulateStep() {
    const { R, psi } = getOrderParameter();

    // Mean-field form of the all-to-all Kuramoto model.
    // Equivalent to summing pairwise sinusoidal coupling.
    const next = phases.map((theta, i) => {
      const derivative =
        frequencies[i] +
        K * R * Math.sin(psi - theta);

      return (theta + derivative * dt) % (2 * Math.PI);
    });

    phases = next;
    elapsed += dt;

    history.push({
      time: elapsed,
      R: getOrderParameter().R
    });

    // Keep at most 1,500 samples in browser memory.
    if (history.length > 1500) history.shift();
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
    const radius = Math.min(width, height) * 0.43;

    return particles.map((particle, i) => {
      const theta = phases[i];

      // Phase influences longitude and radial oscillation.
      const longitude =
        particle.longitude * 0.22 +
        theta +
        elapsed * 0.04;

      const latitude = particle.latitude;

      const radial =
        0.77 +
        0.12 * Math.sin(theta) +
        0.05 * particle.depthOffset;

      const x =
        Math.cos(longitude) *
        Math.sin(latitude);

      const y =
        Math.sin(longitude) *
        Math.sin(latitude);

      const z = Math.cos(latitude);

      return {
        x: cx + radius * radial * x,
        y: cy + radius * radial * y,
        depth: (z + 1) / 2,
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

    // Dynamic network connections.
    const threshold = radius * 0.42;

    let edges = 0;
    const maxEdges = 300;

    for (let i = 0; i < points.length; i++) {
      if (edges >= maxEdges) break;

      for (let j = i + 1; j < points.length; j++) {
        if (edges >= maxEdges) break;

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

        // Coherent oscillator pairs form brighter edges.
        ctx.strokeStyle =
          `rgba(235,255,252,${0.08 + strength * 0.48})`;

        ctx.lineWidth = 0.5 + strength * 0.7;

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();

        edges++;
      }
    }

    // Phase-dependent particle illumination.
    for (const point of points) {
      const brightness =
        0.4 +
        0.25 * point.depth +
        0.25 * R;

      ctx.beginPath();
      ctx.arc(
        point.x,
        point.y,
        point.size * (0.7 + point.depth * 0.5),
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        `rgba(245,255,253,${Math.min(brightness, 1)})`;

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

    if (reducedMotion.matches || document.hidden) {
      draw();
    } else {
      animationId = requestAnimationFrame(frame);
    }
  }

  couplingInput?.addEventListener("input", event => {
    K = Number(event.target.value);
    updateLabels();
    draw();
  });

  dispersionInput?.addEventListener("input", event => {
    sigma = Number(event.target.value);

    // Recalculate natural frequencies without resetting phases.
    for (let i = 0; i < N; i++) {
      frequencies[i] = sigma * (
        Math.sin(i * 12.9898) * 0.65 +
        Math.cos(i * 7.233) * 0.35
      );
    }

    updateLabels();
    draw();
  });

  perturbButton?.addEventListener("click", () => {
    // Deterministic phase disturbance.
    phases = phases.map((theta, i) =>
      theta + Math.sin(i * 3.17 + elapsed) * 1.8
    );

    draw();
  });


  pauseButton?.addEventListener("click", () => {
    paused = !paused;
    pauseButton.textContent = paused ? "Resume" : "Pause";
    pauseButton.setAttribute("aria-pressed", String(paused));
    draw();
  });

  exportButton?.addEventListener("click", () => {
    const lines = ["time,R,K,sigma"];

    for (const sample of history) {
      lines.push(
        sample.time.toFixed(4) + "," +
        sample.R.toFixed(6) + "," +
        K.toFixed(3) + "," +
        sigma.toFixed(3)
      );
    }

    const blob = new Blob(
      [lines.join("\\n") + "\\n"],
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
    initialize();
    draw();
  });

  new ResizeObserver(resize).observe(canvas);

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
