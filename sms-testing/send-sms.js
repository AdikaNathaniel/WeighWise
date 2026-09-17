// One-off script to test sending an SMS via the Arkesel v2 API.
// Run with: node --env-file=sms-testing/.env sms-testing/send-sms.js

const apiKey = process.env.ARKESEL_API_KEY;
const rawTo = process.env.SMS_TO;
const message = process.env.SMS_MESSAGE;

if (!apiKey || !rawTo || !message) {
  console.error('Missing ARKESEL_API_KEY, SMS_TO, or SMS_MESSAGE (check sms-testing/.env).');
  process.exit(1);
}

// Arkesel expects Ghanaian numbers in international format (233…) rather than a leading 0.
const to = rawTo.startsWith('0') ? `233${rawTo.slice(1)}` : rawTo;

async function main() {
  const res = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: 'SMSTest',
      message,
      recipients: [to],
    }),
  });

  const body = await res.json().catch(() => null);
  console.log('Status:', res.status);
  console.log('Response:', body);

  if (!res.ok || body?.status !== 'success') {
    process.exitCode = 1;
  }
}

main();
