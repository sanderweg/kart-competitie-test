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
  return process.env.RESEND_FROM_EMAIL || 'Zware Jongens <info@zwarejongens-race.nl>';
}

function getAdminEmail() {
  return process.env.ADMIN_NOTIFICATION_EMAIL || 'info@zwarejongens-race.nl';
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function safeText(value) {
  return String(value || '').trim();
}

async function sendEmail({ to, subject, html }) {
  const resend = getResendClient();
  const response = await resend.emails.send({
    from: getFromEmail(),
    to,
    subject,
    html,
  });

  if (response.error) {
    throw new Error(response.error.message || 'Resend fout tijdens verzenden.');
  }

  return response.data;
}

function wrapTemplate(title, intro, details = []) {
  const detailRows = details
    .filter((item) => item && item.label && item.value)
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:bold;width:160px;">${item.label}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${item.value}</td>
        </tr>`
    )
    .join('');

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#f5f7fb;padding:24px;color:#111827;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
        <div style="padding:24px 24px 16px;background:#0f1117;color:#ffffff;">
          <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#00d3a7;font-weight:bold;">Zware Jongens Competitie</div>
          <h1 style="margin:8px 0 0;font-size:26px;line-height:1.25;">${title}</h1>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">${intro}</p>
          ${detailRows ? `<table style="width:100%;border-collapse:collapse;margin:0 0 16px;">${detailRows}</table>` : ''}
          <p style="margin:0;font-size:14px;line-height:1.6;color:#4b5563;">Dit is een automatische e-mail vanaf het competitie-dashboard.</p>
        </div>
      </div>
    </div>`;
}

function buildDetails(registration) {
  return [
    { label: 'Race', value: safeText(registration.raceName) || '-' },
    { label: 'Naam', value: safeText(registration.naam) || '-' },
    { label: 'E-mail', value: safeText(registration.email) || '-' },
    { label: 'Telefoon', value: safeText(registration.telefoon) || '-' },
  ];
}

async function sendParticipantEmail(registration, type) {
  const to = safeText(registration.email);
  if (!to) {
    logger.warn('Geen deelnemer e-mail gevonden, mail overgeslagen.', registration);
    return;
  }

  if (type === 'received') {
    await sendEmail({
      to,
      subject: `Inschrijving ontvangen - ${safeText(registration.raceName) || 'Race'}`,
      html: wrapTemplate(
        'Inschrijving ontvangen',
        `Hallo ${safeText(registration.naam) || 'deelnemer'}, je inschrijving is goed ontvangen en staat nu in behandeling.`,
        buildDetails(registration)
      ),
    });
    return;
  }

  if (type === 'approved') {
    await sendEmail({
      to,
      subject: `Inschrijving bevestigd - ${safeText(registration.raceName) || 'Race'}`,
      html: wrapTemplate(
        'Inschrijving bevestigd',
        `Hallo ${safeText(registration.naam) || 'deelnemer'}, je inschrijving is goedgekeurd. Je staat nu ingepland voor Sprint 1 en Sprint 2 van deze race.`,
        buildDetails(registration)
      ),
    });
    return;
  }

  if (type === 'reserve') {
    await sendEmail({
      to,
      subject: `Reservelijst - ${safeText(registration.raceName) || 'Race'}`,
      html: wrapTemplate(
        'Je staat op de reservelijst',
        `Hallo ${safeText(registration.naam) || 'deelnemer'}, deze race zit op dit moment vol. Je inschrijving is opgeslagen op de reservelijst.`,
        buildDetails(registration)
      ),
    });
    return;
  }

  if (type === 'rejected') {
    await sendEmail({
      to,
      subject: `Inschrijving afgewezen - ${safeText(registration.raceName) || 'Race'}`,
      html: wrapTemplate(
        'Inschrijving afgewezen',
        `Hallo ${safeText(registration.naam) || 'deelnemer'}, je inschrijving is afgewezen. Neem contact op als je denkt dat dit niet klopt.`,
        buildDetails(registration)
      ),
    });
  }
}

async function sendAdminNotification(registration) {
  await sendEmail({
    to: getAdminEmail(),
    subject: `Nieuwe inschrijving - ${safeText(registration.raceName) || 'Race'}`,
    html: wrapTemplate(
      'Nieuwe inschrijving ontvangen',
      `${safeText(registration.naam) || 'Onbekend'} heeft zich aangemeld via het dashboard.`,
      buildDetails(registration)
    ),
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
