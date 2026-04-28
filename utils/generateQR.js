const QRCode = require('qrcode');
const crypto = require('crypto');

function generateVerificationHash(bookingId, secret) {
  return crypto.createHmac('sha256', secret).update(bookingId).digest('hex').substring(0, 16);
}

async function generateBookingQR(bookingId) {
  const secret = process.env.JWT_SECRET || 'default_secret';
  const hash = generateVerificationHash(bookingId, secret);
  const data = JSON.stringify({
    booking_id: bookingId,
    v: hash,
  });

  try {
    const qrDataUrl = await QRCode.toDataURL(data, {
      width: 400,
      margin: 2,
      color: {
        dark: '#0ea5e9',
        light: '#ffffff',
      },
    });
    return qrDataUrl;
  } catch (err) {
    console.error('QR generation error:', err);
    throw err;
  }
}

function verifyQRData(qrPayload) {
  try {
    const data = typeof qrPayload === 'string' ? JSON.parse(qrPayload) : qrPayload;
    const { booking_id, v } = data;
    if (!booking_id || !v) return { valid: false };

    const secret = process.env.JWT_SECRET || 'default_secret';
    const expectedHash = generateVerificationHash(booking_id, secret);
    return { valid: v === expectedHash, booking_id };
  } catch {
    return { valid: false };
  }
}

module.exports = {
  generateBookingQR,
  verifyQRData,
  generateVerificationHash,
};

