/* global module */

let load;
({ ['require']: load = undefined } = module);
const { fold: execute } = load('@sunny-court/domain');

execute({ revision: 0 });
