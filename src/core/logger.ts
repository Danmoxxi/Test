/**
 * Structured logger with sanitisation.
 *
 * Rules:
 * - Never log credentials
 * - Never log rate data in production
 * - Never log property IDs with financial data on the same line
 */

import winston from 'winston'

const SENSITIVE_PATTERNS: RegExp[] = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // emails
  /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+/g,                  // JWTs
  /sk-[a-zA-Z0-9]{20,}/g,                                     // API keys
  /\bsb[a-z]_[A-Za-z0-9]{20,}/g,                              // Supabase keys
]

function sanitise(message: string): string {
  let sanitised = message
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitised = sanitised.replace(pattern, '[REDACTED]')
  }
  return sanitised
}

const sanitiseFormat = winston.format((info) => {
  if (typeof info['message'] === 'string') {
    info['message'] = sanitise(info['message'] as string)
  }
  return info
})

export function createLogger(agentId: string): winston.Logger {
  return winston.createLogger({
    level: process.env['LOG_LEVEL'] ?? 'info',
    defaultMeta: { agent: agentId, version: process.env['SIGNULOS_VERSION'] },
    format: winston.format.combine(
      sanitiseFormat(),
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      process.env['NODE_ENV'] === 'production'
        ? winston.format.json()
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
    ),
    transports: [
      new winston.transports.Console(),
    ],
  })
}
