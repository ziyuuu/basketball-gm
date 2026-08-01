/* global exports */

exports.fold = function fold(state) {
  state.revision += 1;
  return state;
};
