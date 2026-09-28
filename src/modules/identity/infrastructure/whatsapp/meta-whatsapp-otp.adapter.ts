import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG } from '../../../../shared/configuration/configuration.module.js';
import type { EnvironmentConfig } from '../../../../shared/configuration/environment.schema.js';
import { LoggerService } from '../../../../shared/logging/logger.service.js';
import type {
  WhatsAppOtpPort,
  WhatsAppOtpSendRequest,
  WhatsAppOtpSendResult,
} from '../../domain/ports/whatsapp-otp.port.js';

/**
 * Phone KYC OTP via Meta WhatsApp Cloud API (template message).
 * - WHATSAPP_OTP_ENABLED=false → dry-run (code logged for local/dev)
 * - Requires access token + phone-number-id + approved OTP template
 */
@Injectable()
export class MetaWhatsAppOtpAdapter implements WhatsAppOtpPort {
  constructor(
    @Inject(APP_CONFIG) private readonly config: EnvironmentConfig,
    private readonly logger: LoggerService,
  ) {}

  isEnabled(): boolean {
    return this.config.WHATSAPP_OTP_ENABLED === true;
  }

  async sendOtp(request: WhatsAppOtpSendRequest): Promise<WhatsAppOtpSendResult> {
    if (!this.isEnabled()) {
      this.logger.info('WhatsApp OTP dry-run (WHATSAPP_OTP_ENABLED=false)', {
        to: request.toE164,
        code: request.code,
        expiresInMinutes: request.expiresInMinutes,
      });
      return { sent: true, dryRun: true };
    }

    const token = this.config.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = this.config.WHATSAPP_PHONE_NUMBER_ID;
    const template = this.config.WHATSAPP_OTP_TEMPLATE_NAME;
    if (!token || !phoneNumberId || !template) {
      this.logger.info('WhatsApp OTP dry-run (credentials/template unset)', {
        to: request.toE164,
        code: request.code,
      });
      return { sent: true, dryRun: true };
    }

    const apiVersion = this.config.WHATSAPP_API_VERSION;
    const language = this.config.WHATSAPP_OTP_TEMPLATE_LANGUAGE;
    const buttonSubtype = this.config.WHATSAPP_OTP_BUTTON_SUBTYPE;
    const to = request.toE164.replace(/^\+/, '');

    const components: Array<Record<string, unknown>> = [
      {
        type: 'body',
        parameters: [{ type: 'text', text: request.code }],
      },
    ];
    if (buttonSubtype === 'url' || buttonSubtype === 'otp') {
      components.push({
        type: 'button',
        sub_type: buttonSubtype,
        index: '0',
        parameters: [{ type: 'text', text: request.code }],
      });
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: template,
        language: { code: language },
        components,
      },
    };

    const res = await fetch(
      `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(phoneNumberId)}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn('WhatsApp OTP send failed', {
        status: res.status,
        error: text.slice(0, 300),
      });
      throw new Error(`WhatsApp OTP failed: ${res.status}`);
    }

    const json = (await res.json()) as {
      messages?: Array<{ id?: string }>;
    };
    return {
      sent: true,
      providerMessageId: json.messages?.[0]?.id,
    };
  }
}
