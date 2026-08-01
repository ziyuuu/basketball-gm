class Holder {
  method() {}
}

const Build = new Holder().method.constructor;
Build('return 1')();
