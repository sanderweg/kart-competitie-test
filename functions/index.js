const { onValueCreated, onValueUpdated } = require('firebase-functions/database');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { Resend } = require('resend');

admin.initializeApp();

const REGION = 'europe-west1';
const REGISTRATIONS_REF = '/kartCompetitie/inschrijvingen/{registrationId}';
const REGISTRATION_HISTORY_REF = '/kartCompetitie/inschrijvingenHistorie/{registrationId}';

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY ontbreekt. Voeg hem toe in functions/.env voordat je deployt.');
  }
  return new Resend(apiKey);
}

function getFromEmail() {
  return process.env.FROM_EMAIL || process.env.RESEND_FROM_EMAIL || 'Zware Jongens <info@zwarejongens-race.nl>';
}

function getAdminEmail() {
  return process.env.ADMIN_EMAIL || process.env.ADMIN_NOTIFICATION_EMAIL || 'info@zwarejongens-race.nl';
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function safeText(value) {
  return String(value || '').trim();
}

async function sendEmail({ to, subject, html, text }) {
  const resend = getResendClient();
  const response = await resend.emails.send({
    from: getFromEmail(),
    to,
    subject,
    html,
    text,
    reply_to: getAdminEmail(),
  });

  if (response.error) {
    throw new Error(response.error.message || 'Resend fout tijdens verzenden.');
  }

  return response.data;
}

function baseEmailLayout({ title, preheader = '', bodyHtml }) {
  return `
  <!doctype html>
  <html lang="nl">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>${title}</title>
    </head>
    <body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
        ${preheader}
      </div>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f4f7fb;padding:24px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
              <tr>
                <td style="background:#111827;padding:20px 24px;">
                  <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#34d399;font-weight:bold;">
                    Zware Jongens Competitie
                  </div>
                  <div style="font-size:24px;line-height:1.3;font-weight:bold;color:#ffffff;margin-top:8px;">
                    ${title}
                  </div>
                </td>
              </tr>

              <tr>
                <td style="padding:24px;">
                  ${bodyHtml}
                </td>
              </tr>

              <tr>
                <td style="padding:0 24px 24px 24px;">
                  <div style="font-size:13px;line-height:1.6;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:16px;">
                    Deze e-mail is automatisch verzonden door de Zware Jongens Competitie.<br />
                    Vragen? Reageer gerust op deze mail of neem contact op via ${getAdminEmail()}.
                  </div>
                </td>
              </tr>
            </table>

            <div style="font-size:12px;color:#9ca3af;margin-top:12px;">
              Zware Jongens Competitie · zwarejongens-race.nl
            </div>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
}

function raceInfoBlock({ raceName, naam, email, telefoon }) {
  return `
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:16px 0;">
      <div style="font-size:14px;color:#6b7280;margin-bottom:6px;">Deelnemer</div>
      <div style="font-size:16px;font-weight:bold;color:#111827;">${naam || '-'}</div>

      <div style="font-size:14px;color:#6b7280;margin:14px 0 6px;">Race</div>
      <div style="font-size:16px;font-weight:bold;color:#111827;">${raceName || '-'}</div>

      ${email ? `<div style="font-size:14px;color:#6b7280;margin:14px 0 6px;">E-mailadres</div><div style="font-size:16px;color:#111827;">${email}</div>` : ''}
      ${telefoon ? `<div style="font-size:14px;color:#6b7280;margin:14px 0 6px;">Telefoon</div><div style="font-size:16px;color:#111827;">${telefoon}</div>` : ''}
    </div>
  `;
}

function registrationReceivedTemplate({ naam, raceName }) {
  const html = `
    <p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;">Hallo ${naam},</p>

    <p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;">
      Je inschrijving is goed ontvangen en staat nu in behandeling.
    </p>

    ${raceInfoBlock({ naam, raceName })}

    <p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;">
      Zodra je inschrijving is beoordeeld, ontvang je automatisch een nieuwe bevestiging per e-mail.
    </p>

    <p style="margin:0;font-size:16px;line-height:1.7;">
      Met sportieve groet,<br />
      <strong>Zware Jongens Competitie</strong>
    </p>
  `;

  const text = `Hallo ${naam},

Je inschrijving is goed ontvangen en staat nu in behandeling.

Race: ${raceName}

Zodra je inschrijving is beoordeeld, ontvang je automatisch een nieuwe bevestiging per e-mail.

Met sportieve groet,
Zware Jongens Competitie`;

  return {
    subject: `Inschrijving ontvangen - ${raceName}`,
    html: baseEmailLayout({
      title: 'Inschrijving ontvangen',
      preheader: `Je inschrijving voor ${raceName} is ontvangen.`,
      bodyHtml: html,
    }),
    text,
  };
}

function registrationApprovedTemplate({ naam, raceName }) {
  const html = `
    <p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;">Hallo ${naam},</p>

    <p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;">
      Goed nieuws: je inschrijving is bevestigd.
    </p>

    ${raceInfoBlock({ naam, raceName })}

    <p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;">
      Je bent toegevoegd aan de deelnemerslijst. Bewaar deze e-mail goed; verdere informatie volgt via de organisatie.
    </p>

    <p style="margin:0;font-size:16px;line-height:1.7;">
      Met sportieve groet,<br />
      <strong>Zware Jongens Competitie</strong>
    </p>
  `;

  const text = `Hallo ${naam},

Goed nieuws: je inschrijving is bevestigd.

Race: ${raceName}

Je bent toegevoegd aan de deelnemerslijst. Verdere informatie volgt via de organisatie.

Met sportieve groet,
Zware Jongens Competitie`;

  return {
    subject: `Inschrijving bevestigd - ${raceName}`,
    html: baseEmailLayout({
      title: 'Inschrijving bevestigd',
      preheader: `Je inschrijving voor ${raceName} is bevestigd.`,
      bodyHtml: html,
    }),
    text,
  };
}

function registrationReserveTemplate({ naam, raceName }) {
  const html = `
    <p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;">Hallo ${naam},</p>

    <p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;">
      Op dit moment is de race vol. Daarom sta je voorlopig op de reservelijst.
    </p>

    ${raceInfoBlock({ naam, raceName })}

    <p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;">
      Zodra er een plek vrijkomt, nemen we opnieuw contact met je op.
    </p>

    <p style="margin:0;font-size:16px;line-height:1.7;">
      Met sportieve groet,<br />
      <strong>Zware Jongens Competitie</strong>
    </p>
  `;

  const text = `Hallo ${naam},

Op dit moment is de race vol. Daarom sta je voorlopig op de reservelijst.

Race: ${raceName}

Zodra er een plek vrijkomt, nemen we opnieuw contact met je op.

Met sportieve groet,
Zware Jongens Competitie`;

  return {
    subject: `Reservelijst - ${raceName}`,
    html: baseEmailLayout({
      title: 'Je staat op de reservelijst',
      preheader: `Voor ${raceName} sta je momenteel op de reservelijst.`,
      bodyHtml: html,
    }),
    text,
  };
}

function registrationRejectedTemplate({ naam, raceName }) {
  const html = `
    <p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;">Hallo ${naam},</p>

    <p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;">
      Je inschrijving is op dit moment niet geaccepteerd.
    </p>

    ${raceInfoBlock({ naam, raceName })}

    <p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;">
      Heb je hier vragen over, reageer dan gerust op deze e-mail.
    </p>

    <p style="margin:0;font-size:16px;line-height:1.7;">
      Met sportieve groet,<br />
      <strong>Zware Jongens Competitie</strong>
    </p>
  `;

  const text = `Hallo ${naam},

Je inschrijving is op dit moment niet geaccepteerd.

Race: ${raceName}

Heb je hier vragen over, reageer dan gerust op deze e-mail.

Met sportieve groet,
Zware Jongens Competitie`;

  return {
    subject: `Update over je inschrijving - ${raceName}`,
    html: baseEmailLayout({
      title: 'Update over je inschrijving',
      preheader: `Er is een update over je inschrijving voor ${raceName}.`,
      bodyHtml: html,
    }),
    text,
  };
}

function adminNotificationTemplate({ naam, email, telefoon, raceName }) {
  const html = `
    <p style="margin:0 0 16px 0;font-size:16px;line-height:1.7;">
      Er is een nieuwe inschrijving binnengekomen.
    </p>

    ${raceInfoBlock({ naam, raceName, email, telefoon })}
  `;

  const text = `Er is een nieuwe inschrijving binnengekomen.

Naam: ${naam}
E-mailadres: ${email}
Telefoon: ${telefoon || '-'}
Race: ${raceName}`;

  return {
    subject: `Nieuwe inschrijving - ${raceName}`,
    html: baseEmailLayout({
      title: 'Nieuwe inschrijving',
      preheader: `Nieuwe inschrijving van ${naam} voor ${raceName}.`,
      bodyHtml: html,
    }),
    text,
  };
}

async function sendParticipantEmail(registration, type) {
  const to = safeText(registration.email);
  if (!to) {
    logger.warn('Geen deelnemer e-mail gevonden, mail overgeslagen.', registration);
    return;
  }

  const payload = {
    naam: safeText(registration.naam) || 'deelnemer',
    raceName: safeText(registration.raceName) || 'Race',
  };

  if (type === 'received') {
    const mail = registrationReceivedTemplate(payload);
    await sendEmail({ to, subject: mail.subject, html: mail.html, text: mail.text });
    return;
  }

  if (type === 'approved') {
    const mail = registrationApprovedTemplate(payload);
    await sendEmail({ to, subject: mail.subject, html: mail.html, text: mail.text });
    return;
  }

  if (type === 'reserve') {
    const mail = registrationReserveTemplate(payload);
    await sendEmail({ to, subject: mail.subject, html: mail.html, text: mail.text });
    return;
  }

  if (type === 'rejected') {
    const mail = registrationRejectedTemplate(payload);
    await sendEmail({ to, subject: mail.subject, html: mail.html, text: mail.text });
  }
}

async function sendAdminNotification(registration) {
  const mail = adminNotificationTemplate({
    naam: safeText(registration.naam) || 'Onbekend',
    email: safeText(registration.email) || '-',
    telefoon: safeText(registration.telefoon) || '-',
    raceName: safeText(registration.raceName) || 'Race',
  });

  await sendEmail({
    to: getAdminEmail(),
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });
}

exports.onRegistrationCreated = onValueCreated(
  { ref: REGISTRATIONS_REF, region: REGION },
  async (event) => {
    const registration = event.data.val();
    if (!registration) return;

    const status = normalizeStatus(registration.status);
    logger.info('Nieuwe inschrijving ontvangen', { registrationId: event.params.registrationId, status });

    try {
      if (status === 'reserve') {
        await sendParticipantEmail(registration, 'reserve');
      } else {
        await sendParticipantEmail(registration, 'received');
      }
      await sendAdminNotification(registration);
    } catch (error) {
      logger.error('Versturen van ontvangstmail mislukt.', error);
      throw error;
    }
  }
);

exports.onRegistrationUpdated = onValueUpdated(
  { ref: REGISTRATIONS_REF, region: REGION },
  async (event) => {
    const before = event.data.before.val();
    const after = event.data.after.val();
    if (!after) return;

    const previousStatus = normalizeStatus(before?.status);
    const nextStatus = normalizeStatus(after.status);

    if (previousStatus === nextStatus) return;
    if (nextStatus !== 'reserve') return;

    logger.info('Inschrijving naar reservelijst verplaatst', { registrationId: event.params.registrationId });

    try {
      await sendParticipantEmail(after, 'reserve');
    } catch (error) {
      logger.error('Versturen van reservelijstmail mislukt.', error);
      throw error;
    }
  }
);

exports.onRegistrationArchived = onValueCreated(
  { ref: REGISTRATION_HISTORY_REF, region: REGION },
  async (event) => {
    const registration = event.data.val();
    if (!registration) return;

    const status = normalizeStatus(registration.status);
    logger.info('Verwerkte inschrijving gearchiveerd', { registrationId: event.params.registrationId, status });

    try {
      if (status === 'goedgekeurd') {
        await sendParticipantEmail(registration, 'approved');
      } else if (status === 'afgewezen') {
        await sendParticipantEmail(registration, 'rejected');
      }
    } catch (error) {
      logger.error('Versturen van statusmail mislukt.', error);
      throw error;
    }
  }
);
