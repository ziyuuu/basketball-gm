export function fold(state: { revision: number }) {
  state.revision += 1;
  return state;
}
