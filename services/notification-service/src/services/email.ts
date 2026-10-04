import nodemailer from "nodemailer";
import type { Notification } from "@prisma/client";

export async function sendEmailNotification(notification: Notification, to: string) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "localhost",
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: false
  });

  await transporter.sendMail({
    to,
    from: process.env.SMTP_FROM ?? "alerts@energyiq.local",
    subject: notification.title,
    text: notification.body
  });
}
