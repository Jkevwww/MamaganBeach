const twilio = require('twilio');

const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

async function sendBookingSMS(to, details) {
  const body = `Mamagan Beach Resort: Hi ${details.full_name}! Your booking for ${details.facility_name} on ${details.booking_date} (${details.time_slot}) is confirmed. Paid: PHP ${Number(details.total_amount).toFixed(2)}. Booking ID: ${details.booking_id}. Show your QR code at check-in. Enjoy!`;

  try {
    await client.messages.create({
      body,
      from: fromNumber,
      to,
    });
  } catch (err) {
    console.error('SMS send error:', err.message);
  }
}

module.exports = {
  sendBookingSMS,
};

