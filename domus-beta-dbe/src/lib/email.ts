/**
 * Envío de correos. Con SENDGRID_API_KEY usa SendGrid; si no, stub (solo log en dev).
 */

export type SendEmailOptions = {
  to: string
  subject: string
  text: string
  html?: string
}

export async function sendEmail(options: SendEmailOptions): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.SENDGRID_API_KEY
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@domus-fam.com'
  const fromName = process.env.SENDGRID_FROM_NAME || 'Domus'

  if (!apiKey || !apiKey.trim()) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[email stub]', options.to, options.subject, options.text.slice(0, 80) + '...')
    }
    return { ok: true }
  }

  try {
    const body = {
      personalizations: [{ to: [{ email: options.to }] }],
      from: { email: fromEmail, name: fromName },
      subject: options.subject,
      content: [
        { type: 'text/plain', value: options.text },
        ...(options.html ? [{ type: 'text/html', value: options.html }] : []),
      ],
    }
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const errText = await res.text()
      console.error('[email] SendGrid error', res.status, errText)
      return { ok: false, error: `SendGrid ${res.status}: ${errText.slice(0, 200)}` }
    }
    return { ok: true }
  } catch (e: unknown) {
    const err = e instanceof Error ? e.message : String(e)
    console.error('[email] SendGrid exception', err)
    return { ok: false, error: err }
  }
}
