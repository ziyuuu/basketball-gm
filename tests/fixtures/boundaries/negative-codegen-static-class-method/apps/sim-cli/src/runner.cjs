class Holder {
  static method() {}
}

const Build = Holder.method.constructor;
Build('return 1')();
