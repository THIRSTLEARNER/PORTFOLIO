// Vercel serverless handler for the portfolio contact form.
// Mirrors server/index.js (local dev) so both paths behave identically:
// same validation, honeypot, best-effort IP rate limit, same SMTP delivery.
// Configure these env vars in the Vercel dashboard (Project Settings → Environment Variables):
//   MAIL_TO, SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS (and optionally MAIL_FROM)
import nodemailer from 'nodemailer'

const RATE_WINDOW_MS = 10 * 60 * 1000 // 10 minutes
const RATE_MAX = 5 // messages per IP per window
const REQUIRED_ENV = ['MAIL_TO', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS']

// Best-effort: persists across warm invocations on the same instance only.
// For stricter limits across all instances, swap in a shared store (e.g. Upstash).
const globalStore = globalThis.__contactRateLimit || (globalThis.__contactRateLimit = new Map())

function isRateLimited(ip) {
  const now = Date.now()
  const windowStart = now - RATE_WINDOW_MS
  const recent = (globalStore.get(ip) || []).filter((t) => t > windowStart)
  if (recent.length >= RATE_MAX) {
    globalStore.set(ip, recent)
    return true
  }
  recent.push(now)
  globalStore.set(ip, recent)
  return false
}

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  return forwarded || req.socket?.remoteAddress || 'unknown'
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/**
 * Reads the mail settings once per request and reports exactly which keys the
 * deployment is missing. Vercel does not read .env from the repo, so a
 * "Mail is not configured" response almost always means the Production env
 * vars were never added — or were added without redeploying.
 */
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
    // Explicit SMTP_SECURE wins; otherwise infer from the port (465 = implicit TLS).
    secure: secureFlag ? secureFlag === 'true' : port === 465,
    user: String(process.env.SMTP_USER || '').trim(),
    pass: String(process.env.SMTP_PASS || ''),
    gmail: /(^|\.)gmail\.com$/i.test(host),
    missing,
    configured: missing.length === 0,
  }
}

function configError(config) {
  return {
    ok: false,
    error: `Mail is not configured. Missing: ${config.missing.join(', ')}. Add them in Vercel → Project Settings → Environment Variables (Production and Preview), then redeploy.`,
    missing: config.missing,
  }
}

function buildTransport(config) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    // STARTTLS upgrade for 587; implicit TLS is handled by `secure`.
    requireTLS: !config.secure && config.port === 587,
    auth: config.user && config.pass ? { user: config.user, pass: config.pass } : undefined,
    // Fail fast enough that Vercel returns a useful JSON error instead of a timeout page.
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
      ? 'Gmail rejected the login. Use a 16-character App Password (Google Account → Security → 2-Step Verification → App passwords), not your normal password.'
      : 'SMTP login failed (EAUTH). Check SMTP_USER and SMTP_PASS.'
  }
  if (code === 'ENOTFOUND' || code === 'EDNS') {
    return `Could not find SMTP host "${config.host}". Check SMTP_HOST (for Gmail: smtp.gmail.com).`
  }
  if (['ECONNECTION', 'ESOCKET', 'ETIMEDOUT', 'ECONNREFUSED'].includes(code)) {
    return `Could not reach ${config.host}:${config.port} (${code}). For Gmail use SMTP_PORT=465 with SMTP_SECURE=true, or 587 with SMTP_SECURE=false.`
  }
  if (code === 'EENVELOPE') {
    return 'Invalid sender or recipient address (EENVELOPE). Check MAIL_TO and MAIL_FROM.'
  }
  return 'Check your SMTP settings in the Vercel project environment variables.'
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const config = readMailConfig()
    return res.status(200).json({
      ok: true,
      service: 'contact-api',
      configured: config.configured,
      missing: config.missing,
      gmail: config.gmail,
      hint: config.configured
        ? 'POST JSON { name, email, message, company? } to this endpoint to send a message.'
        : 'Add the missing variables in Vercel → Project Settings → Environment Variables (Production and Preview), then redeploy. For Gmail use SMTP_HOST=smtp.gmail.com, SMTP_PORT=465, SMTP_SECURE=true and an App Password.',
    })
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed.' })
  }

  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      return res.status(400).json({ ok: false, error: 'Invalid JSON body.' })
    }
  }

  const name = String(body?.name || '').trim()
  const email = String(body?.email || '').trim()
  const message = String(body?.message || '').trim()
  // Honeypot: invisible to humans; bots fill it. Pretend success, send nothing.
  const company = String(body?.company || '').trim()
  if (company) {
    return res.status(200).json({ ok: true })
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
    return res.status(500).json(configError(config))
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
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Contact mail error:', err)
    const code = err && err.code ? String(err.code) : ''
    return res.status(500).json({
      ok: false,
      code: code || undefined,
      error: `Mail could not be sent. ${mailErrorHint(err, config)}`,
    })
  }
}
