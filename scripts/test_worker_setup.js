const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');

console.log('Available CPU cores:', os.cpus().length);
