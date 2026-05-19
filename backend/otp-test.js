require('dotenv').config();

const nodemailer = require('nodemailer');

async function testOtpEmail() {
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
          padding: 20px;
        "
      >
        <h2>Verification Code</h2>

        <p>
          Use the following OTP to continue:
        </p>

        <div
          style="
            margin: 30px 0;
            text-align: center;
          "
        >
          <span
            style="
              display: inline-block;
              background: #1e293b;
              color: white;
              padding: 16px 32px;
              font-size: 32px;
              font-weight: bold;
              letter-spacing: 8px;
              border-radius: 8px;
            "
          >
            482913
          </span>
        </div>

        <p>
          This OTP is valid for 10 minutes.
        </p>
      </div>
    `;

    const info =
      await transporter.sendMail({
        from:
          process.env.EMAIL_FROM ||
          process.env.SMTP_USER,

        to: 'vibhakar8@gmail.com',

        subject: 'SchoolOS OTP Test',

        html: otpHtml,
      });

    console.log(
      'OTP email sent successfully',
    );

    console.log(info);
  } catch (err) {
    console.error(
      'OTP email test failed',
    );

    console.error(err);
  }
}

testOtpEmail();
