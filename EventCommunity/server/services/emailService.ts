import nodemailer from 'nodemailer';
import { User, Event } from "@shared/schema";

// Create a test account for development
const createTestAccount = async () => {
  return await nodemailer.createTestAccount();
};

// Create reusable transporter object using the default SMTP transport
let transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

// Initialize email service
const initEmailService = async () => {
  if (process.env.NODE_ENV === 'development') {
    const testAccount = await createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log('Ethereal test account created:', testAccount.user);
  }
};

// Send registration confirmation email
export const sendRegistrationConfirmation = async (user: User, event: Event, places: number) => {
  try {
    const mailOptions = {
      from: `"Event Community" <${process.env.EMAIL_FROM || 'noreply@eventcommunity.com'}>`,
      to: user.email,
      subject: `Confirmation d'inscription - ${event.titre}`,
      text: `
        Bonjour ${user.prenom} ${user.nom},

        Votre inscription à l'événement "${event.titre}" a bien été enregistrée.
        
        Détails de votre inscription :
        - Nombre de places : ${places}
        - Date : ${event.dateDebut ? new Date(event.dateDebut).toLocaleDateString('fr-FR') : 'Non spécifiée'}
        - Lieu : ${event.lieu || 'À déterminer'}
        - Prix total : ${event.prix ? `${(Number(event.prix) * places).toFixed(2)} DT` : 'Gratuit'}
        
        Vous recevrez un rappel avant l'événement.
        
        Cordialement,
        L'équipe Event Community
      `,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Confirmation d'inscription</h2>
          <p>Bonjour <strong>${user.prenom} ${user.nom}</strong>,</p>
          <p>Votre inscription à l'événement <strong>"${event.titre}"</strong> a bien été enregistrée.</p>
          
          
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Détails de votre inscription :</h3>
            <ul style="list-style: none; padding: 0;">
              <li>• Nombre de places : <strong>${places}</strong></li>
              ${event.dateDebut ? `<li>• Date : <strong>${new Date(event.dateDebut).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong></li>` : ''}
              ${event.lieu ? `<li>• Lieu : <strong>${event.lieu}</strong></li>` : ''}
              <li>• Prix total : <strong>${event.prix ? `${(Number(event.prix) * places).toFixed(2)} DT` : 'Gratuit'}</strong></li>
            </ul>
          </div>
          
          <p>Vous recevrez un rappel avant l'événement.</p>
          
          <p>Cordialement,<br>L'équipe Event Community</p>
          
          <div style="margin-top: 30px; font-size: 12px; color: #666; border-top: 1px solid #eee; padding-top: 10px;">
            <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    }
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending registration confirmation email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

export default {
  initEmailService,
  sendRegistrationConfirmation,
};
