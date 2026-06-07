import crypto from 'crypto';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.error('Missing RESEND_API_KEY environment variable.');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { hash: requestHash } = req.query;
  if (!requestHash || typeof requestHash !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid request hash' });
  }

  // Generate a random math question (e.g. 5 + 9)
  const num1 = Math.floor(Math.random() * 15) + 1;
  const num2 = Math.floor(Math.random() * 15) + 1;
  const sum = num1 + num2;
  const timestamp = Date.now();

  // Create HMAC hash using the Resend API Key as the secret key
  const hash = crypto
    .createHmac('sha256', resendApiKey)
    .update(`${sum}:${timestamp}:${requestHash}`)
    .digest('hex');

  const token = `${timestamp}:${hash}`;

  return res.status(200).json({
    question: `What is ${num1} + ${num2}?`,
    token
  });
}
