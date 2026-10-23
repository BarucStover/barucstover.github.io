(() => {
  "use strict";

  const button = document.getElementById("run-convergence");
  const output = document.getElementById("convergence-results");
  const status = document.getElementById("convergence-status");

  if (!button || !output || !status) return;

  const N = 72;
  const sigma = 0.7;
  const alpha = 0;
  const duration = 40;

  const strengths = [0.5, 1.5, 3.0];
  const steps = [0.04, 0.02, 0.01];
  const referenceStep = 0.005;

  const core = window.KuramotoCore;

  if (!core) {
    console.error("KuramotoCore was not loaded.");
    return;
  }

  function simulate(K, dt) {
    const population = core.initializePopulation(N, sigma);

    let phases = population.phases;
    const frequencies = population.frequencies;

    const steps = Math.round(duration / dt);
    const values = [core.orderParameter(phases).R];

    for (let step = 0; step < steps; step++) {
      phases = core.eulerStep(
        phases,
        frequencies,
        K,
        alpha,
        dt
      );

      values.push(core.orderParameter(phases).R);
    }

    return values;
  }

  function finalMean(values, dt) {
    const start = Math.round(35 / dt);
    const end = Math.round(40 / dt);

    // Trapezoidal time average over t = 35 to 40.
    let sum = 0;

    for (let i = start; i < end; i++) {
      sum += (values[i] + values[i + 1]) / 2;
    }

    return sum / (end - start);
  }

  function compare(values, dt, reference) {
    // Every tested step is an integer multiple of 0.005.
    const stride = Math.round(dt / referenceStep);

    let maximum = 0;
    let squared = 0;

    for (let i = 0; i < values.length; i++) {
      const difference = Math.abs(
        values[i] - reference[i * stride]
      );

      maximum = Math.max(maximum, difference);
      squared += difference * difference;
    }

    return {
      maximum,
      rms: Math.sqrt(squared / values.length)
    };
  }

  button.addEventListener("click", () => {
    button.disabled = true;
    status.textContent = "Calculating convergence...";

    // Allow the status to render before calculations begin.
    setTimeout(() => {
      try {
        const rows = [];

        for (const K of strengths) {
          const reference = simulate(K, referenceStep);

          for (const dt of steps) {
            const values = simulate(K, dt);
            const error = compare(values, dt, reference);

            rows.push({
              K,
              dt,
              mean: finalMean(values, dt),
              maximum: error.maximum,
              rms: error.rms
            });
          }
        }

        const table = document.createElement("table");
        table.className = "comparison-table";

        const header = document.createElement("thead");
        header.innerHTML = `
          <tr>
            <th>K</th>
            <th>Δt</th>
            <th>Mean R</th>
            <th>Max error</th>
            <th>RMS error</th>
          </tr>
        `;

        table.appendChild(header);

        const body = document.createElement("tbody");

        for (const row of rows) {
          const tr = document.createElement("tr");

          const cells = [
            row.K.toFixed(1),
            row.dt.toFixed(3),
            row.mean.toFixed(5),
            row.maximum.toExponential(2),
            row.rms.toExponential(2)
          ];

          for (const value of cells) {
            const td = document.createElement("td");
            td.textContent = value;
            tr.appendChild(td);
          }

          body.appendChild(tr);
        }

        table.appendChild(body);
        output.replaceChildren(table);

        status.textContent =
          "Convergence test complete — 9 simulations compared.";
      } catch (error) {
        console.error(error);
        status.textContent =
          "The calculation failed. Check the browser console.";
      } finally {
        button.disabled = false;
      }
    }, 0);
  });
})();
