// LIVE_EXPERIMENT_ACTIVITY_V1
// Runs on Explore the Model; sends local browser activity only.
(() => {
  "use strict";

  const key = "coupled-oscillators-live-activity-v1";
  const coupling = document.getElementById("coupling");
  const dispersion = document.getElementById("dispersion");
  const phaseLag = document.getElementById("phase-lag");

  if (!coupling || !dispersion || !phaseLag) return;

  const channel = "BroadcastChannel" in window
    ? new BroadcastChannel(key)
    : null;

  let sequence = 0;

  function publish(type) {
    const message = {
      version: 1,
      id: `${Date.now()}-${++sequence}`,
      type,
      K: Number(coupling.value),
      sigma: Number(dispersion.value),
      alpha: Number(phaseLag.value)
    };

    if (![message.K, message.sigma, message.alpha]
        .every(Number.isFinite)) return;

    if (channel) channel.postMessage(message);

    try {
      localStorage.setItem(key, JSON.stringify(message));
    } catch (_) {
      // BroadcastChannel still works when storage is unavailable.
    }
  }

  for (const input of [coupling, dispersion, phaseLag]) {
    input.addEventListener("input", () => publish("parameters"));
  }

  document.getElementById("perturb")
    ?.addEventListener("click", () => publish("perturbation"));

  document.getElementById("reset-model")
    ?.addEventListener("click", () => publish("reset"));

  // Advertise initial settings when the Explore tab opens.
  publish("parameters");
})();
