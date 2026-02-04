import fetch from 'node-fetch';

export async function sendTelegramMessage(text) {
  const url = `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`;

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: process.env.CHAT_ID,
      text,
      parse_mode: 'HTML',
    }),
  });
}
