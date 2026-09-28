export type WhatsAppOtpSendRequest = {
  readonly toE164: string;
  readonly code: string;
  readonly expiresInMinutes: number;
};

export type WhatsAppOtpSendResult = {
  readonly sent: boolean;
  readonly dryRun?: boolean;
  readonly providerMessageId?: string;
};

export interface WhatsAppOtpPort {
  isEnabled(): boolean;
  sendOtp(request: WhatsAppOtpSendRequest): Promise<WhatsAppOtpSendResult>;
}

export const WHATSAPP_OTP_PORT = Symbol('WHATSAPP_OTP_PORT');
