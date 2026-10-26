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

  const core = window.KuramotoCore;

  if (!core) {
    console.error("KuramotoCore was not loaded.");
    return;
  }

  function simulate(K) {
    const initial = core.initializePopulation(N, sigma);

    let phases = initial.phases;
    const frequencies = initial.frequencies;

    const trajectory = [{
      time: 0,
      R: core.orderParameter(phases).R
    }];

    for (let step = 1; step <= steps; step++) {
      phases = core.eulerStep(
        phases,
        frequencies,
        K,
        alpha,
        dt
      );

      trajectory.push({
        time: step * dt,
        R: core.orderParameter(phases).R
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

    // Reveal the chart container before drawing.
    const chartWrap = document.querySelector(
      "#coupling-experiment .comparison-chart-wrap"
    );

    if (chartWrap) {
      chartWrap.classList.add("analysis-ready");
    }

    // Reveal the canvas as well as its container.
    canvas.classList.add("analysis-ready");

    requestAnimationFrame(() => {
      draw();
    });
    renderResults();

    status.textContent =
      "Comparison complete — identical initial conditions, three coupling strengths.";
  });

  window.addEventListener("resize", () => {
    if (trials.length) draw();
  });
})();
