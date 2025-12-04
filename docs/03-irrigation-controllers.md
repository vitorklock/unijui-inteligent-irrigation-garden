# Irrigation Controllers

## Overview

Irrigation controllers are the decision-making components of the simulation system. They implement the `IrrigationController` interface and determine when to turn irrigation on or off based on current metrics and simulation state.

Controllers enable testing different irrigation strategies, from simple rule-based approaches to sophisticated AI-driven systems.

## Table of Contents

- [Controller Interface](#controller-interface)
- [Controller Types](#controller-types)
- [Always On Controller](#always-on-controller)
- [Always Off Controller](#always-off-controller)
- [Dumb Controller](#dumb-controller)
- [Manual Controller](#manual-controller)
- [Controller Comparison](#controller-comparison)
- [Usage Examples](#usage-examples)

---

## Controller Interface

All controllers must implement the `IrrigationController` interface:

```typescript
interface IrrigationController {
    decide(metrics: Simulation.Metrics, state: Simulation.State): boolean;
}
```

### Method Signature

**`decide(metrics, state): boolean`**

Called every simulation tick to determine irrigation state.

**Parameters**:
- `metrics`: Current garden metrics (moisture levels, plant health percentages, etc.)
- `state`: Complete simulation state (tick, weather, configuration, etc.)

**Returns**:
- `true`: Turn irrigation ON (water will be applied this tick)
- `false`: Turn irrigation OFF (no watering this tick)

**Execution Context**:
- Called at the beginning of each tick (before moisture update)
- Decision affects the current tick's moisture physics
- Can use historical state data and forecasts for decision-making

---

## Controller Types

The system provides several built-in controllers for different use cases:

| Controller | Strategy | Use Case |
|------------|----------|----------|
| **Always On** | Constant watering | Baseline comparison, water abundance |
| **Always Off** | No watering | Baseline comparison, rain-only simulation |
| **Dumb** | Simple threshold rules | Reactive control, basic automation |
| **Manual** | User-controlled | Interactive testing, debugging |
| **Smart** | AI/ML-based | Optimization, learning systems *(see separate docs)* |

---

## Always On Controller

### Overview

The simplest controller: irrigation is **always active**, regardless of conditions.

### Implementation

```typescript
class AlwaysOnIrrigationController implements IrrigationController {
    decide(metrics: Simulation.Metrics, state: Simulation.State): boolean {
        return true;
    }
}
```

### Characteristics

**Decision Logic**:
- Ignores all metrics and state
- Always returns `true`
- Irrigation runs continuously from tick 0 to episode end

**Behavior**:
- Maximum water usage
- Plants tend toward flooding if irrigation rate is high
- Useful for establishing upper bound on water consumption

### Performance Profile

**Strengths**:
- ✅ Prevents dryness completely (in most configurations)
- ✅ Simple to understand and implement
- ✅ Provides baseline for comparison

**Weaknesses**:
- ❌ Extremely wasteful of water
- ❌ High risk of flooding plants
- ❌ Poor score due to water inefficiency penalty
- ❌ No adaptation to weather or plant needs

### Expected Results

**Typical Episode Outcome**:
- `totalWaterUsed`: Very high (~maximum possible)
- `dryPlantTicks`: Near zero
- `floodedPlantTicks`: Moderate to high (especially with high irrigation rate)
- `healthyPlantTicks`: Moderate (some flooding issues)
- `finalScore`: 30-50 (penalized for water waste and flooding)

**When to Use**:
- Baseline performance measurement
- Testing maximum water capacity of system
- Scenarios with abundant water supply and no efficiency concerns
- Debugging: Verify irrigation system coverage

---

## Always Off Controller

### Overview

The opposite extreme: irrigation is **never active**.

### Implementation

```typescript
class AlwaysOffIrrigationController implements IrrigationController {
    decide(metrics: Simulation.Metrics, state: Simulation.State): boolean {
        return false;
    }
}
```

### Characteristics

**Decision Logic**:
- Ignores all metrics and state
- Always returns `false`
- Irrigation never runs (water comes only from rain)

**Behavior**:
- Zero water usage
- Garden relies entirely on rainfall and initial moisture
- Plants will likely become dry unless rain is frequent

### Performance Profile

**Strengths**:
- ✅ Maximum water efficiency (perfect waterScore)
- ✅ No flooding risk
- ✅ Simple implementation

**Weaknesses**:
- ❌ High dryness unless rainfall is very frequent
- ❌ Plants suffer during dry spells
- ❌ Poor score due to high dry plant penalties
- ❌ No responsiveness to plant needs

### Expected Results

**Typical Episode Outcome**:
- `totalWaterUsed`: 0 (zero irrigation)
- `dryPlantTicks`: Very high (most plants dry most of the time)
- `floodedPlantTicks`: Low (only during heavy rain)
- `healthyPlantTicks`: Low to moderate (only during/after rain)
- `finalScore`: 20-40 (penalized for excessive dryness despite perfect water efficiency)

**When to Use**:
- Baseline performance measurement (opposite extreme from Always On)
- Rain-only scenarios (testing natural rainfall sufficiency)
- Water conservation studies
- Testing evaporation and diffusion physics without irrigation

---

## Dumb Controller

### Overview

A **threshold-based reactive controller** that uses simple rules to respond to moisture conditions. It represents basic automated irrigation without sophisticated logic.

### Implementation

```typescript
class DumbIrrigationController implements IrrigationController {
    private moistureLow: number;   // Default: IDEAL_MIN_MOISTURE (0.1)
    private moistureHigh: number;  // Default: 1.0
    
    constructor(moistureLow = 0.1, moistureHigh = 1.0) {
        this.moistureLow = moistureLow;
        this.moistureHigh = moistureHigh;
    }
    
    decide(metrics: Simulation.Metrics, state: Simulation.State): boolean {
        // Emergency shutoff: Prevent flooding
        if (metrics.percentTooWet > 5) {
            return false;
        }
        
        // Activate if significant dryness AND low average moisture
        if (metrics.percentTooDry > 15 && metrics.avgMoisture < this.moistureHigh) {
            return true;
        }
        
        // Default: Off (conservative to prevent flooding)
        return false;
    }
}
```

### Decision Logic

The Dumb Controller uses a **two-rule priority system**:

#### Rule 1: Flood Prevention (Highest Priority)

```typescript
if (percentTooWet > 5%) → Turn OFF
```

**Rationale**: 
- Immediately stop irrigation if >5% of plants are flooded
- Prevents runaway flooding situations
- Prioritizes damage control over watering needs

**Threshold Explanation**:
- 5% is a safety margin (tolerates minor flooding)
- If 1-2 plants out of 40 are slightly wet, don't panic
- If 3+ plants are flooded, it's a systemic problem

---

#### Rule 2: Dryness Response (Secondary Priority)

```typescript
if (percentTooDry > 15% AND avgMoisture < moistureHigh) → Turn ON
```

**Rationale**:
- Only water if there's significant dryness (>15% of plants)
- AND average moisture is still below the high threshold
- Prevents watering when just a few plants are dry but most are fine

**Dual-Condition Explanation**:
- `percentTooDry > 15%`: Ensures it's a widespread problem, not isolated
- `avgMoisture < moistureHigh`: Prevents watering already-wet gardens

**Example Scenarios**:

| percentTooDry | avgMoisture | Decision | Reason |
|---------------|-------------|----------|--------|
| 20% | 0.6 | **ON** | Significant dryness, average is safe |
| 20% | 1.1 | **OFF** | Despite dryness, average too high (risk of flooding) |
| 10% | 0.4 | **OFF** | Dryness below threshold (only ~4 plants dry) |
| 25% | 0.8 | **ON** | Many plants dry, safe to water |

---

#### Rule 3: Default State

```typescript
otherwise → Turn OFF
```

**Rationale**:
- Conservative default (prevents accidental flooding)
- Better to err on the side of under-watering than over-watering
- Relies on Rule 2 to activate when truly needed

---

### Configuration

The controller accepts two parameters:

**`moistureLow`** (default: 0.1)
- Represents the minimum acceptable moisture
- Currently used for reference but not in decision logic
- Could be extended for hysteresis or more complex rules

**`moistureHigh`** (default: 1.0)
- Upper safety threshold for average moisture
- Prevents watering when garden is already well-watered
- Adjustable for different tolerance levels

**Tuning Examples**:
```typescript
// Conservative (avoid flooding at all costs)
new DumbIrrigationController(0.1, 0.8);

// Moderate (default)
new DumbIrrigationController(0.1, 1.0);

// Aggressive (tolerate higher moisture)
new DumbIrrigationController(0.1, 1.2);
```

---

### Behavior Characteristics

**Reactive Nature**:
- Responds to current conditions only (no prediction)
- No memory of past decisions
- No awareness of time of day or forecasts

**Oscillation Pattern**:
```
Typical behavior cycle:
1. Plants dry out → percentTooDry rises above 15%
2. Controller turns ON
3. Irrigation floods some plants → percentTooWet > 5%
4. Controller turns OFF
5. Repeat cycle
```

**Strengths of Oscillation**:
- ✅ Self-correcting (won't stay in bad state forever)
- ✅ Adapts to changing conditions
- ✅ Prevents both extremes (complete dryness or flooding)

**Weaknesses of Oscillation**:
- ❌ Inefficient water use (reactive rather than preventive)
- ❌ Plants experience stress cycles
- ❌ High toggle count (frequent on/off switching)

---

### Performance Profile

**Expected Results**:
- `finalScore`: 50-70 (moderate performance)
- `dryPlantTicks`: Moderate (some dry spells between reactions)
- `floodedPlantTicks`: Low to moderate (flood prevention rule helps)
- `healthyPlantTicks`: Moderate to good (alternates between dry and healthy)
- `totalWaterUsed`: Moderate (less than Always On, more than optimal)
- `irrigationToggleCount`: High (frequent switching)

**Comparison to Baselines**:
- Better than Always On (less flooding, better water efficiency)
- Better than Always Off (prevents severe dryness)
- Worse than optimal AI controller (reactive, not predictive)

---

### When to Use

**Appropriate Scenarios**:
- ✅ Simple automation needs
- ✅ Systems without advanced sensors or AI
- ✅ Baseline for comparing smarter controllers
- ✅ Educational purposes (demonstrates reactive control)
- ✅ Fallback controller if smart systems fail

**Inappropriate Scenarios**:
- ❌ When optimal performance is required
- ❌ Scenarios with predictable weather patterns (wastes opportunity to optimize)
- ❌ Water-scarce environments (too reactive, not efficient enough)
- ❌ High-value crops (oscillation causes unnecessary stress)

---

## Manual Controller

### Overview

A **user-controlled controller** that allows external systems (UI, scripts, tests) to directly control irrigation state.

### Implementation

```typescript
class ManualIrrigationController implements IrrigationController {
    private irrigationEnabled: boolean = false;
    
    setIrrigation(enabled: boolean): void {
        this.irrigationEnabled = enabled;
    }
    
    isIrrigationEnabled(): boolean {
        return this.irrigationEnabled;
    }
    
    decide(metrics: Simulation.Metrics, state: Simulation.State): boolean {
        return this.irrigationEnabled;
    }
}
```

### Characteristics

**Decision Logic**:
- Returns current value of internal `irrigationEnabled` flag
- Completely ignores metrics and state
- External code controls behavior via `setIrrigation()`

**State Management**:
- Internal boolean flag stores irrigation state
- Persists across ticks until explicitly changed
- Default state: OFF (false)

---

### API Methods

#### `setIrrigation(enabled: boolean): void`

**Purpose**: Set irrigation state externally.

**Parameters**:
- `enabled`: `true` to turn irrigation ON, `false` to turn OFF

**Example**:
```typescript
const controller = new ManualIrrigationController();

// Turn irrigation on
controller.setIrrigation(true);

// Run simulation for 50 ticks
for (let i = 0; i < 50; i++) {
    simulation.step();
}

// Turn irrigation off
controller.setIrrigation(false);

// Run for 50 more ticks
for (let i = 0; i < 50; i++) {
    simulation.step();
}
```

---

#### `isIrrigationEnabled(): boolean`

**Purpose**: Query current irrigation state.

**Returns**: Current value of internal flag.

**Example**:
```typescript
if (!controller.isIrrigationEnabled() && metrics.avgMoisture < 0.3) {
    console.log("Warning: Irrigation is off and plants are dry!");
    controller.setIrrigation(true);
}
```

---

### Use Cases

#### 1. Interactive User Interfaces

Allow users to manually control irrigation via buttons/toggles:

```typescript
// React component example
function IrrigationControl({ controller, simulation }) {
    const [isOn, setIsOn] = useState(false);
    
    const toggleIrrigation = () => {
        const newState = !isOn;
        controller.setIrrigation(newState);
        setIsOn(newState);
    };
    
    return (
        <button onClick={toggleIrrigation}>
            {isOn ? "Turn Irrigation OFF" : "Turn Irrigation ON"}
        </button>
    );
}
```

---

#### 2. Scripted Test Scenarios

Create deterministic test patterns:

```typescript
// Test scenario: 2 days on, 1 day off
const controller = new ManualIrrigationController();

for (let day = 0; day < 10; day++) {
    const shouldIrrigate = (day % 3) !== 2; // On for days 0,1,3,4,6,7,9...
    controller.setIrrigation(shouldIrrigate);
    
    // Run one day
    for (let tick = 0; tick < TICKS_PER_DAY; tick++) {
        simulation.step();
    }
}
```

---

#### 3. External AI/Optimization Systems

Integrate with external decision systems:

```typescript
// External system makes decisions
const externalAI = {
    shouldIrrigate(metrics, weather) {
        // Complex external logic
        return someComplexCalculation(metrics, weather);
    }
};

// Each tick, update manual controller with external decision
function runTick() {
    const metrics = computeGardenMetrics(state, garden);
    const decision = externalAI.shouldIrrigate(metrics, state.weather);
    
    controller.setIrrigation(decision);
    simulation.step();
}
```

---

#### 4. Debugging and Analysis

Test specific moisture physics scenarios:

```typescript
// Test: What happens if we irrigate only at night?
const controller = new ManualIrrigationController();

for (let tick = 0; tick < 1000; tick++) {
    const timeOfDay = (tick % TICKS_PER_DAY) / TICKS_PER_DAY;
    const isNight = timeOfDay < 0.25 || timeOfDay > 0.75;
    
    controller.setIrrigation(isNight);
    simulation.step();
    
    if (tick % 100 === 0) {
        console.log(`Tick ${tick}, avgMoisture: ${metrics.avgMoisture}`);
    }
}
```

---

### Performance Profile

**Variable Performance**:
- Depends entirely on external control logic
- Can match any controller's performance if controlled correctly
- Can also perform arbitrarily poorly if controlled incorrectly

**Typical Use Pattern Results**:
- UI control: Highly variable (depends on user skill and attention)
- Scripted patterns: Predictable but often suboptimal
- External AI: Can match or exceed smart controllers

---

### Strengths and Limitations

**Strengths**:
- ✅ Maximum flexibility
- ✅ Easy integration with external systems
- ✅ Perfect for testing and debugging
- ✅ Allows human-in-the-loop control
- ✅ No hardcoded logic to maintain

**Limitations**:
- ❌ No autonomous behavior
- ❌ Requires external decision source
- ❌ No built-in intelligence or optimization
- ❌ Performance depends on quality of external control

---

## Controller Comparison

### Performance Comparison Table

Based on typical episode runs with default configuration:

| Controller | Score | Water Use | Dry Plants | Flooded Plants | Toggles | Complexity |
|------------|-------|-----------|------------|----------------|---------|------------|
| **Always On** | 30-50 | Very High | Very Low | Moderate-High | 0 | Trivial |
| **Always Off** | 20-40 | None | Very High | Low | 0 | Trivial |
| **Dumb** | 50-70 | Moderate | Moderate | Low-Moderate | High | Low |
| **Manual** | Variable | Variable | Variable | Variable | Variable | Low |
| **Smart** *(AI)* | 70-95 | Low-Moderate | Low | Low | Low-Moderate | High |

---

### Decision Strategy Comparison

```
Always On:  ━━━━━━━━━━━━━━━━━━━━━━  (always irrigating)

Always Off: ______________________ (never irrigating)

Dumb:       ━━━━____━━━━____━━━━__ (reactive oscillation)

Manual:     ━━__━━━━━____━━━______ (controlled by user/script)

Smart:      ━━____━━━━____━━━_____ (predictive optimization)
```

---

### When to Use Each Controller

**Always On**:
- Initial testing and verification
- Establishing performance baselines
- Abundant water scenarios
- Coverage testing

**Always Off**:
- Rain-only simulations
- Performance baseline (opposite extreme)
- Testing resilience to drought
- Water scarcity scenarios

**Dumb**:
- Simple automation needs
- Educational demonstrations
- Fallback/safe mode
- Baseline for AI comparison
- Low-cost systems

**Manual**:
- Interactive demonstrations
- User training
- Custom testing scenarios
- External AI integration
- Research experiments

**Smart (AI)**:
- Production optimization
- Water conservation goals
- Complex environments
- Learning and adaptation
- High-value applications

---

## Usage Examples

### Basic Setup

```typescript
import { GardenSimulation } from './lib/garden/GardenSimulation';
import { DumbIrrigationController } from './lib/garden/controllers';

// Create controller
const controller = new DumbIrrigationController(0.1, 1.0);

// Create simulation with controller
const simulation = new GardenSimulation({
    width: 30,
    height: 20,
    pillarDensity: 0.04,
    plantChanceNearPath: 0.25,
    seed: 42,
    coverageRadius: 1,
    controller: controller
});

// Run episode
simulation.state.isRunning = true;
while (simulation.state.tick < simulation.state.episodeLength) {
    simulation.step();
}

// Get results
const results = simulation.compileResults();
console.log(`Final Score: ${results.finalScore}`);
```

---

### Comparing Controllers

```typescript
// Run same garden with different controllers
const seed = 42;
const controllers = [
    { name: "Always On", controller: new AlwaysOnIrrigationController() },
    { name: "Always Off", controller: new AlwaysOffIrrigationController() },
    { name: "Dumb", controller: new DumbIrrigationController() },
];

const results = controllers.map(({ name, controller }) => {
    const sim = new GardenSimulation({
        width: 30,
        height: 20,
        seed: seed,
        controller: controller,
        // ... other params
    });
    
    // Run full episode
    while (sim.state.tick < sim.state.episodeLength) {
        sim.step();
    }
    
    return {
        name,
        score: sim.compileResults().finalScore,
        waterUsed: sim.state.cumulativeWaterUsed
    };
});

console.table(results);
```

---

### Manual Controller with Time-Based Strategy

```typescript
const controller = new ManualIrrigationController();
const simulation = new GardenSimulation({ 
    /* ... params ... */,
    controller 
});

// Irrigate only during dawn and dusk (avoid midday evaporation)
while (simulation.state.tick < simulation.state.episodeLength) {
    const timeOfDay = simulation.state.tick % TICKS_PER_DAY;
    
    // Irrigate during dawn (0-20) and dusk (80-100)
    const shouldIrrigate = timeOfDay < 20 || timeOfDay >= 80;
    controller.setIrrigation(shouldIrrigate);
    
    simulation.step();
}

const results = simulation.compileResults();
console.log(`Time-based irrigation score: ${results.finalScore}`);
```

---

## Summary

The controller system provides a flexible framework for irrigation decision-making:

### Key Takeaways

1. **Interface Simplicity**: Single `decide()` method enables easy implementation
2. **Strategy Diversity**: From trivial (always on/off) to sophisticated (AI)
3. **Modularity**: Controllers are independent and interchangeable
4. **Testability**: Easy to compare and benchmark different approaches
5. **Extensibility**: Simple to create custom controllers for specific needs

### Controller Selection Guide

**Choose based on your needs**:
- **Learning/Testing**: Use Manual or Dumb
- **Baseline Comparison**: Use Always On/Off
- **Simple Automation**: Use Dumb
- **Optimization**: Use Smart (AI)
- **Custom Logic**: Extend interface with custom implementation

All controllers share the same interface, making it easy to swap strategies and compare performance across different approaches.
