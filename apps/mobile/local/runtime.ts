import Constants from 'expo-constants';

/**
 * True when running inside the Expo Go client. `Constants.appOwnership` is deprecated and can
 * be null there, so the execution environment ('storeClient') is the reliable signal.
 */
export function isExpoGo(): boolean {
  return Constants.executionEnvironment === 'storeClient';
}
