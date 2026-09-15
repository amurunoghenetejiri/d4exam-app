declare module "@capgo/capacitor-native-biometric" {
  export interface AvailableResult {
    isAvailable: boolean;
    biometryType: number;
    errorCode?: number;
  }
  export interface NativeBiometricPlugin {
    isAvailable(): Promise<AvailableResult>;
    verifyIdentity(options: {
      reason?: string;
      title?: string;
      subtitle?: string;
      description?: string;
      negativeButtonText?: string;
      maxAttempts?: number;
      useFallback?: boolean;
    }): Promise<void>;
  }
  export const NativeBiometric: NativeBiometricPlugin;
}
