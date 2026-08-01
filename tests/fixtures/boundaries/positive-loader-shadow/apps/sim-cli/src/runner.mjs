/* eslint-disable no-shadow-restricted-names */

function useInjected(require) {
  return require('@sunny-court/domain');
}

function useInjectedGlobal(globalThis) {
  return globalThis.require('@sunny-court/domain');
}

function useInjectedCodegen(eval, Function, Proxy) {
  eval('literal');
  const SafeValue = Function('literal');
  return new Proxy(SafeValue, {});
}

useInjected((specifier) => ({ specifier }));
useInjectedGlobal({ require: (specifier) => ({ specifier }) });
useInjectedCodegen(
  (value) => value,
  class SafeValue {},
  class SafeProxy {
    constructor(target) {
      return target;
    }
  },
);

class Box {}
const box = new Box();
export const constructorName = box.constructor.name;

class Child {}
const holder = { child: new Child() };
export const clonedChild = new holder.child.constructor();

class ValuedChild {
  constructor(value) {
    this.value = value;
  }
}
const valuedHolder = { child: new ValuedChild(1) };
export const replacedChild = new valuedHolder.child.constructor(2);

class FactoryChild {}
function makeChild() {
  return new FactoryChild();
}
export const recreatedChild = new (makeChild().constructor)();

function consume(callback) {
  void callback;
  return 42;
}
export const consumedNumber = consume(() => 1).constructor('42');

const mapped = [1, 2].map((value) => value);
export const clonedArray = new mapped.constructor();
