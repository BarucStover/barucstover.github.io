(() => {
  "use strict";

  const button = document.getElementById("run-recovery");
  const output = document.getElementById("recovery-results");
  const status = document.getElementById("recovery-status");

  if (!button || !output || !status) return;

  const N = 72;
  const sigma = 0.7;
  const alpha = 0;
  const dt = 0.04;

  const perturbTime = 20;
  const endTime = 40;
  const holdDuration = 2;

  const couplingStrengths = [0.5, 1.5, 3.0];

  const core = window.KuramotoCore;

  if (!core) {
    console.error("KuramotoCore was not loaded.");
    return;
  }

  const population = core.initializePopulation(N, sigma);
  const initialPhases = population.phases;
  const frequencies = population.frequencies;

  const orderParameter = core.orderParameter;

  function rk4(state, K) {
    return core.rk4Step(state, frequencies, K, alpha, dt);
  }

  function runExperiment(K) {
    let phases = [...initialPhases];

    const preSteps = Math.round(perturbTime / dt);
    const postSteps = Math.round(
      (endTime - perturbTime) / dt
    );

    for (let step = 0; step < preSteps; step++) {
      phases = rk4(phases, K);
    }

    const before = orderParameter(phases).R;

    // Same deterministic disturbance as the live sphere.
    phases = phases.map(
      (theta, i) =>
        theta + Math.sin(i * 3.17 + perturbTime) * 1.8
    );

    const after = orderParameter(phases).R;
    const trajectory = [after];

    for (let step = 0; step < postSteps; step++) {
      phases = rk4(phases, K);
      trajectory.push(orderParameter(phases).R);
    }

    // Recovery means reaching 90% of pre-perturbation
    // coherence and remaining there for 2 time units.
    // Only evaluate recovery when initially synchronized.
    const eligible = before >= 0.9;
    const target = 0.9 * before;
    const holdSteps = Math.round(holdDuration / dt);

    let recovery = null;

    if (eligible) {
      for (
        let i = 0;
        i + holdSteps < trajectory.length;
        i++
      ) {
        let sustained = true;

        for (let j = i; j <= i + holdSteps; j++) {
          if (trajectory[j] < target) {
            sustained = false;
            break;
          }
        }

        if (sustained) {
          recovery = i * dt;
          break;
        }
      }
    }

    return {
      K,
      before,
      after,
      loss: before - after,
      target,
      eligible,
      recovery,
      finalR: trajectory[trajectory.length - 1]
    };
  }

  function addCell(row, value, tag = "td") {
    const cell = document.createElement(tag);
    cell.textContent = value;
    row.appendChild(cell);
  }

  button.addEventListener("click", () => {
    button.disabled = true;
    status.textContent = "Running controlled recovery experiment...";

    setTimeout(() => {
      try {
        const results = couplingStrengths.map(runExperiment);

        const table = document.createElement("table");
        table.className = "comparison-table";

        const header = document.createElement("tr");

        [
          "K",
          "R before",
          "R after",
          "Coherence loss",
          "Recovery time",
          "R at t=40"
        ].forEach(label => addCell(header, label, "th"));

        const thead = document.createElement("thead");
        thead.appendChild(header);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");

        for (const result of results) {
          const row = document.createElement("tr");

          addCell(row, result.K.toFixed(1));
          addCell(row, result.before.toFixed(5));
          addCell(row, result.after.toFixed(5));
          addCell(row, result.loss.toFixed(5));

          const recoveryText = !result.eligible
            ? "N/A — not initially synchronized"
            : result.recovery === null
              ? "Not reached"
              : result.recovery.toFixed(2);

          addCell(row, recoveryText);
          addCell(row, result.finalR.toFixed(5));

          tbody.appendChild(row);
        }

        table.appendChild(tbody);
        output.replaceChildren(table);

        status.textContent =
          "Recovery experiment complete — 3 conditions tested.";
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
