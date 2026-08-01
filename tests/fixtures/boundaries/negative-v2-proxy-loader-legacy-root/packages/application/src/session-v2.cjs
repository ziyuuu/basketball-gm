/* global exports, module */

const load = new Proxy(module.require.bind(null), {});
const { legacyMarker } = load('@sunny-court/domain');

exports.invalid = legacyMarker;
