import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import nodemailer from 'nodemailer'

const app = express()
const port = Number(process.env.PORT || 3001)

// Behind a reverse proxy (nginx/Apache/Vercel), trust the first hop so req.ip is the real client IP.
app.set('trust proxy', 1)

app.use(cors())
app.use(express.json({ limit: '32kb' }))

/* ---------- Spam protection: IP rate limit + honeypot ---------- */
const RATE_WINDOW_MS = 10 * 60 * 1000 // 10 minutes
const RATE_MAX = 5 // messages per IP per window
const rateHits = new Map() // ip -> timestamps[]

function isRateLimited(ip) {
  const now = Date.now()
  const windowStart = now - RATE_WINDOW_MS
  const recent = (rateHits.get(ip) || []).filter((t) => t > windowStart)
  if (recent.length >= RATE_MAX) {
    rateHits.set(ip, recent)
    return true
  }
  recent.push(now)
  rateHits.set(ip, recent)
  // Opportunistic cleanup so the map doesn't grow forever
  if (rateHits.size > 1000) {
    for (const [key, stamps] of rateHits) {
      const fresh = stamps.filter((t) => t > windowStart)
      if (fresh.length) rateHits.set(key, fresh)
      else rateHits.delete(key)
    }
  }
  return false
}

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  return forwarded || req.ip || req.socket?.remoteAddress || 'unknown'
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

app.get('/api/contact', (_req, res) => {
  res
    .status(200)
    .type('html')
    .send(
      '<!doctype html><meta charset="utf-8"><title>Contact API</title>' +
        '<body style="font:14px system-ui;padding:24px;max-width:60ch">' +
        '<h2>Contact API is running</h2>' +
        '<p>This endpoint accepts <strong>POST</strong> requests from the portfolio contact form. ' +
        'Opening it in a browser uses GET, so it will not send an email.</p>' +
        '<p>Test by submitting the form on your site (e.g. <code>http://localhost:5173/#contact</code> with <code>npm run server</code> running).</p>' +
        '</body>'
    )
})

app.post('/api/contact', async (req, res) => {
  const name = String(req.body?.name || '').trim()
  const email = String(req.body?.email || '').trim()
  const message = String(req.body?.message || '').trim()
  // Honeypot: invisible to humans; bots fill it. Pretend success but send nothing.
  const company = String(req.body?.company || '').trim()
  if (company) {
    return res.json({ ok: true })
  }

  if (isRateLimited(clientIp(req))) {
    return res
      .status(429)
      .json({ ok: false, error: 'Too many messages from your address. Please wait a few minutes and try again.' })
  }

  if (!name || !email || !message) {
    return res.status(422).json({ ok: false, error: 'Please fill in all fields.' })
  }
  if (!isValidEmail(email)) {
    return res.status(422).json({ ok: false, error: 'Please enter a valid email address.' })
  }
  if (name.length > 120 || email.length > 200 || message.length > 5000) {
    return res.status(422).json({ ok: false, error: 'One or more fields are too long.' })
  }

  const to = process.env.MAIL_TO
  if (!to) {
    return res.status(500).json({
      ok: false,
      error: 'Mail is not configured. Set MAIL_TO and SMTP settings in your .env file.',
    })
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  })

  try {
    const safeName = name.replace(/[\r\n]+/g, ' ').trim()
    const safeEmail = email.replace(/[\r\n]+/g, '').trim()
    const submittedAt = new Date().toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'short',
    })

    const subject = `New Portfolio Inquiry from ${safeName}`
    const text = [
      'Hello,',
      '',
      'You have received a new message through your portfolio contact form.',
      'Please find the sender details below so you can reach out directly.',
      '',
      'Sender Details',
      '------------------------------',
      `Name: ${safeName}`,
      `Email: ${safeEmail}`,
      `Submitted: ${submittedAt}`,
      '',
      'Message',
      '------------------------------',
      message,
      '',
      '------------------------------',
      'You can reply directly to this email to respond to the sender.',
      '',
      'Best regards,',
      'Portfolio Contact Form',
    ].join('\n')

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#1f2937">
        <p>Hello,</p>
        <p>You have received a new message through your portfolio contact form. Please find the sender details below so you can reach out directly.</p>
        <h3 style="margin:16px 0 8px;font-size:16px">Sender Details</h3>
        <table style="border-collapse:collapse">
          <tr><td style="padding:2px 12px 2px 0;color:#6b7280"><strong>Name</strong></td><td>${safeName}</td></tr>
          <tr><td style="padding:2px 12px 2px 0;color:#6b7280"><strong>Email</strong></td><td><a href="mailto:${safeEmail}">${safeEmail}</a></td></tr>
          <tr><td style="padding:2px 12px 2px 0;color:#6b7280"><strong>Submitted</strong></td><td>${submittedAt}</td></tr>
        </table>
        <h3 style="margin:16px 0 8px;font-size:16px">Message</h3>
        <p style="white-space:pre-wrap;margin:0;padding:12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px">${message
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')}</p>
        <p style="margin-top:16px;color:#6b7280;font-size:13px">You can reply directly to this email to respond to the sender.</p>
      </div>`

    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER || to,
      to,
      replyTo: `${safeName} <${safeEmail}>`,
      subject,
      text,
      html,
    })
    return res.json({ ok: true })
  } catch (err) {
    console.error('Contact mail error:', err)
    const code = err && err.code ? String(err.code) : ''
    let hint = 'Check your SMTP settings in .env.'
    if (code === 'EAUTH') hint = 'SMTP login failed (EAUTH). Check SMTP_USER/SMTP_PASS; for Gmail use an App Password.'
    else if (code === 'ECONNECTION' || code === 'ESOCKET' || code === 'ETIMEDOUT')
      hint = `Could not reach the mail server (${code}). Check SMTP_HOST, SMTP_PORT, and SMTP_SECURE.`
    else if (code === 'EENVELOPE') hint = 'Invalid sender/recipient address (EENVELOPE). Check MAIL_TO and MAIL_FROM.'
    else if (code) hint = `Mail error (${code}). Check your SMTP settings in .env.`

    return res.status(500).json({
      ok: false,
      error: `Mail could not be sent. ${hint}`,
    })
  }
})

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.listen(port, () => {
  console.log(`Mail server listening on http://localhost:${port}`)
})
