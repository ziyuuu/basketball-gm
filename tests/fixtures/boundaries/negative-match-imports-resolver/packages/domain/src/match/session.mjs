import { fold as step } from '../state/fold.mjs';

export function run(snapshot) {
  return step(snapshot);
}
