const sgMail = require('@sendgrid/mail');
const { env } = require('../config/env');
const { badRequest } = require('../utils/apiError');
const { parseEmailList } = require('../utils/validators');

let apiKeyConfigured = false;

function ensureConfigured() {
  if (apiKeyConfigured) {
    return;
  }

  if (!env.sendgridApiKey) {
    throw badRequest('Email delivery is not configured (missing SENDGRID_API_KEY).');
  }

  if (!env.mailFrom) {
    throw badRequest('Email delivery is not configured (missing MAIL_FROM).');
  }

  sgMail.setApiKey(env.sendgridApiKey);
  apiKeyConfigured = true;
}

async function sendGeneratedFileEmail({ to, subject, text, filename, mimeType, buffer }) {
  ensureConfigured();
  const recipients = parseEmailList(to);

  if (!recipients.length) {
    throw badRequest('A valid recipient email address is required.');
  }

  const msg = {
    to: recipients,
    from: {
      email: env.mailFrom,
      name: 'ClaspSCxSeamless',
    },
    subject,
    text,
    attachments: [
      {
        content: buffer.toString('base64'),
        filename,
        type: mimeType || 'application/octet-stream',
        disposition: 'attachment',
      },
    ],
  };

  await sgMail.send(msg);
}

module.exports = { sendGeneratedFileEmail };
