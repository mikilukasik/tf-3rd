import { Worker } from 'worker_threads';

export const getDatasetFromPg = async ({ batchSize = 5000, pointers = {}, groups = { default: { take: 1 } } } = {}) => {
  const worker = new Worker('./src/utils/workers/workerExample.js', { workerData: { batchSize, pointers, groups } });

  const awaitingHandlers = {};

  const workerMessageHandler = async ({ cmd, data, id }) => {
    await new Promise((r) => setTimeout(r, 50));

    awaitingHandlers[id][cmd](data);
    delete awaitingHandlers[id];
  };

  worker.on('message', workerMessageHandler);
  worker.on('error', (e) => {
    console.error(new Error(`worker errored: ${e.message}`));
    throw e;
  });
  worker.on('exit', (code) => {
    if (code !== 0) throw new Error(`worker stopped with  ${code} exit code`);
  });

  const getNextBatch = (data) =>
    new Promise((resolve, reject) => {
      const id = Math.random();
      awaitingHandlers[id] = { resolve, reject };
      worker.postMessage({ cmd: 'getNextBatch', data, id });
    });

  return {
    getNextBatch,
  };
};

// getDatasetFromPg()
//   .then(({ getNextBatch }) => getNextBatch())
//   .then(console.log)
//   .catch(console.error);
