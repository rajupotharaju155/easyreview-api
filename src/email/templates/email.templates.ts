const LOGO_URL =
  'https://github.com/user-attachments/assets/cfc0f6f3-38a1-4bc1-b2e5-519a7efc68ce';

function emailShell(bodyHtml: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #0f172a; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background: #ffffff; padding: 20px 20px 8px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="vertical-align: middle; padding-right: 10px;">
              <div style="width: 44px; height: 44px; overflow: hidden; border-radius: 10px;">
                <img
                  src="${LOGO_URL}"
                  alt="EasyReview"
                  height="44"
                  style="display: block; height: 44px; width: auto; border: 0;"
                />
              </div>
            </td>
            <td style="vertical-align: middle;">
              <span style="font-size: 20px; font-weight: 700; color: #6b2fd5; letter-spacing: -0.02em;">
                EasyReview
              </span>
            </td>
          </tr>
        </table>
      </div>
      <div style="padding: 16px 20px 24px;">
        ${bodyHtml}
        <p style="margin: 24px 0 0; padding-top: 16px; border-top: 1px solid #e2e8f0;">
          <a
            href="https://easyreview.co.in"
            style="color: #6b2fd5; font-size: 14px; text-decoration: none; font-weight: 600;"
          >
            easyreview.co.in
          </a>
        </p>
      </div>
    </div>
  `.trim();
}

export function verificationOtpEmailHtml(otp: string): string {
  return emailShell(`
    <h2 style="margin: 0 0 12px; font-size: 20px;">Email verification</h2>
    <p style="margin: 0 0 16px; line-height: 1.5;">
      Use this one-time password to verify your email address.
    </p>
    <p style="margin: 0 0 16px; font-size: 28px; font-weight: 700; letter-spacing: 4px;">
      ${otp}
    </p>
    <p style="margin: 0; color: #64748b; font-size: 14px;">
      This code expires in 10 minutes.
    </p>
  `);
}

export function welcomeEmailHtml(businessName?: string): string {
  const greeting = businessName?.trim()
    ? `Welcome to EasyReview, ${businessName.trim()}!`
    : 'Welcome to EasyReview!';

  return emailShell(`
    <h2 style="margin: 0 0 12px; font-size: 20px;">${greeting}</h2>
    <p style="margin: 0 0 12px; line-height: 1.5;">
      Thanks for joining EasyReview for small business. You can now collect more Google reviews with QR standees and simple rating links.
    </p>
    <p style="margin: 0; color: #64748b; font-size: 14px;">
      — The EasyReview team
    </p>
  `);
}
