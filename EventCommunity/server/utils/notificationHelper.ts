import { storage } from '../storage';
import { Event } from '@shared/schema';

/**
 * Envoie une notification à tous les membres lorsqu'un nouvel événement est créé
 * @param event L'événement qui vient d'être créé
 */
export async function notifyMembersAboutNewEvent(event: Event): Promise<void> {
  try {
    // Récupérer tous les utilisateurs
    const users = await storage.getUsers();
    
    // Préparer les détails de l'événement pour le message
    let eventDetails = [];
    
    // Ajouter la date si disponible
    if (event.date) {
      try {
        const eventDate = new Date(event.date);
        if (!isNaN(eventDate.getTime())) {
          const formattedDate = eventDate.toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          eventDetails.push(`📅 ${formattedDate}`);
        }
      } catch (dateError) {
        console.error('Erreur de format de date:', dateError);
      }
    }
    
    // Ajouter le lieu si disponible
    if (event.lieu && event.lieu.trim() !== '') {
      eventDetails.push(`📍 ${event.lieu.trim()}`);
    } else {
      eventDetails.push('📍 Lieu à confirmer');
    }
    
    // Ajouter la description si disponible
    if (event.description) {
      eventDetails.push(`\n${event.description}`);
    }
    
    // Créer une notification pour chaque utilisateur
    const notificationPromises = users.map(user => {
      const notification = {
        utilisateurId: user.id,
        titre: '🎉 Nouvel événement disponible !',
        message: `Un nouvel événement a été ajouté : "${event.titre || 'sans titre'}"\n\n` +
                `${eventDetails.join('\n')}\n\n` +
                'Cliquez pour plus de détails et pour vous inscrire !',
        lue: false,
        lien: `/events/${event.id}`
      };
      
      return storage.createNotification(notification);
    });
    
    // Envoyer toutes les notifications en parallèle
    await Promise.all(notificationPromises);
    
    console.log(`[Notification] Notifications envoyées à ${users.length} membres pour le nouvel événement "${event.titre}"`);
  } catch (error) {
    console.error('[Notification] Erreur lors de l\'envoi des notifications pour le nouvel événement:', error);
    // Ne pas échouer la création de l'événement même si les notifications échouent
  }
}
