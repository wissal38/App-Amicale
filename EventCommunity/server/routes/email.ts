import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { MongoStorage } from '../mongodb-storage';
import { sendRegistrationConfirmation } from '../services/emailService';
import { z } from 'zod';

const router = Router();
const storage = new MongoStorage();

// Schema for email confirmation request
const emailConfirmationSchema = z.object({
  userId: z.number().int().positive(),
  eventId: z.number().int().positive(),
  places: z.number().int().positive().max(10)
});

/**
 * @route POST /api/email/confirm-registration
 * @description Send a registration confirmation email
 * @access Private (requires authentication)
 */
router.post('/confirm-registration', authenticateJWT, async (req: any, res) => {
  try {
    // Validate request body
    const { userId, eventId, places } = emailConfirmationSchema.parse(req.body);
    
    // Get user and event details
    const [user, event] = await Promise.all([
      storage.getUser(userId),
      storage.getEvent(eventId)
    ]);

    if (!user) {
      return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
    }

    if (!event) {
      return res.status(404).json({ success: false, error: 'Événement non trouvé' });
    }

    // Send confirmation email
    const result = await sendRegistrationConfirmation(user, event, places);
    
    if (!result.success) {
      console.error('Failed to send confirmation email:', result.error);
      return res.status(500).json({
        success: false,
        error: 'Échec de l\'envoi de l\'email de confirmation',
        details: process.env.NODE_ENV === 'development' ? result.error : undefined
      });
    }

    res.json({ success: true, message: 'Email de confirmation envoyé avec succès' });
  } catch (error) {
    console.error('Error in email confirmation:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Données de requête invalides',
        details: error.errors
      });
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'envoi de l\'email de confirmation',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    });
  }
});

export default router;
