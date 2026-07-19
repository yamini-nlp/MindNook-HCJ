if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis;
}

function createMemoryStorage() {
  let store = {};
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
    removeItem(key) {
      delete store[key];
    },
    clear() {
      store = {};
    },
  };
}

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = createMemoryStorage();
}
if (typeof globalThis.window.localStorage === 'undefined') {
  globalThis.window.localStorage = globalThis.localStorage;
}

beforeEach(() => {
  globalThis.localStorage.clear();
});