const nodemailer = require('nodemailer');

// Existing function
async function sendAdminNotification({ type, name, createdBy, createdAt }) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { 
            user: process.env.ADMIN_EMAIL, 
            pass: process.env.EMAIL_PASSWORD 
        }
    });

    const approveLink = type === 'category'
        ? `${process.env.BASE_URL}/api/category`
        : `${process.env.BASE_URL}/api/mood`;

    const emailBody = `
        📌 New Suggestion Received

        👤 Suggested by: ${createdBy}
        📝 Type: ${type}
        🔖 Name: ${name}
        ⏰ Created At: ${new Date(createdAt).toLocaleString()}
    `;

    await transporter.sendMail({
        from: process.env.ADMIN_EMAIL,
        to: process.env.ADMIN_EMAIL,
        subject: `New ${type} Suggestion`,
        text: emailBody
    });
}

// 🔹 New function: Send Password Reset Email
async function sendPasswordResetEmail({ to, resetUrl }) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { 
            user: process.env.ADMIN_EMAIL, 
            pass: process.env.EMAIL_PASSWORD 
        }
    });

    const emailBody = `
        📌 Password Reset Request

        We received a request to reset your password.
        Click the link below to reset your password:

        ${resetUrl}

        ⚠️ This link will expire in 1 hour.
        If you did not request a password reset, please ignore this email.
    `;

    await transporter.sendMail({
        from: process.env.ADMIN_EMAIL,
        to: to,
        subject: 'Diary App - Password Reset Request',
        text: emailBody
    });
}

module.exports = {
    sendAdminNotification,
    sendPasswordResetEmail
};
