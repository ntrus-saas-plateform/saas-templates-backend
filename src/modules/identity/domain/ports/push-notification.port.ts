export type PushDeliveryTarget = {
  readonly deviceId: string;
  readonly pushToken: string;
  readonly pushPlatform: string;
};

export type PushDeliveryRequest = {
  readonly title: string;
  readonly body: string;
  readonly data?: Record<string, string>;
  readonly targets: readonly PushDeliveryTarget[];
};

export type PushDeliveryResult = {
  readonly sent: number;
  readonly failedDeviceIds: readonly string[];
};

export interface PushNotificationPort {
  isEnabled(): boolean;
  send(request: PushDeliveryRequest): Promise<PushDeliveryResult>;
}

export const PUSH_NOTIFICATION_PORT = Symbol('PUSH_NOTIFICATION_PORT');
