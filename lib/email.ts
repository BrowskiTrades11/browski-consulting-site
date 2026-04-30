import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "trentonsdombrowski@gmail.com";
const FROM_EMAIL = process.env.FROM_EMAIL || "notifications@browskiconsulting.com";

export async function sendAdminEmail(subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) return;
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject,
      html,
    });
  } catch {
    // Don't let email failure break the API response
  }
}
