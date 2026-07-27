export function verificationOtpEmailHtml(otp: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #0f172a;">
      <h2 style="margin: 0 0 12px;">Email verification</h2>
      <p style="margin: 0 0 16px; line-height: 1.5;">
        Use this one-time password to verify your email address.
      </p>
      <p style="margin: 0 0 16px; font-size: 28px; font-weight: 700; letter-spacing: 4px;">
        ${otp}
      </p>
      <p style="margin: 0; color: #64748b; font-size: 14px;">
        This code expires in 10 minutes.
      </p>
    </div>
  `.trim();
}

export function welcomeEmailHtml(businessName?: string): string {
  const greeting = businessName?.trim()
    ? `Welcome to EasyReview, ${businessName.trim()}!`
    : 'Welcome to EasyReview!';

  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #0f172a;">
      <h2 style="margin: 0 0 12px;">${greeting}</h2>
      <p style="margin: 0 0 12px; line-height: 1.5;">
        Thanks for joining EasyReview for small business. You can now collect more Google reviews with QR standees and simple rating links.
      </p>
      <p style="margin: 0; color: #64748b; font-size: 14px;">
        — The EasyReview team
      </p>
    </div>
  `.trim();
}
