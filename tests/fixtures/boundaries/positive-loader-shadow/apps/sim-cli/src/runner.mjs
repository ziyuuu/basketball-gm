/* eslint-disable no-shadow-restricted-names */

function useInjected(require) {
  return require('@sunny-court/domain');
}

function useInjectedGlobal(globalThis) {
  return globalThis.require('@sunny-court/domain');
}

useInjected((specifier) => ({ specifier }));
useInjectedGlobal({ require: (specifier) => ({ specifier }) });
