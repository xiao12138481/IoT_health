import { DEFAULT_SIMULATOR_CONFIG, runSimulationCycles } from '../src/lib/health-simulator.js';

type Scenario = 'normal' | 'exercise' | 'stress' | 'night' | 'critical' | 'mixed';
type AnomalyType = 'none' | 'tachycardia' | 'bradycardia' | 'hypoxia' | 'fever' | 'hypertension' | 'hypotension' | 'combined';
type AnomalySeverity = 'mild' | 'moderate' | 'severe';
type SportType = 'auto' | 'running' | 'swimming' | 'cycling' | 'other';

interface SimulatorOptions {
  personIds: number[] | 'all';
  cycles: number;
  intervalMs: number;
  stepMinutes: number;
  scenario: Scenario;
  sportPriorityMode: boolean;
  selectedSportType: SportType;
  anomalyMode: boolean;
  anomalyType: AnomalyType;
  anomalySeverity: AnomalySeverity;
}

const DEFAULT_OPTIONS: SimulatorOptions = {
  personIds: DEFAULT_SIMULATOR_CONFIG.personIds as 'all',
  cycles: 12,
  intervalMs: 1000,
  stepMinutes: 30,
  scenario: 'mixed',
  sportPriorityMode: false,
  selectedSportType: 'auto',
  anomalyMode: false,
  anomalyType: 'none',
  anomalySeverity: 'moderate',
};

function parseArgs(argv: string[]): SimulatorOptions {
  const options = { ...DEFAULT_OPTIONS };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === '--person' && next) {
      options.personIds = next === 'all'
        ? 'all'
        : next.split(',').map((value) => parseInt(value.trim(), 10)).filter((value) => !Number.isNaN(value));
      i += 1;
    } else if (arg === '--cycles' && next) {
      options.cycles = Math.max(1, parseInt(next, 10) || DEFAULT_OPTIONS.cycles);
      i += 1;
    } else if (arg === '--interval' && next) {
      options.intervalMs = Math.max(0, parseInt(next, 10) || DEFAULT_OPTIONS.intervalMs);
      i += 1;
    } else if (arg === '--step-minutes' && next) {
      options.stepMinutes = Math.max(1, parseInt(next, 10) || DEFAULT_OPTIONS.stepMinutes);
      i += 1;
    } else if (arg === '--scenario' && next) {
      const scenario = next as Scenario;
      if (['normal', 'exercise', 'stress', 'night', 'critical', 'mixed'].includes(scenario)) {
        options.scenario = scenario;
      }
      i += 1;
    } else if (arg === '--sport-priority-mode' && next) {
      options.sportPriorityMode = next === 'true';
      i += 1;
    } else if (arg === '--sport-type' && next) {
      const sportType = next as SportType;
      if (['auto', 'running', 'swimming', 'cycling', 'other'].includes(sportType)) {
        options.selectedSportType = sportType;
      }
      i += 1;
    } else if (arg === '--anomaly-mode' && next) {
      options.anomalyMode = next === 'true';
      i += 1;
    } else if (arg === '--anomaly-type' && next) {
      const anomalyType = next as AnomalyType;
      if (['none', 'tachycardia', 'bradycardia', 'hypoxia', 'fever', 'hypertension', 'hypotension', 'combined'].includes(anomalyType)) {
        options.anomalyType = anomalyType;
      }
      i += 1;
    } else if (arg === '--anomaly-severity' && next) {
      const anomalySeverity = next as AnomalySeverity;
      if (['mild', 'moderate', 'severe'].includes(anomalySeverity)) {
        options.anomalySeverity = anomalySeverity;
      }
      i += 1;
    } else if (arg === '--help') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
Health Simulator

Usage:
  pnpm simulate:health -- --person all --cycles 12 --interval 1000 --step-minutes 30 --scenario mixed

Options:
  --person         all or comma-separated person ids, e.g. 1,2
  --cycles         number of simulation cycles
  --interval       wait time between cycles in ms
  --step-minutes   simulated time advanced per cycle
  --scenario       normal | exercise | stress | night | critical | mixed
  --sport-priority-mode true | false
  --sport-type     auto | running | swimming | cycling | other
  --anomaly-mode   true | false
  --anomaly-type   none | tachycardia | bradycardia | hypoxia | fever | hypertension | hypotension | combined
  --anomaly-severity mild | moderate | severe
  --help           show this help message
`);
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const results = await runSimulationCycles(options);
  console.log(JSON.stringify(results, null, 2));
}

run().catch((error) => {
  console.error('Simulator failed:', error);
  process.exit(1);
});
