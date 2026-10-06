export const setStateFromLocalStorage = (key: string) => {
  if (typeof window === "undefined") {
    return null;
  }

  const state = localStorage.getItem(key);

  if (!state) {
    return null;
  }

  try {
    return JSON.parse(state);
  } catch {
    localStorage.removeItem(key);
    return null;
  }
};
