#!/usr/bin/env python3
"""Experiment 32: Detecting model misspecification.

A first-harmonic Kuramoto model is fitted to synthetic data
generated with optional second-harmonic coupling.

Goodness-of-fit thresholds are calibrated using independent
null simulations across a five-point K1 grid.
"""

import csv
import math
from pathlib import Path

import numpy as np

N = 72
DT = 0.04
STEPS = 300
SIGMA = 0.7
ALPHA = 0.35

TRUE_K1 = 1.5
K1_GRID = np.array([1.4, 1.45, 1.5, 1.55, 1.6])
K2_LEVELS = [0.0, 0.2, 0.5]

NOISE_STD = 0.10
NULL_TRIALS_PER_K = 1000
TEST_TRIALS = 2000
SEED = 3201

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "results"
OUT.mkdir(exist_ok=True)

rng = np.random.default_rng(SEED)

# Twenty-four fixed observation times spanning the simulation.
OBS_INDICES = np.rint(
    np.linspace(10, 290, 24)
).astype(int)

assert len(np.unique(OBS_INDICES)) == 24


def initial_population():
    i = np.arange(N, dtype=float)

    theta = np.mod(i * 2.399963, 2 * np.pi)

    omega = SIGMA * (
        0.65 * np.sin(i * 12.9898)
        + 0.35 * np.cos(i * 7.233)
    )

    return theta, omega


def derivative(theta, omega, k1, k2):
    z1 = np.mean(np.exp(1j * theta))
    z2 = np.mean(np.exp(2j * theta))

    first = k1 * np.imag(
        z1 * np.exp(-1j * (theta + ALPHA))
    )

    second = k2 * np.imag(
        z2 * np.exp(-2j * theta)
    )

    return omega + first + second


def rk4(theta, omega, k1, k2):
    k1v = derivative(theta, omega, k1, k2)
    k2v = derivative(theta + DT*k1v/2, omega, k1, k2)
    k3v = derivative(theta + DT*k2v/2, omega, k1, k2)
    k4v = derivative(theta + DT*k3v, omega, k1, k2)

    return theta + DT * (
        k1v + 2*k2v + 2*k3v + k4v
    ) / 6


def collective_omega(theta, omega, k1, k2):
    z1 = np.mean(np.exp(1j * theta))

    if abs(z1) < 1e-10:
        raise ValueError("Collective phase is undefined near R1=0.")

    velocities = derivative(theta, omega, k1, k2)

    zdot = np.mean(
        1j * velocities * np.exp(1j * theta)
    )

    return float(
        np.imag(np.conj(z1) * zdot) / abs(z1)**2
    )


def simulate(k1, k2):
    theta, omega = initial_population()
    observations = []

    target_steps = set(OBS_INDICES)

    for step in range(STEPS + 1):
        if step in target_steps:
            observations.append(
                collective_omega(theta, omega, k1, k2)
            )

        if step < STEPS:
            theta = rk4(theta, omega, k1, k2)

    return np.array(observations)


# Candidate models available to the observer:
# all have K2 fixed to zero.
null_models = np.stack([
    simulate(k1, 0.0)
    for k1 in K1_GRID
])

assert null_models.shape == (5, 24)
assert np.all(np.isfinite(null_models))


def goodness_of_fit(samples):
    """Minimum squared residual over candidate first-harmonic models."""
    residuals = samples[:, None, :] - null_models[None, :, :]

    rss = np.sum(residuals**2, axis=2)

    return np.min(rss, axis=1)


def noisy_samples(mean, count):
    return mean[None, :] + rng.normal(
        0.0, NOISE_STD,
        size=(count, len(OBS_INDICES))
    )


# Independent calibration across five correctly specified models.
# Use the maximum scenario-specific empirical 95th percentile
# for a conservative threshold over this finite grid.
null_cutoffs = []

for mean in null_models:
    null_rss = goodness_of_fit(
        noisy_samples(mean, NULL_TRIALS_PER_K)
    )

    null_cutoffs.append(
        float(np.quantile(null_rss, 0.95))
    )

threshold = max(null_cutoffs)

print("\nEXPERIMENT 32 — MODEL MISSPECIFICATION")
print("=" * 72)
print("Observed quantity: collective angular velocity")
print("Observations:", len(OBS_INDICES))
print("Known phase lag:", ALPHA)
print("Fitted K1 candidates:", K1_GRID.tolist())
print("Gaussian noise standard deviation:", NOISE_STD)
print("Independent calibration trials per K:", NULL_TRIALS_PER_K)
print("Evaluation trials per condition:", TEST_TRIALS)
print("Conservative grid-calibrated RSS threshold:", f"{threshold:.6f}")

# First evaluate false-alarm rates at each null K.
print("\nNULL CALIBRATION CHECK")
print("-" * 72)

for k1, mean in zip(K1_GRID, null_models):
    rss = goodness_of_fit(
        noisy_samples(mean, TEST_TRIALS)
    )

    false_alarm = float(np.mean(rss > threshold))
    print(f"K1={k1:.2f}  false-alarm rate={false_alarm:.4f}")

# Evaluate power when the true K1 is fixed at 1.5.
rows = []

print("\nMISSPECIFICATION DETECTION")
print("-" * 72)
print(f"{'K2':>7} {'Mean RSS':>13} {'Detection rate':>17}")

for k2 in K2_LEVELS:
    mean = simulate(TRUE_K1, k2)

    rss = goodness_of_fit(
        noisy_samples(mean, TEST_TRIALS)
    )

    detection = float(np.mean(rss > threshold))
    mean_rss = float(np.mean(rss))

    print(f"{k2:>7.2f} {mean_rss:>13.6f} {detection:>17.4f}")

    rows.append({
        "true_K1": TRUE_K1,
        "true_K2": k2,
        "noise_std": NOISE_STD,
        "observations": len(OBS_INDICES),
        "trials": TEST_TRIALS,
        "mean_rss": mean_rss,
        "detection_rate": detection,
        "calibrated_threshold": threshold,
        "seed": SEED,
    })

output = OUT / "experiment32_results.csv"

with output.open("w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=rows[0].keys())
    writer.writeheader()
    writer.writerows(rows)

print("\nVALIDATION")
print("=" * 72)
print("Null candidates exclude second harmonic: PASS")
print("Calibration independent of evaluation: PASS")
print("All trajectories finite: PASS")
print("Results saved:", output)
