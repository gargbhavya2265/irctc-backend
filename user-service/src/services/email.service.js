const sgMail = require('@sendgrid/mail');
const { config } = require('../config');

sgMail.setApiKey(config.SENDGRID_API_KEY);

const sendOtpEmail = async (email, otp, ttlMinutes = 5) => {
     const message = {
          to: email,
          from: config.MAIL_SEND,
          subject: 'IRCTC Email Verification OTP',
          text: `Your IRCTC verification OTP is ${otp}. It is valid for ${ttlMinutes} minutes.`,
          html: `
               <h2>IRCTC Email Verification</h2>
               <p>Your OTP is:</p>
               <h1>${otp}</h1>
               <p>This OTP is valid for ${ttlMinutes} minutes.</p>
               <p>Do not share this OTP with anyone.</p>
          `
     };

     return sgMail.send(message);
};

const sendWelcomeEmail = async (email, firstName) => {
     const message = {
          to: email,
          from: config.MAIL_SEND,
          subject: 'Welcome to IRCTC',
          text: `Welcome ${firstName}! Your IRCTC account has been created successfully.`,
          html: `
               <h2>Welcome to IRCTC, ${firstName}!</h2>
               <p>Your account has been created successfully.</p>
          `
     };

     return sgMail.send(message);
};

module.exports = {
     sendOtpEmail,
     sendWelcomeEmail
};