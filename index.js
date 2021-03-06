'use strict';

const path = require('path');
const caller = require('caller');

const Worker = require('./lib/worker.js');
const Profiler = require('./lib/profiler.js');

/**
 * Measures the impact of running a certain script on your system.
 * Monitors the cpu and memory usage of the whole tree of processes generated by
 * the script provided.
 * @public
 * @param  {string} code The source code to test.
 * @param  {Object} [options] Optional configurations.
 * @param  {number} [options.interval=125] Sampling interval in milliseconds.
 * @param  {string} [options.cwd=caller] CWD for the script.
 * @return {Promise.<Object>} An object containing the results.
 */
async function sympact(code, options) {
  if (typeof code !== 'string') {
    throw new TypeError("The 'code' paramater must a string'");
  }
  if (typeof options === 'undefined') {
    options = {};
  }
  if (typeof options !== 'object') {
    throw new TypeError("The 'options' paramater must an object'");
  }
  const interval = options.interval || 125;
  const cwd = options.cwd || path.dirname(caller());

  if (interval < 1) {
    throw new TypeError("The 'interval' paramater must be greater than 0'");
  }

  return new Promise((resolve, reject) => {
    const slave = new Worker(code, cwd);
    const probe = new Profiler(slave.pid(), interval);

    slave.on('ready', async () => {
      await probe.watch();
      slave.run();
    });

    slave.on('after', async (start, end) => {
      await probe.unwatch();
      slave.kill();

      resolve(probe.report(start, end));
    });

    slave.on('error', async err => {
      await probe.unwatch();
      slave.kill();

      reject(err);
    });
  });
}

module.exports = sympact;
