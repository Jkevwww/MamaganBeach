const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendTicketEmail(to, bookingDetails) {
  const { booking_id, full_name, facility_name, booking_date, time_slot, total_amount, qr_code } = bookingDetails;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #0ea5e9, #0284c7); padding: 30px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 24px;">Mamagan Beach Resort</h1>
        <p style="margin: 8px 0 0 0; opacity: 0.9;">Your Booking Confirmation</p>
      </div>
      <div style="padding: 30px;">
        <p style="font-size: 16px; color: #334155;">Hi <strong>${full_name}</strong>,</p>
        <p style="color: #64748b;">Thank you for booking with us! Here are your reservation details:</p>
        
        <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <table style="width: 100%; font-size: 14px; color: #334155;">
            <tr><td style="padding: 6px 0; color: #64748b;">Booking ID</td><td style="font-weight: bold;">${booking_id}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Facility</td><td style="font-weight: bold;">${facility_name}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Date</td><td style="font-weight: bold;">${booking_date}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Time Slot</td><td style="font-weight: bold;">${time_slot}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Total Paid</td><td style="font-weight: bold; color: #059669;">PHP ${Number(total_amount).toLocaleString('en-PH', {minimumFractionDigits: 2})}</td></tr>
          </table>
        </div>

        <p style="color: #64748b; text-align: center;">Present this QR code at the resort entrance for quick check-in:</p>
        <div style="text-align: center; margin: 20px 0;">
          <img src="${qr_code}" alt="QR Ticket" style="max-width: 250px; border-radius: 8px; border: 2px solid #e2e8f0;" />
        </div>

        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 4px; margin-top: 20px;">
          <p style="margin: 0; font-size: 13px; color: #92400e;"><strong>Reminder:</strong> Please arrive 15 minutes before your scheduled time. Cancellations must be made at least 24 hours in advance for a refund.</p>
        </div>
      <div style="background: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8;">
        Mamagan Fun & Adventure Beach Resort | Barangay Mamagan, Coastal Road, Philippines
      </div>
  `;

  await transporter.sendMail({
    from: `"Mamagan Beach Resort" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Your Mamagan Beach Resort Booking Confirmation',
    html,
  });
}

async function sendPaymentReceipt(to, details) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; text-align: center; padding: 40px;">
      <h2 style="color: #059669;">Payment Successful</h2>
      <p style="color: #64748b;">Your payment of <strong>PHP ${Number(details.amount).toLocaleString('en-PH', {minimumFractionDigits: 2})}</strong> has been received.</p>
      <p style="color: #94a3b8; font-size: 12px;">Booking ID: ${details.booking_id}</p>
    </div>
  `;
  await transporter.sendMail({
    from: `"Mamagan Beach Resort" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Payment Receipt - Mamagan Beach Resort',
    html,
  });
}

module.exports = {
  sendTicketEmail,
  sendPaymentReceipt,
};
