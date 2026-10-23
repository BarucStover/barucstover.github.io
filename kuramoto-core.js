/*
 * Kuramoto numerical core
 *
 * Shared mathematical functions for coupled-oscillator experiments.
 * No browser rendering or DOM dependencies.
 */

(() => {
  "use strict";

  function orderParameter(phases) {
    const N = phases.length;

    if (N === 0) {
      throw new Error("Oscillator population cannot be empty.");
    }

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

  function derivative(phases, frequencies, K, alpha = 0) {
    if (phases.length !== frequencies.length) {
      throw new Error("Phase and frequency arrays must match.");
    }

    const { R, psi } = orderParameter(phases);

    return phases.map(
      (theta, i) =>
        frequencies[i] +
        K * R * Math.sin(psi - theta - alpha)
    );
  }

  function addScaled(phases, vector, scale) {
    return phases.map(
      (theta, i) => theta + scale * vector[i]
    );
  }

  function eulerStep(phases, frequencies, K, alpha, dt) {
    const k1 = derivative(phases, frequencies, K, alpha);

    return addScaled(phases, k1, dt);
  }

  function rk4Step(phases, frequencies, K, alpha, dt) {
    const k1 = derivative(phases, frequencies, K, alpha);

    const k2 = derivative(
      addScaled(phases, k1, dt / 2),
      frequencies, K, alpha
    );

    const k3 = derivative(
      addScaled(phases, k2, dt / 2),
      frequencies, K, alpha
    );

    const k4 = derivative(
      addScaled(phases, k3, dt),
      frequencies, K, alpha
    );

    return phases.map(
      (theta, i) =>
        theta + dt / 6 * (
          k1[i] +
          2 * k2[i] +
          2 * k3[i] +
          k4[i]
        )
    );
  }

  function initializePopulation(N, sigma = 0.7) {
    if (!Number.isInteger(N) || N < 1) {
      throw new Error("N must be a positive integer.");
    }

    const phases = [];
    const frequencies = [];

    for (let i = 0; i < N; i++) {
      phases.push(
        (i * 2.399963) % (2 * Math.PI)
      );

      frequencies.push(
        sigma * (
          0.65 * Math.sin(i * 12.9898) +
          0.35 * Math.cos(i * 7.233)
        )
      );
    }

    return { phases, frequencies };
  }

  const API = Object.freeze({
    orderParameter,
    derivative,
    eulerStep,
    rk4Step,
    initializePopulation
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = API;
  }

  if (typeof window !== "undefined") {
    window.KuramotoCore = API;
  }
})();
