/**
 * Expo modules import `react-native`. Turbopack cannot use the real RN entry (Flow);
 * delegate to `react-native-web` and stub native-only APIs.
 */
const RNW = require("react-native-web");

class NativeEventEmitter {
  addListener() {
    return { remove: () => {} };
  }
  removeAllListeners() {}
}

module.exports = {
  ...RNW,
  NativeEventEmitter,
  TurboModuleRegistry: { get: () => null },
};
