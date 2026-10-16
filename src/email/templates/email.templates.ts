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

export type OrderConfirmationEmailDetails = {
  orderId: string;
  designName: string;
  businessName: string;
  quantity: number;
  amountInr: number;
  phoneNumber: string;
  deliveryAddress: string;
  placedAtIst: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function orderConfirmationEmailHtml(
  details: OrderConfirmationEmailDetails,
): string {
  const orderId = escapeHtml(details.orderId);
  const designName = escapeHtml(details.designName);
  const businessName = escapeHtml(details.businessName);
  const phoneNumber = escapeHtml(details.phoneNumber);
  const deliveryAddress = escapeHtml(details.deliveryAddress);
  const placedAtIst = escapeHtml(details.placedAtIst);

  return emailShell(`
    <h2 style="margin: 0 0 12px; font-size: 20px;">Order confirmed</h2>
    <p style="margin: 0 0 16px; line-height: 1.5;">
      Thanks for ordering your EasyReview standee. We&apos;ve received your order and our team will call you shortly to confirm the details.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin: 0 0 16px; font-size: 14px; line-height: 1.5;">
      <tr>
        <td style="padding: 6px 0; color: #64748b; width: 120px; vertical-align: top;">Order ID</td>
        <td style="padding: 6px 0; font-weight: 600;">${orderId}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; color: #64748b; vertical-align: top;">Placed at</td>
        <td style="padding: 6px 0; font-weight: 600;">${placedAtIst}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; color: #64748b; vertical-align: top;">Design</td>
        <td style="padding: 6px 0; font-weight: 600;">${designName} standee</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; color: #64748b; vertical-align: top;">Business</td>
        <td style="padding: 6px 0; font-weight: 600;">${businessName}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; color: #64748b; vertical-align: top;">Quantity</td>
        <td style="padding: 6px 0; font-weight: 600;">${details.quantity}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; color: #64748b; vertical-align: top;">Amount</td>
        <td style="padding: 6px 0; font-weight: 600;">₹${details.amountInr}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; color: #64748b; vertical-align: top;">Phone</td>
        <td style="padding: 6px 0; font-weight: 600;">${phoneNumber}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; color: #64748b; vertical-align: top;">Deliver to</td>
        <td style="padding: 6px 0; font-weight: 600;">${deliveryAddress}</td>
      </tr>
    </table>
    <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.5;">
      You can track this order anytime from the
      <a
        href="https://app.easyreview.co.in/orders"
        style="color: #6b2fd5; text-decoration: none; font-weight: 600;"
      >Orders page</a>
      in your EasyReview dashboard.
    </p>
  `);
}

const PRIVATE_FEEDBACK_DASHBOARD_URL =
  'https://app.easyreview.co.in/easy-review/private-feedback';

export type PrivateFeedbackEmailDetails = {
  locationName: string;
  rating: number;
  feedback: string;
  receivedAtIst: string;
};

function ratingStars(rating: number): string {
  const filled = Math.min(5, Math.max(0, Math.round(rating)));
  const empty = 5 - filled;
  const filledStars = filled
    ? `<span style="color: #fbbf24;">${'&#9733;'.repeat(filled)}</span>`
    : '';
  const emptyStars = empty
    ? `<span style="color: #cbd5e1;">${'&#9733;'.repeat(empty)}</span>`
    : '';
  return `${filledStars}${emptyStars}`;
}

export function privateFeedbackReceivedEmailHtml(
  details: PrivateFeedbackEmailDetails,
): string {
  const locationName = escapeHtml(details.locationName);
  const feedback = escapeHtml(details.feedback).replaceAll('\n', '<br>');
  const receivedAtIst = escapeHtml(details.receivedAtIst);
  const stars = ratingStars(details.rating);

  return emailShell(`
    <p style="margin: 0 0 16px; line-height: 1.5;">
      A customer sent this privately for <strong>${locationName}</strong> instead of posting it on Google.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin: 0 0 16px; border: 1px solid #e2e8f0; border-radius: 16px; background: #ffffff;">
      <tr>
        <td align="left" style="padding: 20px; text-align: left;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin: 0 0 12px;">
            <tr>
              <td align="left" style="font-size: 14px; font-weight: 600; color: #0f172a; vertical-align: middle; text-align: left;">
                ${locationName}
              </td>
              <td align="right" style="vertical-align: middle; width: 1%; white-space: nowrap; padding-left: 12px;">
                <span style="display: inline-block; background: #fffbeb; color: #b45309; font-size: 12px; font-weight: 500; line-height: 1.4; padding: 2px 8px; border-radius: 8px;">
                  Private
                </span>
              </td>
            </tr>
          </table>
          <p style="margin: 0 0 12px; font-size: 18px; line-height: 1; letter-spacing: 2px; text-align: left;">${stars}</p>
          <p style="margin: 0; font-size: 14px; line-height: 1.625; color: #475569; text-align: left; word-break: break-word;">&ldquo;${feedback}&rdquo;</p>
          <p style="margin: 12px 0 0; font-size: 12px; color: #94a3b8; text-align: left;">${receivedAtIst}</p>
        </td>
      </tr>
    </table>
    <p style="margin: 0 0 16px; text-align: center; color: #ea580c; font-size: 14px; font-weight: 600; line-height: 1.5;">
      This review is NOT posted on Google
    </p>
    <p style="margin: 0;">
      <a
        href="${PRIVATE_FEEDBACK_DASHBOARD_URL}"
        style="display: inline-block; background: #6b2fd5; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 10px 16px; border-radius: 8px;"
      >
        View private feedback
      </a>
    </p>
  `);
}

export function adminOrderReceivedEmailHtml(
  details: OrderConfirmationEmailDetails,
): string {
  const orderId = escapeHtml(details.orderId);
  const designName = escapeHtml(details.designName);
  const businessName = escapeHtml(details.businessName);
  const phoneNumber = escapeHtml(details.phoneNumber);
  const deliveryAddress = escapeHtml(details.deliveryAddress);
  const placedAtIst = escapeHtml(details.placedAtIst);

  return emailShell(`
    <h2 style="margin: 0 0 12px; font-size: 20px;">New order received</h2>
    <p style="margin: 0 0 16px; line-height: 1.5;">
      We have received an order from <strong>${businessName}</strong>.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width: 100%; margin: 0; font-size: 14px; line-height: 1.5;">
      <tr>
        <td style="padding: 6px 0; color: #64748b; width: 120px; vertical-align: top;">Order ID</td>
        <td style="padding: 6px 0; font-weight: 600;">${orderId}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; color: #64748b; vertical-align: top;">Placed at</td>
        <td style="padding: 6px 0; font-weight: 600;">${placedAtIst}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; color: #64748b; vertical-align: top;">Design</td>
        <td style="padding: 6px 0; font-weight: 600;">${designName} standee</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; color: #64748b; vertical-align: top;">Business</td>
        <td style="padding: 6px 0; font-weight: 600;">${businessName}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; color: #64748b; vertical-align: top;">Quantity</td>
        <td style="padding: 6px 0; font-weight: 600;">${details.quantity}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; color: #64748b; vertical-align: top;">Amount</td>
        <td style="padding: 6px 0; font-weight: 600;">₹${details.amountInr}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; color: #64748b; vertical-align: top;">Phone</td>
        <td style="padding: 6px 0; font-weight: 600;">${phoneNumber}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; color: #64748b; vertical-align: top;">Deliver to</td>
        <td style="padding: 6px 0; font-weight: 600;">${deliveryAddress}</td>
      </tr>
    </table>
  `);
}
