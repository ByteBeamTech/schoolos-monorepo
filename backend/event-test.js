require('dotenv').config();

const nodemailer = require('nodemailer');

async function testEventEmail() {
  try {
    const transporter =
      nodemailer.createTransport({
        host:
          process.env.SMTP_HOST ||
          'smtp.zoho.in',

        port: Number(
          process.env.SMTP_PORT || 587,
        ),

        secure:
          process.env.SMTP_SECURE ===
          'true',

        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },

        tls: {
          minVersion:
            process.env
              .SMTP_TLS_MIN_VERSION ||
            'TLSv1.2',
        },
      });

    await transporter.verify();

    const otpHtml = `
      <div
        style="
          font-family: Arial, sans-serif;
          padding: 24px;
        "
      >
        <h2>USER_LOGIN_OTP Event</h2>

        <p>
          Event-driven notification test
          successful.
        </p>

        <div
          style="
            margin-top: 24px;
            padding: 20px;
            background: #1e293b;
            color: white;
            display: inline-block;
            border-radius: 8px;
            font-size: 32px;
            letter-spacing: 8px;
          "
        >
          482913
        </div>
      </div>
    `;

    const info =
      await transporter.sendMail({
        from:
          process.env.EMAIL_FROM ||
          process.env.SMTP_USER,

        to: 'vibhakar8@gmail.com',

        subject:
          'SchoolOS Event System Test',

        html: otpHtml,
      });

    console.log(
      'Event-driven email test successful',
    );

    console.log(info);
  } catch (err) {
    console.error(
      'Event test failed',
    );

    console.error(err);
  }
}

testEventEmail();

