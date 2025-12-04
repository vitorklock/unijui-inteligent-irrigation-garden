import { Simulation, Weather, IrrigationController } from "../../types";

/**
 * Helper to clamp a value to [min, max]
 */
function clamp(x: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, x));
}

export interface HumidityPredictorConfig {
  /** Number of input features */
  inputSize: number;
  /** Number of hidden neurons */
  hiddenSize: number;
  /** Weights for first layer: [hiddenSize][inputSize] */
  W1: number[][];
  /** Biases for first layer: [hiddenSize] */
  b1: number[];
  /** Weights for output layer: [hiddenSize] */
  W2: number[];
  /** Bias for output neuron */
  b2: number;
}

/**
 * HumidityPredictorNN
 *
 * A small 2-layer feedforward neural network (MLP) for predicting future dryness.
 *
 * Architecture:
 * - Input layer: Features from metrics + weather + action flag
 * - Hidden layer: ReLU activation
 * - Output layer: Sigmoid activation → [0, 1] (predicted percentTooDry)
 *
 * The weights are hardcoded (trained offline via Python or a separate training loop).
 * At runtime, the controller uses this NN to predict future dryness for two scenarios:
 * 1. If irrigation stays OFF
 * 2. If irrigation turns ON
 *
 * This comparison allows the controller to choose the action that minimizes future dryness risk.
 */
export class HumidityPredictorNN implements IrrigationController {
  private cfg: HumidityPredictorConfig;

  constructor(cfg: HumidityPredictorConfig) {
    this.cfg = cfg;
  }

  /**
   * ReLU activation: max(0, x)
   */
  private relu(x: number): number {
    return x > 0 ? x : 0;
  }

  /**
   * Sigmoid activation: 1 / (1 + e^-x)
   */
  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-Math.min(500, Math.max(-500, x)))); // clamp to avoid overflow
  }

  /**
   * Dense layer: W @ x + b with given activation function
   *
   * @param W - Weight matrix [outputSize][inputSize]
   * @param b - Bias vector [outputSize]
   * @param x - Input vector [inputSize]
   * @param activation - Activation function to apply
   * @returns Output vector [outputSize]
   */
  private dense(
    W: number[][],
    b: number[],
    x: number[],
    activation: (z: number) => number
  ): number[] {
    const out: number[] = new Array(b.length);

    for (let i = 0; i < b.length; i++) {
      let z = b[i];
      const Wi = W[i];
      for (let j = 0; j < x.length; j++) {
        z += Wi[j] * x[j];
      }
      out[i] = activation(z);
    }

    return out;
  }

  /**
   * Construct input feature vector from simulation state.
   *
   * Features capture current conditions that influence future dryness:
   * - Weather: temperature, humidity, sun, rain
   * - Soil state: current moisture levels, time of day
   * - Action: whether irrigation will be ON in the prediction scenario
   *
   * @param metrics - Current metrics
   * @param weather - Current weather
   * @param state - Current simulation state
   * @param irrigationFlag - 0 = OFF (no watering), 1 = ON (watering)
   * @returns Feature vector for the NN
   */
  buildInputFeatures(
    metrics: Simulation.Metrics,
    weather: Weather.State,
    state: Simulation.State,
    irrigationFlag: 0 | 1
  ): number[] {
    // Normalize to [0, 1]
    const tempNorm = clamp(weather.temperature / 40, 0, 1); // assume 0–40°C
    const humNorm = clamp(weather.humidity, 0, 1); // 0–1
    const sunNorm = clamp(weather.sunIntensity, 0, 1); // 0–1
    const rainNorm = clamp(weather.rainIntensity, 0, 1); // 0–1

    const timeOfDay = clamp(metrics.timeOfDay, 0, 1);
    const dry = clamp(metrics.percentTooDry, 0, 1);
    const wet = clamp(metrics.percentTooWet, 0, 1);
    const avgMoisture = clamp(metrics.avgMoisture / 1.5, 0, 1); // normalize ~[0, 1.5] to [0, 1]

    // Build feature vector (9 features)
    return [
      tempNorm,
      humNorm,
      sunNorm,
      rainNorm,
      timeOfDay,
      dry,
      wet,
      avgMoisture,
      irrigationFlag,
    ];
  }

  /**
   * Forward pass: predict future percentTooDry.
   *
   * @param metrics - Current metrics
   * @param weather - Current weather
   * @param state - Current simulation state
   * @param irrigationFlag - 0 or 1 for the hypothetical scenario
   * @returns Predicted percentTooDry in [0, 1] at t + horizon
   */
  private forward(
    metrics: Simulation.Metrics,
    weather: Weather.State,
    state: Simulation.State,
    irrigationFlag: 0 | 1
  ): number {
    const x = this.buildInputFeatures(metrics, weather, state, irrigationFlag);

    if (x.length !== this.cfg.inputSize) {
      throw new Error(
        `NN input size mismatch: got ${x.length}, expected ${this.cfg.inputSize}`
      );
    }

    // First layer: hidden = ReLU(W1 @ x + b1)
    const hidden = this.dense(this.cfg.W1, this.cfg.b1, x, this.relu);

    // Second layer: output = sigmoid(W2 @ hidden + b2)
    let z = this.cfg.b2;
    for (let i = 0; i < hidden.length; i++) {
      z += this.cfg.W2[i] * hidden[i];
    }

    const out = this.sigmoid(z);
    return clamp(out, 0, 1);
  }

  /**
   * Public method: predict future dryness.
   *
   * @param metrics - Current metrics
   * @param weather - Current weather
   * @param state - Current simulation state
   * @param irrigationFlag - 0 (OFF) or 1 (ON) for the scenario
   * @returns Predicted percentTooDry in [0, 1]
   */
  predictFutureDryness(
    metrics: Simulation.Metrics,
    weather: Weather.State,
    state: Simulation.State,
    irrigationFlag: 0 | 1
  ): number {
    return this.forward(metrics, weather, state, irrigationFlag);
  }

  /**
   * Dummy implement IrrigationController interface (not used in practice).
   * The SmartIrrigationController uses this NN as a component, not directly.
   */
  decide(_metrics: Simulation.Metrics, _state: Simulation.State): boolean {
    return false;
  }
}

/**
 * Default configuration for HumidityPredictorNN.
 *
 * This is a small randomly-initialized network for demonstration.
 * In a real system, you'd train this offline (in Python or via a training script)
 * on simulation data, then export the weights to use here.
 *
 * The weights are frozen at runtime (not updated online).
 */
export const DEFAULT_HUMIDITY_PREDICTOR_CONFIG: HumidityPredictorConfig = {
  inputSize: 9,
  hiddenSize: 16,
  // Random-like weights for demo (would be trained in practice)
  W1: Array.from({ length: 16 }, () =>
    Array.from({ length: 9 }, () => (Math.random() - 0.5) * 0.5)
  ),
  b1: Array.from({ length: 16 }, () => (Math.random() - 0.5) * 0.1),
  W2: Array.from({ length: 16 }, () => (Math.random() - 0.5) * 0.5),
  b2: 0.0,
};
