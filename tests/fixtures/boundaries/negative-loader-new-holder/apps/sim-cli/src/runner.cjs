/* global module */

class Holder {
  constructor(value) {
    this.value = value;
  }
}

const load = new Holder(module.require.bind(module)).value;
const domain = load('../../../packages/domain/src/index.cjs');

domain.fold({ revision: 0 });
