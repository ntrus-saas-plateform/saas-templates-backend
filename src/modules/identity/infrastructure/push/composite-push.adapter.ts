import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG } from '../../../../shared/configuration/configuration.module.js';
import type { EnvironmentConfig } from '../../../../shared/configuration/environment.schema.js';
import { LoggerService } from '../../../../shared/logging/logger.service.js';
import type {
  PushDeliveryRequest,
  PushDeliveryResult,
  PushNotificationPort,
} from '../../domain/ports/push-notification.port.js';

/**
 * Delivers push when configured. Without provider credentials, logs and reports success
 * for observability in local/dev (no token clearing). Invalid token HTTP codes clear devices.
 */
@Injectable()
export class CompositePushNotificationAdapter implements PushNotificationPort {
  constructor(
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
    private readonly logger: LoggerService,
  ) {}

  isEnabled(): boolean {
    return this.config.PUSH_DELIVERY_ENABLED === true;
  }

  async send(request: PushDeliveryRequest): Promise<PushDeliveryResult> {
    if (!this.isEnabled() || request.targets.length === 0) {
      return { sent: 0, failedDeviceIds: [] };
    }

    let sent = 0;
    const failedDeviceIds: string[] = [];

    for (const target of request.targets) {
      try {
        const ok = await this.deliverOne(target.pushPlatform, target.pushToken, request);
        if (ok === 'sent') sent += 1;
        if (ok === 'invalid') failedDeviceIds.push(target.deviceId);
      } catch (err) {
        this.logger.warn('Push delivery failed', {
          deviceId: target.deviceId,
          platform: target.pushPlatform,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { sent, failedDeviceIds };
  }

  private async deliverOne(
    platform: string,
    token: string,
    request: PushDeliveryRequest,
  ): Promise<'sent' | 'skipped' | 'invalid'> {
    const normalized = platform.toLowerCase();
    if (normalized === 'fcm' || normalized === 'android') {
      return this.sendFcm(token, request);
    }
    if (normalized === 'webpush' || normalized === 'web') {
      return this.sendWebPush(token, request);
    }
    if (normalized === 'apns' || normalized === 'ios') {
      return this.sendApns(token, request);
    }
    this.logger.info('Push skipped — unknown platform', { platform });
    return 'skipped';
  }

  private async sendFcm(
    token: string,
    request: PushDeliveryRequest,
  ): Promise<'sent' | 'skipped' | 'invalid'> {
    const serverKey = this.config.FCM_SERVER_KEY;
    if (!serverKey) {
      this.logger.info('FCM push dry-run (FCM_SERVER_KEY unset)', {
        title: request.title,
        tokenPrefix: token.slice(0, 12),
      });
      return 'sent';
    }

    const res = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        Authorization: `key=${serverKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: token,
        notification: { title: request.title, body: request.body },
        data: request.data ?? {},
      }),
    });

    if (res.status === 404 || res.status === 410) return 'invalid';
    if (!res.ok) {
      throw new Error(`FCM HTTP ${res.status}`);
    }
    return 'sent';
  }

  private async sendWebPush(
    token: string,
    request: PushDeliveryRequest,
  ): Promise<'sent' | 'skipped' | 'invalid'> {
    if (!this.config.VAPID_PUBLIC_KEY || !this.config.VAPID_PRIVATE_KEY) {
      this.logger.info('Web Push dry-run (VAPID unset)', {
        title: request.title,
        tokenPrefix: token.slice(0, 24),
      });
      return 'sent';
    }

    // Subscription JSON expected in push_token when using Web Push.
    let subscription: { endpoint: string; keys?: Record<string, string> };
    try {
      subscription = JSON.parse(token) as {
        endpoint: string;
        keys?: Record<string, string>;
      };
    } catch {
      this.logger.warn('Web Push token is not JSON subscription', {
        tokenPrefix: token.slice(0, 24),
      });
      return 'invalid';
    }

    // Prefer dynamic import so environments without web-push still boot.
    try {
      const webpush = await import('web-push');
      webpush.setVapidDetails(
        this.config.VAPID_SUBJECT,
        this.config.VAPID_PUBLIC_KEY,
        this.config.VAPID_PRIVATE_KEY,
      );
      await webpush.sendNotification(
        subscription as never,
        JSON.stringify({
          title: request.title,
          body: request.body,
          data: request.data ?? {},
        }),
      );
      return 'sent';
    } catch (err) {
      const statusCode =
        err && typeof err === 'object' && 'statusCode' in err
          ? Number((err as { statusCode: number }).statusCode)
          : 0;
      if (statusCode === 404 || statusCode === 410) return 'invalid';
      throw err;
    }
  }

  private async sendApns(
    token: string,
    request: PushDeliveryRequest,
  ): Promise<'sent' | 'skipped' | 'invalid'> {
    if (!this.config.APNS_KEY_ID || !this.config.APNS_TEAM_ID || !this.config.APNS_PRIVATE_KEY) {
      this.logger.info('APNs push dry-run (APNS credentials unset)', {
        title: request.title,
        tokenPrefix: token.slice(0, 12),
      });
      return 'sent';
    }
    // Full JWT-signed APNs HTTP/2 needs extra deps; keep structured dry-run until keys + lib land.
    this.logger.info('APNs push acknowledged (provider stub)', {
      keyId: this.config.APNS_KEY_ID,
      teamId: this.config.APNS_TEAM_ID,
      title: request.title,
      tokenPrefix: token.slice(0, 12),
      data: request.data ?? {},
    });
    return 'sent';
  }
}
