/* global exports, module */

const load = new Proxy(module.require.bind(null), {});
const { futureState } = load('../game/state-v2.cjs');

exports.invalid = futureState;
