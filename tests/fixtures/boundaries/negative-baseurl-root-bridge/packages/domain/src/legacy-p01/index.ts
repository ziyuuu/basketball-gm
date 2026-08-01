export function fold(state: { revision: number }): { revision: number } {
  state.revision += 1;
  return state;
}
