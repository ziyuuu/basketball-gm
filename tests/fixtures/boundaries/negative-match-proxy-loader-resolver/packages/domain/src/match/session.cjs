/* global exports, module */

const load = new Proxy(module.require.bind(null), {});
const { fold: step } = load('../state/fold.cjs');

exports.run = step;
