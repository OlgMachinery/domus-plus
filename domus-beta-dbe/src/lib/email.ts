/**
 * Stub para envío de correos. En producción conectar a Resend, SendGrid, SMTP, etc.
 */

export type SendEmailOptions = {
  to: string
  subject: string
  text: string
  html?: string
}

export async function sendEmail(options: SendEmailOptions): Promise<{ ok: boolean; error?: string }> {
  if (process.env.NODE_ENV === 'development') {
    console.log('[email stub]', options.to, options.subject, options.text.slice(0, 80) + '...')
  }
  // TODO: integrar con SMTP o servicio (Resend, SendGrid). Por ahora no se envía.
  return { ok: true }
}
