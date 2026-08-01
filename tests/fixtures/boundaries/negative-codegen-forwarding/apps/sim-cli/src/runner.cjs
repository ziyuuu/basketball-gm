const run = eval.bind(null);
run('1 + 1');

Function.call(null, 'return 1')();
new (Function.bind(null, 'return 1'))();
