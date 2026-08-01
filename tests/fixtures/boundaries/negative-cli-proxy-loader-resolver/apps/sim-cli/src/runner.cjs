/* global module */

const load = new Proxy(module.require.bind(module), {});
const domain = load('@sunny-court/domain');

domain.fold({ revision: 0 });
