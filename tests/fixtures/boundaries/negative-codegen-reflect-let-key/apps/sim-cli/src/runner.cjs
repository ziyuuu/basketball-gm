let key = 'constructor';
const Build = Reflect.get(() => {}, key);

Build('return 1')();
