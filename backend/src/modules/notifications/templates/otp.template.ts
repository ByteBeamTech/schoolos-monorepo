import { baseTemplate } from './base.template';

interface OtpTemplateData {
  otp: string;
  validityMinutes?: number;
}

export function otpTemplate(
  data: OtpTemplateData,
): string {
  return baseTemplate(`
    <h2
      style="
        margin-top: 0;
        color: #0f172a;
      "
    >
      Verification Code
    </h2>

    <p
      style="
        color: #334155;
        line-height: 1.7;
        font-size: 15px;
      "
    >
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
        ${data.otp}
      </span>
    </div>

    <p
      style="
        color: #64748b;
        font-size: 14px;
      "
    >
      This OTP is valid for
      ${
        data.validityMinutes || 10
      } minutes.
    </p>

    <p
      style="
        color: #ef4444;
        font-size: 13px;
        margin-top: 24px;
      "
    >
      For Security reasons, do not share this OTP with anyone.
    </p>
  `);
}
