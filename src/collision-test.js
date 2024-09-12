const { describe } = require("riteway");
const { Worker } = require("worker_threads");
const os = require("os");

const { info } = require("./test-utils.js");

// This is the code that will be run in each worker thread.
// It creates an id pool and returns it.
const workerCode = `
  const { parentPort } = require('node:worker_threads');
  const { createIdPool } = require('./src/test-utils.js');
  const { max } = JSON.parse(process.argv[2]);
  createIdPool({ max }).then((idPool) => parentPort.postMessage(idPool));
`;

// This function creates a worker thread and returns a promise that resolves
// with the id pool returned by the worker.
async function createIdPoolInWorker(max) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerCode, {
      eval: true,
      argv: [JSON.stringify({ max })],
    });
    worker.on("message", resolve);
    worker.on("error", reject);
  });
}

// This function creates an array of promises, each of which creates an id pool
// in a worker thread.
const createIdPoolsInWorkers = (numWorkers, max) => {
  const workerPromises = [];
  let remainingIds = max;

  for (let i = 0; i < numWorkers; i++) {
    const workerMax =
      i === numWorkers - 1 ? remainingIds : Math.floor(max / numWorkers);
    remainingIds -= workerMax;
    workerPromises.push(createIdPoolInWorker(workerMax));

    if (remainingIds <= 0) break;
  }

  return Promise.all(workerPromises);
};

describe("Collision Test", async (assert) => {
  {
    const n = 7 ** 8 * 2;
    info(`Testing ${n} unique IDs...`);
    const numPools = os.cpus().length; // Use all available CPU cores
    info(`Using ${numPools} worker threads`);
    const pools = await createIdPoolsInWorkers(numPools, n);
    const ids = [].concat(...pools.map((x) => x.ids));
    const sampleIds = ids.slice(0, 10);
    const set = new Set(ids);
    const histogram = pools[0].histogram;
    info(`sample ids: ${sampleIds}`);
    info(`histogram: ${histogram}`);
    const expectedBinSize = Math.ceil(n / numPools / histogram.length);
    const tolerance = 0.05;
    const minBinSize = Math.round(expectedBinSize * (1 - tolerance));
    const maxBinSize = Math.round(expectedBinSize * (1 + tolerance));
    info(`expectedBinSize: ${expectedBinSize}`);
    info(`minBinSize: ${minBinSize}`);
    info(`maxBinSize: ${maxBinSize}`);

    const detectSet = new Set();
    const collisions = [];
    const uniqueIds = new Set();

    for (const id of ids) {
      if (detectSet.has(id)) {
        collisions.push(id);
      } else {
        detectSet.add(id);
      }
      uniqueIds.add(id);
    }

    info(`Total IDs generated: ${ids.length}`);
    info(`Unique IDs (Set): ${set.size}`);
    info(`Unique IDs (detectSet): ${detectSet.size}`);
    info(`Unique IDs (uniqueIds): ${uniqueIds.size}`);
    info(`Collided IDs: ${collisions.join(", ")}`);
    info(`Number of collisions: ${collisions.length}`);
    info(`Difference (n - set.size): ${n - set.size}`);

    // Log all IDs for manual inspection
    // info(`All IDs: ${ids.join(", ")}`);

    assert({
      given: "lots of ids generated",
      should: "generate no collissions",
      actual: set.size,
      expected: n,
    });

    // Additional assertions to check for consistency
    assert({
      given: "multiple ways of counting unique IDs",
      should: "all yield the same result",
      actual: set.size === detectSet.size && set.size === uniqueIds.size,
      expected: true,
    });

    assert({
      given: "total IDs generated",
      should: "match the requested number",
      actual: ids.length,
      expected: n,
    });

    assert({
      given: "lots of ids generated",
      should: "produce a histogram within distribution tolerance",
      actual: histogram.every((x) => x > minBinSize && x < maxBinSize),
      expected: true,
    });

    assert({
      given: "lots of ids generated",
      should: "contain only valid characters",
      actual: ids.every((id) => /^[a-z0-9]+$/.test(id)),
      expected: true,
    });
  }
});
