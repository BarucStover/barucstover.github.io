// LIVING_NETWORK_CLEAR_CONNECTIONS_V12
// HOMEPAGE_MOUSE_INTERACTION_DISABLED_V1
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

  
  // LIVE_EXPERIMENT_ACTIVITY_V1
  // Receives activity from Explore the Model on the same origin.
  const activityKey = "coupled-oscillators-live-activity-v1";
  let lastActivityId = null;

  const activityBadge = document.createElement("div");
  // REMOVE_ACTIVITY_BADGE_V13
  activityBadge.setAttribute("aria-live", "off");
  activityBadge.hidden = true;
  activityBadge.style.display = "none";
  activityBadge.style.cssText = [
    "font: 12px/1.6 system-ui, sans-serif",
    "color: #8faebd",
    "letter-spacing: .025em",
    "margin: 10px 0 0",
    "max-width: 100%"
  ].join(";");

  activityBadge.textContent = "";
  // MOBILE_LIVING_NETWORK_V8
  // Place activity status inside the hero artwork container,
  // outside the sphere itself.
  activityBadge.classList.add("live-activity-badge");

  const activityHost = canvas.closest(".hero-art");

  if (activityHost) {
    activityHost.appendChild(activityBadge);
  } else {
    canvas.insertAdjacentElement("afterend", activityBadge);
  }

  function showActivity(message, emphasize = false) {
    activityBadge.textContent = message;
    activityBadge.style.color = emphasize ? "#e5fbff" : "#8faebd";

    if (emphasize) {
      activityBadge.style.textShadow = "0 0 12px #61e4ff";
      setTimeout(() => {
        activityBadge.style.textShadow = "none";
        activityBadge.style.color = "#8faebd";
      }, 1000);
    }
  }

  function applyExperimentActivity(message) {
    if (!message || message.version !== 1) return;
    if (!["parameters", "perturbation", "reset"].includes(message.type)) return;
    if (!message.id || message.id === lastActivityId) return;

    const values = [message.K, message.sigma, message.alpha];

    if (!values.every(v => typeof v === "number" && Number.isFinite(v))) {
      return;
    }

    if (
      message.K < 0 || message.K > 100 ||
      message.sigma < 0 || message.sigma > 100 ||
      Math.abs(message.alpha) > 10
    ) return;

    lastActivityId = message.id;

    K = message.K;
    alpha = message.alpha;

    if (sigma !== message.sigma) {
      sigma = message.sigma;

      // Reproduce the Explore page's frequency-update convention.
      for (let i = 0; i < N; i++) {
        frequencies[i] = sigma * (
          Math.sin(i * 12.9898) * 0.65 +
          Math.cos(i * 7.233) * 0.35
        );
      }
    }

    if (message.type === "reset") {
      initialize();
      showActivity("MODEL ACTIVITY · Experiment reset", true);
    } else if (message.type === "perturbation") {
      // Matching perturbation rule; independent local trajectory.
      phases = phases.map(
        (theta, i) => theta + Math.sin(i * 3.17 + elapsed) * 1.8
      );
      recordSample("remote_perturbation");
      showActivity("MODEL ACTIVITY · Perturbation received", true);
    } else {
      recordSample("remote_parameter_change");
      showActivity(
        `MODEL ACTIVITY · K ${K.toFixed(2)} · ` +
        `σ ${sigma.toFixed(2)} · α ${alpha.toFixed(2)}`,
        true
      );
    }

    updateLabels();
    draw();
  }

  if ("BroadcastChannel" in window) {
    const activityChannel = new BroadcastChannel(activityKey);
    activityChannel.addEventListener(
      "message",
      event => applyExperimentActivity(event.data)
    );
  }

  window.addEventListener("storage", event => {
    if (event.key !== activityKey || !event.newValue) return;

    try {
      applyExperimentActivity(JSON.parse(event.newValue));
    } catch (_) {}
  });

  // Restore parameters only, never replay a past perturbation.
  setTimeout(() => {
    try {
      const last = JSON.parse(localStorage.getItem(activityKey));
      if (last && last.type === "parameters") {
        applyExperimentActivity(last);
      } else if (last && last.version === 1) {
        applyExperimentActivity({
          ...last,
          id: "restore-" + last.id,
          type: "parameters"
        });
      }
    } catch (_) {}
  }, 0);


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
    const pointerYaw = pointerPosition
      ? ((pointerPosition.x / Math.max(1, width)) - 0.5) * 0.40
      : 0;

    easedPointerYaw +=
      (pointerYaw - easedPointerYaw) * 0.06;

    const yaw = elapsed * 0.020 + easedPointerYaw;
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

    // LIVING_NETWORK_VISUAL_CLARITY_V11
    const visibleLightness = Math.max(
      39,
      Math.min(61, lightness - 10)
    );

    const visibleOpacity = Math.max(0.42, opacity);

    return `hsla(${hue}, 88%, ${visibleLightness}%, ${visibleOpacity})`;
  }


  // LOCALIZED OSCILLATOR INTERACTION V1
  // Pointer coordinates refer to the rendered sphere.
  // The mathematical coupling remains all-to-all.

  let pointerPosition = null;
  let easedPointerYaw = 0;

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

  if (false) canvas.addEventListener("pointermove", event => {
    if (demoMode) return;

    pointerPosition = pointerCoordinates(event);
    draw();
  });

  if (false) canvas.addEventListener("pointerleave", () => {
    pointerPosition = null;
    draw();
  });

  if (false) canvas.addEventListener("click", event => {
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


    // HOMEPAGE_LIVING_NETWORK_V5
    // Local phase-coherence scores for visual emphasis.
    // These do not modify the Kuramoto coupling topology.

    const coherenceSum = new Float64Array(points.length);
    const neighborCount = new Uint16Array(points.length);

    for (const candidate of candidates) {
      const { i, j } = candidate;
      const coherence =
        (1 + Math.cos(points[i].phase - points[j].phase)) / 2;

      coherenceSum[i] += coherence;
      coherenceSum[j] += coherence;
      neighborCount[i]++;
      neighborCount[j]++;
    }

    const clusterCoherence = Array.from(
      coherenceSum,
      (sum, i) => sum / Math.max(1, neighborCount[i])
    );

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


    // HOMEPAGE_LIVING_NETWORK_V1
    // Visual representation of phase relationships.
    // Oscillator equations and interaction topology are unchanged.


    function drawConnection(i, j, strength) {
      const a = points[i];
      const b = points[j];

      const depth = Math.max(
        0,
        Math.min(1, (a.depth + b.depth) / 2)
      );

      const coherence =
        (1 + Math.cos(a.phase - b.phase)) / 2;

      const cluster =
        (clusterCoherence[i] + clusterCoherence[j]) / 2;

      // Favor coherent neighborhoods without obscuring depth.
      const clusterLight =
        Math.max(0, (cluster - 0.55) / 0.45);

      const visibility = 0.35 + 0.65 * depth;

      const opacity = Math.min(
        0.70,
        (
          0.10 +
          0.36 * strength +
          0.13 * clusterLight * coherence
        ) * visibility
      );

      const dx = b.x - a.x;
      const dy = b.y - a.y;

      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;

      const bend =
        0.055 * Math.sin(i * 2.31 + j * 0.73);

      const cx = mx - dy * bend;
      const cy = my + dx * bend;

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(cx, cy, b.x, b.y);

      ctx.strokeStyle =
        `rgba(32,109,139,${Math.min(0.54, Math.max(0.16, opacity * 1.9))})`;

      ctx.lineWidth =
        (0.42 + 0.90 * strength) *
        (0.55 + 0.65 * depth);

      ctx.stroke();

      // Traveling pulses are illustrative activity markers.
      if (
        reducedMotion.matches ||
        strength < 0.10 ||
        (i + j) % 3 !== 0
      ) return;

      const speed = 0.28 + 0.30 * strength;

      const progress = (
        elapsed * speed +
        i * 0.137 +
        j * 0.071
      ) % 1;

      function signalPosition(t) {
        const u = 1 - t;

        return {
          x: u*u*a.x + 2*u*t*cx + t*t*b.x,
          y: u*u*a.y + 2*u*t*cy + t*t*b.y,
          depth: Math.max(
            0,
            Math.min(1, a.depth*u + b.depth*t)
          )
        };
      }

      // Short fading trails follow the Bezier filament.
      // Keep trails restrained to preserve network clarity.
      ctx.save();

      for (let trail = 3; trail >= 1; trail--) {
        const t = progress - trail * 0.028;

        if (t < 0) continue;

        const p = signalPosition(t);

        const trailOpacity =
          (0.16 - trail * 0.035) *
          (0.35 + 0.65 * p.depth);

        const radius =
          (0.6 + 0.9 * strength) *
          (0.55 + 0.65 * p.depth);

        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);

        ctx.fillStyle =
          `rgba(145,255,247,${trailOpacity})`;

        ctx.fill();
      }

      const p = signalPosition(progress);

      const signalVisibility =
        0.40 + 0.60 * p.depth;

      const signalRadius =
        (1.0 + 1.4 * strength) *
        (0.65 + 0.65 * p.depth);

      ctx.globalAlpha = signalVisibility;

      ctx.shadowColor = "rgba(130,255,245,0.95)";
      ctx.shadowBlur = 9 + 8 * strength;

      ctx.beginPath();
      ctx.arc(
        p.x, p.y,
        signalRadius * 2,
        0, Math.PI * 2
      );

      ctx.fillStyle = "rgba(100,255,240,0.22)";
      ctx.fill();

      ctx.shadowBlur = 5;

      ctx.beginPath();
      ctx.arc(
        p.x, p.y,
        signalRadius,
        0, Math.PI * 2
      );

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

      // HOMEPAGE_LIVING_NETWORK_V7
      // Phase color remains the core oscillator encoding.
      // A restrained cyan halo improves visibility.
      ctx.save();

      const glowRadius = particleRadius * 2.4;

      const halo = ctx.createRadialGradient(
        point.x, point.y, particleRadius * 0.3,
        point.x, point.y, glowRadius
      );

      halo.addColorStop(
        0, `rgba(105,245,250,${0.22 + 0.30 * point.depth})`
      );
      halo.addColorStop(1, "rgba(105,245,250,0)");

      ctx.beginPath();
      ctx.arc(
        point.x, point.y, glowRadius,
        0, Math.PI * 2
      );
      ctx.fillStyle = halo;
      ctx.fill();

      ctx.shadowColor = "rgba(74,235,250,0.8)";
      ctx.shadowBlur = 5 + 5 * point.depth;

      ctx.beginPath();
      ctx.arc(
        point.x, point.y, particleRadius,
        0, Math.PI * 2
      );

      ctx.fillStyle =
        phaseColor(
          point.phase,
          lightness,
          opacity
        );

      ctx.fill();

      ctx.restore();
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
