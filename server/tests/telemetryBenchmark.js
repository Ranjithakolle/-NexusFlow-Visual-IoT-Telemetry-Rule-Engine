
import { performance } from "node:perf_hooks";

const API_URL = "http://127.0.0.1:4000/api/telemetry";

// Benchmark settings
const TOTAL_WRITES = 5000;
const CONCURRENCY = 100;

let successfulWrites = 0;
let failedWrites = 0;
const responseTimes = [];

async function sendTelemetry(index) {
  const start = performance.now();

  const payload = {
    deviceId: `BENCHMARK-${index % 100}`,
    machineName: "NexusFlow Benchmark Machine",
    temperature: 60 + Math.random() * 30,
    pressure: 30 + Math.random() * 20,
    humidity: 40 + Math.random() * 40,
    vibration: 5 + Math.random() * 15,
    flowRate: 80 + Math.random() * 50,
  };

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    await response.json();
    successfulWrites++;
  } catch (error) {
    failedWrites++;
    console.error(`Write ${index} failed: ${error.message}`);
  } finally {
    responseTimes.push(performance.now() - start);
  }
}

async function runBenchmark() {
  console.log("==================================");
  console.log(" NexusFlow Telemetry Benchmark");
  console.log("==================================");
  console.log(`Total writes: ${TOTAL_WRITES}`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log("Starting benchmark...\n");

  const benchmarkStart = performance.now();

  for (let i = 0; i < TOTAL_WRITES; i += CONCURRENCY) {
    const batch = [];

    for (
      let j = i;
      j < Math.min(i + CONCURRENCY, TOTAL_WRITES);
      j++
    ) {
      batch.push(sendTelemetry(j));
    }

    await Promise.all(batch);
  }

  const totalTime = (performance.now() - benchmarkStart) / 1000;
  const writesPerSecond = successfulWrites / totalTime;

  const averageResponseTime =
    responseTimes.reduce((sum, time) => sum + time, 0) /
    (responseTimes.length || 1);

  console.log("\n==================================");
  console.log(" Benchmark Results");
  console.log("==================================");
  console.log(`Successful writes: ${successfulWrites}`);
  console.log(`Failed writes: ${failedWrites}`);
  console.log(`Total time: ${totalTime.toFixed(2)} seconds`);
  console.log(`Throughput: ${writesPerSecond.toFixed(2)} writes/sec`);
  console.log(
    `Average response time: ${averageResponseTime.toFixed(2)} ms`
  );
  console.log("==================================");
}

runBenchmark();
