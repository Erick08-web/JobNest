import { Vibration } from 'react-native';

export function notifySuccess() {
  Vibration.vibrate(18);
}

export function notifyWarning() {
  Vibration.vibrate([0, 24, 45, 24]);
}

export function notifySelection() {
  Vibration.vibrate(10);
}
