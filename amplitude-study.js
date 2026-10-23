(() => {
  "use strict";

  const button = document.getElementById("run-amplitude-study");
  const output = document.getElementById("amplitude-results");
  const status = document.getElementById("amplitude-status");

  if (!button || !output || !status) return;

  const N = 72;
  const dt = 0.04;
  const sigma = 0.7;
  const alpha = 0;

  const couplingValues = [0.5, 1.5, 3.0];
  const amplitudes = [0.25, 0.5, 1.0, 1.5, 2.0, 2.5];

  const perturbTime = 20;
  const endTime = 40;
  const holdSteps = Math.round(2 / dt);

  const initial = Array.from(
    { length: N },
    (_, i) => (i * 2.399963) % (2 * Math.PI)
  );

  const frequencies = Array.from(
    { length: N },
    (_, i) => sigma * (
      0.65 * Math.sin(i * 12.9898) +
      0.35 * Math.cos(i * 7.233)
    )
  );

  function order(state) {
    let x = 0;
    let y = 0;

    for (const theta of state) {
      x += Math.cos(theta);
      y += Math.sin(theta);
    }

    return {
      R: Math.hypot(x / N, y / N),
      psi: Math.atan2(y, x)
    };
  }

  function derivative(state, K) {
    const { R, psi } = order(state);

    return state.map((theta, i) =>
      frequencies[i] +
      K * R * Math.sin(psi - theta - alpha)
    );
  }

  function scaled(state, k, factor) {
    return state.map(
      (theta, i) => theta + factor * k[i]
    );
  }

  function rk4(state, K) {
    const k1 = derivative(state, K);
    const k2 = derivative(scaled(state, k1, dt / 2), K);
    const k3 = derivative(scaled(state, k2, dt / 2), K);
    const k4 = derivative(scaled(state, k3, dt), K);

    return state.map((theta, i) =>
      theta + dt / 6 * (
        k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]
      )
    );
  }

  function prepareState(K) {
    let state = [...initial];

    for (let i = 0; i < Math.round(perturbTime / dt); i++) {
      state = rk4(state, K);
    }

    return state;
  }

  function experiment(K, A, baseline) {
    const before = order(baseline).R;

    let state = baseline.map(
      (theta, i) =>
        theta + A * Math.sin(i * 3.17 + perturbTime)
    );

    const after = order(state).R;
    const trajectory = [after];

    for (
      let i = 0;
      i < Math.round((endTime - perturbTime) / dt);
      i++
    ) {
      state = rk4(state, K);
      trajectory.push(order(state).R);
    }

    const eligible = before >= 0.9;
    const target = 0.9 * before;

    // A disturbance that does not take the population
    // below the target has zero threshold-recovery time.
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
      A,
      before,
      after,
      loss: before - after,
      recovery,
      eligible,
      finalR: trajectory[trajectory.length - 1]
    };
  }

  function cell(row, value, tag = "td") {
    const element = document.createElement(tag);
    element.textContent = value;
    row.appendChild(element);
  }

  button.addEventListener("click", () => {
    button.disabled = true;
    status.textContent = "Calculating amplitude study...";

    setTimeout(() => {
      try {
        const results = [];

        for (const K of couplingValues) {
          const baseline = prepareState(K);

          for (const A of amplitudes) {
            results.push(experiment(K, A, baseline));
          }
        }

        const table = document.createElement("table");
        table.className = "comparison-table";

        const head = document.createElement("thead");
        const header = document.createElement("tr");

        [
          "K",
          "Amplitude",
          "R before",
          "R after",
          "Coherence loss",
          "Recovery time"
        ].forEach(label => cell(header, label, "th"));

        head.appendChild(header);
        table.appendChild(head);

        const body = document.createElement("tbody");

        for (const result of results) {
          const row = document.createElement("tr");

          cell(row, result.K.toFixed(1));
          cell(row, result.A.toFixed(2));
          cell(row, result.before.toFixed(5));
          cell(row, result.after.toFixed(5));
          cell(row, result.loss.toFixed(5));

          const recovery = !result.eligible
            ? "N/A"
            : result.recovery === null
              ? "Not reached"
              : result.recovery.toFixed(2);

          cell(row, recovery);
          body.appendChild(row);
        }

        table.appendChild(body);
        output.replaceChildren(table);

        status.textContent =
          "Amplitude study complete — 18 conditions tested.";
      } catch (error) {
        console.error(error);
        status.textContent = "Calculation failed.";
      } finally {
        button.disabled = false;
      }
    }, 0);
  });
})();
