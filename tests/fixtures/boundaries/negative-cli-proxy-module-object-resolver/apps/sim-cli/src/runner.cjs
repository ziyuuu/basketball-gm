/* global module */

const moduleProxy = new Proxy(module, {});
const domain = moduleProxy.require('@sunny-court/domain');

domain.fold({ revision: 0 });
