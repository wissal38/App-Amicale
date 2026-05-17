// Importation des hooks et bibliothèques nécessaires
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"; // Hooks pour les requêtes et mutations
// Importation des composants UI pour les cartes et boutons
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// Importation des icônes Lucide React
import { Bell, Check, Trash2, Mail, AlertCircle, Info } from "lucide-react";
// Importation de l'API et du hook toast
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
// Importation du type Notification depuis le schéma partagé
import { Notification as NotificationType } from "@shared/schema";

// Composant principal pour la page des notifications
export default function Notifications() {
  // Hook pour afficher des notifications toast
  const { toast } = useToast();
  // Client pour invalider les requêtes
  const queryClient = useQueryClient();

  // Requête pour récupérer la liste des notifications
  const { data: notifications = [], isLoading } = useQuery<NotificationType[]>({
    queryKey: ["/api/notifications"], // Clé unique pour cette requête
  });

  // Mutation pour marquer une notification comme lue
  const markAsReadMutation = useMutation({
    mutationFn: (id: number) => api.markNotificationAsRead(id), // Fonction d'appel API
    onSuccess: () => {
      // Invalidation de la requête pour rafraîchir les données
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: "Notification marquée comme lue",
        description: "La notification a été marquée comme lue",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de marquer la notification comme lue",
        variant: "destructive",
      });
    },
  });

  // Mutation pour supprimer une notification
  const deleteNotificationMutation = useMutation({
    mutationFn: (id: number) => api.deleteNotification(id), // Fonction d'appel API
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: "Notification supprimée",
        description: "La notification a été supprimée avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la notification",
        variant: "destructive",
      });
    },
  });

  // Fonction pour obtenir l'icône selon le type de notification
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "info":
        return <Info className="text-blue-600" size={20} />; // Icône info bleue
      case "warning":
        return <AlertCircle className="text-yellow-600" size={20} />; // Icône alerte jaune
      case "error":
        return <AlertCircle className="text-red-600" size={20} />; // Icône alerte rouge
      case "success":
        return <Check className="text-green-600" size={20} />; // Icône succès verte
      default:
        return <Bell className="text-gray-600" size={20} />; // Icône cloche par défaut
    }
  };

  // Fonction pour obtenir la couleur de fond selon le type de notification
  const getNotificationColor = (type: string) => {
    switch (type) {
      case "info":
        return "bg-blue-50 border-blue-200"; // Fond bleu pour info
      case "warning":
        return "bg-yellow-50 border-yellow-200"; // Fond jaune pour warning
      case "error":
        return "bg-red-50 border-red-200"; // Fond rouge pour error
      case "success":
        return "bg-green-50 border-green-200"; // Fond vert pour success
      default:
        return "bg-gray-50 border-gray-200"; // Fond gris par défaut
    }
  };

  // Fonction pour formater une date en français
  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Séparation des notifications lues et non lues
  const unreadNotifications = notifications.filter((n) => !n.lue); // Notifications non lues
  const readNotifications = notifications.filter((n) => n.lue); // Notifications lues

  // Fonction pour marquer une notification comme lue
  const markAsRead = (id: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Empêche la propagation de l'événement
    markAsReadMutation.mutate(id); // Exécute la mutation
  };

  // Fonction pour supprimer une notification
  const deleteNotification = (id: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Empêche la propagation de l'événement
    deleteNotificationMutation.mutate(id); // Exécute la mutation
  };

  // Fonction pour marquer toutes les notifications comme lues
  const markAllAsRead = () => {
    notifications
      .filter((n) => !n.lue) // Filtre les notifications non lues
      .forEach((n) => markAsReadMutation.mutate(n.id)); // Marque chacune comme lue
  };

  // Gestion de l'état de chargement
  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <div className="animate-pulse space-y-4"> {/* Animation de chargement */}
          {[...Array(3)].map((_, i) => ( // Génère 3 éléments de chargement
            <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  // Rendu principal du composant
  return (
    <div className="space-y-6"> {/* Conteneur principal */}
      <div className="flex items-center justify-between"> {/* En-tête avec titre et badges */}
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1> {/* Titre de la page */}
        <div className="flex items-center space-x-2"> {/* Badges de statistiques */}
          <Badge variant="secondary"> {/* Badge total des notifications */}
            {notifications.length} notification{notifications.length !== 1 ? "s" : ""}
          </Badge>
          {unreadNotifications.length > 0 && ( // Badge pour les notifications non lues (si il y en a) */}
            <Badge className="bg-red-100 text-red-600">
              {unreadNotifications.length} non lu{unreadNotifications.length !== 1 ? "es" : "e"}
            </Badge>
          )}
        </div>
      </div>

      {notifications.length === 0 ? ( // Message si aucune notification
        <div className="text-center py-12">
          <Bell size={48} className="mx-auto text-gray-400 mb-4" /> {/* Icône cloche */}
          <p className="text-gray-500">Aucune notification</p>
        </div>
      ) : (
        <div className="space-y-6"> {/* Conteneur pour les sections de notifications */}
          {/* Section des notifications non lues */}
          {unreadNotifications.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Non lues ({unreadNotifications.length}) {/* Titre avec compteur */}
              </h2>
              <div className="space-y-4"> {/* Liste des notifications non lues */}
                {unreadNotifications.map((notification) => (
                  <Card
                    key={notification.id}
                    className={`border-l-4 ${getNotificationColor(notification.titre?.toLowerCase() || 'info')}`} // Bordure colorée selon le type
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-4"> {/* Layout flex pour l'icône et le contenu */}
                        <div className="flex-shrink-0 mt-1"> {/* Icône de notification */}
                          {getNotificationIcon(notification.titre?.toLowerCase() || 'info')}
                        </div>
                        <div className="flex-1 min-w-0"> {/* Contenu principal */}
                          <h3 className="font-medium text-gray-900">
                            {notification.titre} {/* Titre de la notification */}
                          </h3>
                          <p className="mt-1 text-gray-600">{notification.message}</p> {/* Message */}
                          <p className="mt-2 text-sm text-gray-500">
                            {formatDate(notification.createdAt)} {/* Date formatée */}
                          </p>
                        </div>
                        <div className="flex-shrink-0 flex space-x-2"> {/* Boutons d'action */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markAsReadMutation.mutate(notification.id)} // Marquer comme lu
                            disabled={markAsReadMutation.isPending} // Désactiver pendant la mutation
                            className="text-green-600 hover:text-green-700"
                          >
                            <Check size={16} /> {/* Icône check */}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteNotificationMutation.mutate(notification.id)} // Supprimer
                            disabled={deleteNotificationMutation.isPending}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 size={16} /> {/* Icône poubelle */}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Section des notifications lues */}
          {readNotifications.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Lues ({readNotifications.length}) {/* Titre avec compteur */}
              </h2>
              <div className="space-y-4"> {/* Liste des notifications lues */}
                {readNotifications.map((notification) => (
                  <Card
                    key={notification.id}
                    className="border border-gray-200 opacity-75" // Style plus discret pour les lues
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0 mt-1">
                          {getNotificationIcon(notification.titre?.toLowerCase() || 'info')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900">
                            {notification.titre}
                          </h3>
                          <p className="mt-1 text-gray-600">{notification.message}</p>
                          <p className="mt-2 text-sm text-gray-500">
                            {formatDate(notification.createdAt)}
                          </p>
                        </div>
                        <div className="flex-shrink-0"> {/* Seulement le bouton supprimer pour les lues */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteNotificationMutation.mutate(notification.id)}
                            disabled={deleteNotificationMutation.isPending}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
