(() => {
  "use strict";

  const button = document.getElementById("run-coupling-comparison");
  const canvas = document.getElementById("comparison-chart");
  const results = document.getElementById("comparison-results");
  const status = document.getElementById("comparison-status");

  if (!button || !canvas || !results || !status) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const N = 72;
  const sigma = 0.7;
  const alpha = 0;
  const dt = 0.04;
  const duration = 40;
  const steps = Math.round(duration / dt);

  const conditions = [
    { K: 0.5, color: "#8d78c8" },
    { K: 1.5, color: "#2789a0" },
    { K: 3.0, color: "#4b947b" }
  ];

  let trials = [];

  function initialConditions() {
    const phases = [];
    const frequencies = [];

    for (let i = 0; i < N; i++) {
      phases.push((i * 2.399963) % (2 * Math.PI));

      frequencies.push(
        sigma * (
          Math.sin(i * 12.9898) * 0.65 +
          Math.cos(i * 7.233) * 0.35
        )
      );
    }

    return { phases, frequencies };
  }

  function orderParameter(phases) {
    let real = 0;
    let imaginary = 0;

    for (const theta of phases) {
      real += Math.cos(theta);
      imaginary += Math.sin(theta);
    }

    real /= phases.length;
    imaginary /= phases.length;

    return {
      R: Math.hypot(real, imaginary),
      psi: Math.atan2(imaginary, real)
    };
  }

  function simulate(K) {
    const initial = initialConditions();
    let phases = initial.phases;
    const frequencies = initial.frequencies;

    const trajectory = [{
      time: 0,
      R: orderParameter(phases).R
    }];

    for (let step = 1; step <= steps; step++) {
      const { R, psi } = orderParameter(phases);

      phases = phases.map((theta, i) => {
        const velocity =
          frequencies[i] +
          K * R * Math.sin(psi - theta - alpha);

        return (theta + velocity * dt) % (2 * Math.PI);
      });

      trajectory.push({
        time: step * dt,
        R: orderParameter(phases).R
      });
    }

    return trajectory;
  }

  function sustainedSynchronization(data) {
    const windowSteps = Math.round(5 / dt);

    for (let i = 0; i + windowSteps < data.length; i++) {
      let sustained = true;

      for (let j = i; j <= i + windowSteps; j++) {
        if (data[j].R < 0.9) {
          sustained = false;
          break;
        }
      }

      if (sustained) return data[i].time;
    }

    return null;
  }

  function draw() {
    if (!trials.length) return;

    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    if (w < 50 || h < 50) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const left = 39;
    const right = 14;
    const top = 20;
    const bottom = 36;

    const pw = w - left - right;
    const ph = h - top - bottom;

    const x = time => left + (time / duration) * pw;
    const y = R => top + (1 - R) * ph;

    ctx.font = "11px Arial, sans-serif";
    ctx.fillStyle = "#617985";
    ctx.strokeStyle = "#e0eaea";
    ctx.lineWidth = 1;

    for (const value of [0, 0.5, 0.9, 1]) {
      ctx.beginPath();
      ctx.moveTo(left, y(value));
      ctx.lineTo(w - right, y(value));
      ctx.stroke();

      ctx.fillText(String(value), 7, y(value) + 4);
    }

    for (const time of [0, 10, 20, 30, 40]) {
      ctx.fillText(String(time), x(time) - 5, h - 13);
    }

    for (const trial of trials) {
      ctx.beginPath();
      ctx.strokeStyle = trial.color;
      ctx.lineWidth = 2;

      trial.data.forEach((point, i) => {
        if (i === 0) {
          ctx.moveTo(x(point.time), y(point.R));
        } else {
          ctx.lineTo(x(point.time), y(point.R));
        }
      });

      ctx.stroke();
    }
  }

  function renderResults() {
    const rows = trials.map(trial => {
      const finalWindow = trial.data.filter(p => p.time >= 35);
      const mean = finalWindow.reduce((s, p) => s + p.R, 0)
        / finalWindow.length;

      const syncTime = sustainedSynchronization(trial.data);

      return `
        <tr>
          <td>
            <span style="color:${trial.color};font-weight:bold">●</span>
            K = ${trial.K.toFixed(1)}
          </td>
          <td>${mean.toFixed(3)}</td>
          <td>${syncTime === null
            ? "Not reached"
            : syncTime.toFixed(2)}</td>
        </tr>
      `;
    }).join("");

    results.innerHTML = `
      <table class="comparison-table">
        <thead>
          <tr>
            <th>Condition</th>
            <th>Mean R (t = 35–40)</th>
            <th>Sustained R ≥ 0.9</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  button.addEventListener("click", () => {
    trials = conditions.map(condition => ({
      ...condition,
      data: simulate(condition.K)
    }));

    draw();
    renderResults();

    status.textContent =
      "Comparison complete — identical initial conditions, three coupling strengths.";
  });

  window.addEventListener("resize", () => {
    if (trials.length) draw();
  });
})();
