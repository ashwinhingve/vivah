export interface PushPayload {
  token:    string;
  title:    string;
  body:     string;
  data?:    Record<string, string>;
}

export interface EmailPayload {
  to:       string;
  subject:  string;
  html:     string;
  text:     string;
  from?:    string;
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
}

export interface SmsPayload {
  phone:    string;
  message:  string;
  template?: string;
}

export interface DeliveryResult {
  ok:       boolean;
  provider: string;
  id?:      string;
  error?:   string;
}
