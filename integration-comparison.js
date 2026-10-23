(() => {
  "use strict";

  const button = document.getElementById("run-integration-comparison");
  const output = document.getElementById("integration-results");
  const status = document.getElementById("integration-status");

  if (!button || !output || !status) return;

  const N = 72;
  const sigma = 0.7;
  const alpha = 0;
  const duration = 40;

  const strengths = [0.5, 1.5, 3.0];
  const timeSteps = [0.04, 0.02, 0.01];
  const referenceStep = 0.0025;

  const core = window.KuramotoCore;

  if (!core) {
    console.error("KuramotoCore was not loaded.");
    return;
  }

  const population = core.initializePopulation(N, sigma);
  const initialPhases = population.phases;
  const frequencies = population.frequencies;

  const orderParameter = core.orderParameter;

  function eulerStep(state, K, dt) {
    return core.eulerStep(
      state, frequencies, K, alpha, dt
    );
  }

  function rk4Step(state, K, dt) {
    return core.rk4Step(
      state, frequencies, K, alpha, dt
    );
  }

  function simulate(K, dt, method) {
    let phases = [...initialPhases];

    const steps = Math.round(duration / dt);
    const values = [orderParameter(phases).R];

    for (let step = 0; step < steps; step++) {
      phases = method === "RK4"
        ? rk4Step(phases, K, dt)
        : eulerStep(phases, K, dt);

      values.push(orderParameter(phases).R);
    }

    return values;
  }

  function meanFinalR(values, dt) {
    const start = Math.round(35 / dt);
    const end = Math.round(40 / dt);

    let area = 0;

    for (let i = start; i < end; i++) {
      area += (values[i] + values[i + 1]) / 2;
    }

    return area / (end - start);
  }

  function trajectoryError(values, dt, reference) {
    const stride = Math.round(dt / referenceStep);

    let maximum = 0;
    let sumSquares = 0;

    for (let i = 0; i < values.length; i++) {
      const error = Math.abs(
        values[i] - reference[i * stride]
      );

      maximum = Math.max(maximum, error);
      sumSquares += error * error;
    }

    return {
      maximum,
      rms: Math.sqrt(sumSquares / values.length)
    };
  }

  function makeTable(rows) {
    const table = document.createElement("table");
    table.className = "comparison-table";

    const head = document.createElement("thead");

    const headerRow = document.createElement("tr");

    for (const label of [
      "Method", "Δt", "Mean R", "Max error", "RMS error"
    ]) {
      const th = document.createElement("th");
      th.textContent = label;
      headerRow.appendChild(th);
    }

    head.appendChild(headerRow);
    table.appendChild(head);

    const body = document.createElement("tbody");

    for (const row of rows) {
      const tr = document.createElement("tr");

      const cells = [
        row.method,
        row.dt.toFixed(4),
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
    return table;
  }

  button.addEventListener("click", () => {
    button.disabled = true;
    status.textContent = "Calculating integration comparison...";

    setTimeout(() => {
      try {
        const fragment = document.createDocumentFragment();

        for (const K of strengths) {
          const reference = simulate(K, referenceStep, "RK4");
          const rows = [];

          for (const dt of timeSteps) {
            for (const method of ["Euler", "RK4"]) {
              const values = simulate(K, dt, method);
              const error = trajectoryError(
                values, dt, reference
              );

              rows.push({
                method,
                dt,
                mean: meanFinalR(values, dt),
                maximum: error.maximum,
                rms: error.rms
              });
            }
          }

          const heading = document.createElement("h4");
          heading.textContent = `Coupling strength K = ${K}`;

          fragment.appendChild(heading);
          fragment.appendChild(makeTable(rows));
        }

        output.replaceChildren(fragment);

        status.textContent =
          "Comparison complete — 18 test simulations " +
          "and 3 reference calculations.";
      } catch (error) {
        console.error(error);
        status.textContent =
          "Calculation failed. Check the browser console.";
      } finally {
        button.disabled = false;
      }
    }, 0);
  });
})();
