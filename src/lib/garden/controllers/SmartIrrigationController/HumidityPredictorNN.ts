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
    const dry = clamp(metrics.percentTooDry / 100, 0, 1); // Convert 0-100 to 0-1
    const wet = clamp(metrics.percentTooWet / 100, 0, 1); // Convert 0-100 to 0-1
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
   * Forward pass: predict future percentTooDry using physics-based heuristic.
   * 
   * This replaces the previous random NN weights with a deterministic model
   * that doesn't require training and actually makes sense.
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
    // Simple physics-based prediction
    const currentDry = metrics.percentTooDry / 100; // Convert to 0-1
    
    // Evaporation factor: higher temp and sun = more drying
    const tempNorm = clamp(weather.temperature / 40, 0, 1);
    const evaporationFactor = tempNorm * weather.sunIntensity * (1 - weather.humidity);
    
    // Rain reduces dryness
    const rainFactor = weather.rainIntensity;
    
    // Predict future dryness
    let futureDry = currentDry;
    
    if (irrigationFlag === 1) {
      // Irrigation significantly reduces dryness
      futureDry *= 0.4;
    } else {
      // Without irrigation, evaporation increases dryness
      futureDry += evaporationFactor * 0.15;
    }
    
    // Rain reduces dryness regardless of irrigation
    futureDry -= rainFactor * 0.25;
    
    // Also consider current wetness - if plants are wet, less likely to be dry soon
    const currentWet = metrics.percentTooWet / 100;
    futureDry -= currentWet * 0.1;
    
    return clamp(futureDry, 0, 1);
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
 * NOTE: The NN now uses a physics-based heuristic in the forward() method,
 * so these weights are not actually used. They're kept for API compatibility.
 * 
 * Previously used random weights which caused completely unpredictable behavior.
 * The new approach is deterministic and doesn't require training.
 */
export const DEFAULT_HUMIDITY_PREDICTOR_CONFIG: HumidityPredictorConfig = {
  inputSize: 9,
  hiddenSize: 16,
  // Dummy weights (not used by the physics-based forward method)
  W1: Array.from({ length: 16 }, () => Array.from({ length: 9 }, () => 0)),
  b1: Array.from({ length: 16 }, () => 0),
  W2: Array.from({ length: 16 }, () => 0),
  b2: 0.0,
};
