/**
 * Email Channel for notification delivery.
 * This should eventually integrate with Mailgun, SendGrid, or Nodemailer.
 */
class EmailChannel {
  /**
   * Send an email notification to the user.
   * @param {Object} data - Notification job data
   */
  async send(data) {
    const { email, title, message, html, ...extraData } = data;

    if (!email) {
      console.warn("Cannot send email notification without email address");
      return;
    }

    try {
      console.log(`[EmailChannel] Sending email to ${email}: ${title}`);
      // TODO: Integrate with actual email service (Nodemailer, SendGrid, etc.)
      // Example implementation with Nodemailer could go here:
      // await transporter.sendMail({
      //   from: process.env.EMAIL_FROM,
      //   to: email,
      //   subject: title,
      //   text: message,
      //   html: html || `<p>${message}</p>`,
      // });
    } catch (error) {
      console.error(`[EmailChannel] Failed to send email to ${email}:`, error);
      throw error;
    }
  }
}

export const emailChannel = new EmailChannel();
