import nodemailer from "nodemailer";

let transporter;

function obtenerTransporter() {
  const host = process.env.SMTP_HOST;
  const from = process.env.SMTP_FROM;
  if (!host || !from) {
    throw new Error("El servicio de correo no está configurado.");
  }

  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === "true" || port === 465,
      ...(process.env.SMTP_USER && process.env.SMTP_PASSWORD
        ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } }
        : {}),
    });
  }

  return { transporter, from };
}

export async function enviarCodigoVerificacion(email, codigo) {
  const { transporter: servicioCorreo, from } = obtenerTransporter();
  await servicioCorreo.sendMail({
    from,
    to: email,
    subject: "Código de verificación CINTAC",
    text: `Tu código de verificación es ${codigo}. Expira en 10 minutos. Si no solicitaste este código, ignora este correo.`,
  });
}

export async function enviarCodigoAprobacionRol(email, codigo, { username, rol }) {
  const { transporter: servicioCorreo, from } = obtenerTransporter();
  await servicioCorreo.sendMail({
    from,
    to: email,
    subject: "Aprobación de nuevo acceso administrativo CINTAC",
    text: [
      `Se solicitó crear la cuenta "${username}" con el rol ${rol}.`,
      `Código de aprobación: ${codigo}`,
      "El código vence en 10 minutos y permite hasta cinco intentos.",
      "Si no reconoces esta solicitud, ignora este mensaje. No compartas este código.",
    ].join("\n\n"),
  });
}