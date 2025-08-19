const nodemailer = require('nodemailer');

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

        ✅ If you want to approve this ${type}, you can add it using:
        ${approveLink}
    `;

    await transporter.sendMail({
        from: process.env.ADMIN_EMAIL,
        to: process.env.ADMIN_EMAIL,
        subject: `New ${type} Suggestion`,
        text: emailBody
    });
}

module.exports = sendAdminNotification;
