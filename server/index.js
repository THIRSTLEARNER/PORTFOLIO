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

const REQUIRED_ENV = ['MAIL_TO', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS']

// Mirrors api/contact.js so local dev and Vercel behave the same.
function readMailConfig() {
  const host = String(process.env.SMTP_HOST || '').trim()
  const port = Number(process.env.SMTP_PORT || 0)
  const secureFlag = String(process.env.SMTP_SECURE ?? '').trim().toLowerCase()
  const missing = REQUIRED_ENV.filter((key) => !String(process.env[key] || '').trim())

  return {
    to: String(process.env.MAIL_TO || '').trim(),
    from: String(process.env.MAIL_FROM || '').trim(),
    host,
    port: port || 587,
    secure: secureFlag ? secureFlag === 'true' : port === 465,
    user: String(process.env.SMTP_USER || '').trim(),
    pass: String(process.env.SMTP_PASS || ''),
    gmail: /(^|\.)gmail\.com$/i.test(host),
    missing,
    configured: missing.length === 0,
  }
}

function buildTransport(config) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure && config.port === 587,
    auth: config.user && config.pass ? { user: config.user, pass: config.pass } : undefined,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
    tls: { minVersion: 'TLSv1.2' },
  })
}

function mailErrorHint(err, config) {
  const code = err && err.code ? String(err.code) : ''
  if (code === 'EAUTH') {
    return config.gmail
      ? 'Gmail rejected the login. Use a 16-character App Password, not your normal password.'
      : 'SMTP login failed (EAUTH). Check SMTP_USER and SMTP_PASS.'
  }
  if (code === 'ENOTFOUND' || code === 'EDNS') {
    return `Could not find SMTP host "${config.host}". Check SMTP_HOST.`
  }
  if (['ECONNECTION', 'ESOCKET', 'ETIMEDOUT', 'ECONNREFUSED'].includes(code)) {
    return `Could not reach ${config.host}:${config.port} (${code}). For Gmail use SMTP_PORT=465 with SMTP_SECURE=true, or 587 with SMTP_SECURE=false.`
  }
  if (code === 'EENVELOPE') {
    return 'Invalid sender or recipient address (EENVELOPE). Check MAIL_TO and MAIL_FROM.'
  }
  return 'Check your SMTP settings in .env.'
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

  const config = readMailConfig()
  if (!config.configured) {
    return res.status(500).json({
      ok: false,
      error: `Mail is not configured. Missing: ${config.missing.join(', ')}. Set them in .env.`,
      missing: config.missing,
    })
  }

  const transporter = buildTransport(config)

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
      from: config.from || config.user || config.to,
      to: config.to,
      replyTo: `${safeName} <${safeEmail}>`,
      subject,
      text,
      html,
    })
    return res.json({ ok: true })
  } catch (err) {
    console.error('Contact mail error:', err)
    const code = err && err.code ? String(err.code) : ''
    return res.status(500).json({
      ok: false,
      code: code || undefined,
      error: `Mail could not be sent. ${mailErrorHint(err, config)}`,
    })
  }
})

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.listen(port, () => {
  console.log(`Mail server listening on http://localhost:${port}`)
})
