require('dotenv').config();

const nodemailer = require('nodemailer');

async function testEmail() {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.zoho.in',

      port: Number(process.env.SMTP_PORT || 587),

      secure: false,

      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },

      tls: {
        minVersion:
          process.env.SMTP_TLS_MIN_VERSION ||
          'TLSv1.2',
      },
    });

    console.log('Verifying SMTP connection...');

    await transporter.verify();

    console.log('SMTP verification successful');

    const info = await transporter.sendMail({
      from:
        process.env.EMAIL_FROM ||
        process.env.SMTP_USER,

      to: 'frostabbi3@gmail.com',

      subject: 'SchoolOS SMTP Test',

      text: 'Kya haal hai bhadwe SMTP integration working successfully.',

      html: `
        <h2>SchoolOS SMTP Test</h2>
        <p>Zoho SMTP integration working successfully.</p>
      `,
    });

    console.log('Email sent successfully');
    console.log(info);

    process.exit(0);
  } catch (err) {
    console.error('SMTP TEST FAILED');
    console.error(err);

    process.exit(1);
  }
}

testEmail();
