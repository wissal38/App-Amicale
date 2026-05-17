// Importation des hooks et bibliothèques nécessaires
import { useQuery } from "@tanstack/react-query"; // Hook pour les requêtes de données
// Importation des composants UI pour les cartes et badges
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
// Importation des icônes Lucide React
import { CreditCard, Calendar, Users, AlertCircle } from "lucide-react";
// Importation des types depuis le schéma partagé
import type { Event, User } from "@shared/schema";

// Interface pour définir la structure d'un paiement
interface Payment {
  id: number; // Identifiant unique du paiement
  montant: number | string; // Montant du paiement
  statut: string; // Statut du paiement (paye, en_attente, etc.)
  userId: number; // ID de l'utilisateur
  eventId: number; // ID de l'événement
  // Autres champs peuvent être ajoutés selon le backend
}

// Composant principal pour la page des paiements
export default function Payments() {
  // Requête pour récupérer la liste des paiements
  const { data: payments = [], isLoading: paymentsLoading, error: paymentsError } = useQuery<Payment[]>({
    queryKey: ["/api/payments"], // Clé unique pour cette requête
  });

  // Requête pour récupérer la liste des événements
  const { data: events = [], isLoading: eventsLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"], // Clé unique pour cette requête
  });

  // Requête pour récupérer la liste des utilisateurs
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"], // Clé unique pour cette requête
  });

  // Fonction pour récupérer les détails d'un événement par son ID
  const getEventDetails = (eventId: number) => {
    return events.find((event: any) => event.id === eventId);
  };

  // Fonction pour récupérer les détails d'un utilisateur par son ID
  const getUserDetails = (userId: number) => {
    return users.find((user: any) => user.id === userId);
  };

  // Fonction pour obtenir la classe CSS de couleur selon le statut du paiement
  const getStatusColor = (status: string) => {
    switch (status) {
      case "paye":
        return "bg-green-100 text-green-700"; // Vert pour payé
      case "en_attente":
        return "bg-yellow-100 text-yellow-700"; // Jaune pour en attente
      case "annule":
        return "bg-red-100 text-red-700"; // Rouge pour annulé
      case "rembourse":
        return "bg-blue-100 text-blue-700"; // Bleu pour remboursé
      default:
        return "bg-gray-100 text-gray-700"; // Gris par défaut
    }
  };

  // Fonction pour obtenir le libellé du statut en français
  const getStatusLabel = (status: string) => {
    switch (status) {
      case "paye":
        return "Payé";
      case "en_attente":
        return "En attente";
      case "annule":
        return "Annulé";
      case "rembourse":
        return "Remboursé";
      default:
        return status; // Retourner le statut tel quel si inconnu
    }
  };

  // Fonction pour formater une date en français
  const formatDate = (date: Date | string) => {
    try {
      return new Date(date).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch (error) {
      return "Date invalide"; // En cas d'erreur de formatage
    }
  };

  // Fonction pour obtenir les initiales d'un utilisateur
  const getInitials = (prenom: string, nom: string) => {
    return `${prenom?.charAt(0) || ''}${nom?.charAt(0) || ''}`.toUpperCase();
  };

  // Calcul du montant total des paiements effectués
  const totalAmount = payments
    .filter((payment) => payment.statut === "paye") // Filtrer les paiements payés
    .reduce((sum, payment) => sum + parseFloat(payment.montant as string), 0); // Somme des montants

  // Nombre de paiements en attente
  const pendingPayments = payments.filter((payment) => payment.statut === "en_attente").length;
  // Nombre total de paiements
  const totalPayments = payments.length;

  // Indicateur de chargement global
  const isLoading = paymentsLoading || eventsLoading || usersLoading;

  // Gestion des états de chargement et d'erreur
  if (isLoading) { // Affichage pendant le chargement
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Paiements</h1>
        <div className="text-center py-12 text-gray-500">Chargement des paiements...</div>
      </div>
    );
  }

  if (paymentsError) { // Affichage en cas d'erreur
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Paiements</h1>
        <div className="text-center py-12 text-red-500">
          <AlertCircle size={48} className="mx-auto mb-4" /> {/* Icône d'alerte */}
          <p>Erreur lors du chargement des paiements</p>
        </div>
      </div>
    );
  }

  // Rendu principal du composant
  return (
    <div className="space-y-6"> {/* Conteneur principal */}
      <div className="flex items-center justify-between"> {/* En-tête */}
        <h1 className="text-2xl font-bold text-gray-900">Paiements</h1> {/* Titre de la page */}
      </div>

      {/* Section des statistiques : grille de cartes avec métriques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Carte pour le total des revenus */}
        <Card className="border border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Total des revenus</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {totalAmount.toFixed(2)} DT {/* Affichage formaté du montant total */}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CreditCard className="text-green-600" size={24} /> {/* Icône de carte de crédit */}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Carte pour les paiements en attente */}
        <Card className="border border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Paiements en attente</p>
                <p className="text-3xl font-bold text-yellow-600 mt-1">
                  {pendingPayments} {/* Nombre de paiements en attente */}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Calendar className="text-yellow-600" size={24} /> {/* Icône de calendrier */}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Carte pour le total des paiements */}
        <Card className="border border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Total des paiements</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {totalPayments} {/* Nombre total de paiements */}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="text-blue-600" size={24} /> {/* Icône d'utilisateurs */}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section de la liste des paiements : grille de cartes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {payments.map((payment: any) => {
          const event = getEventDetails(payment.evenementId); // Récupération des détails de l'événement
          const user = getUserDetails(payment.membreId); // Récupération des détails de l'utilisateur

          if (!event || !user) return null; // Ne pas afficher si données manquantes

          return (
            <Card key={payment.id} className="border border-gray-200"> {/* Carte pour chaque paiement */}
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{event.titre}</CardTitle> {/* Titre de l'événement */}
                  <Badge className={getStatusColor(payment.statut)}> {/* Badge avec couleur selon statut */}
                    {getStatusLabel(payment.statut)} {/* Libellé du statut */}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Section avec avatar et informations utilisateur */}
                  <div className="flex items-center space-x-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary-100 text-primary-600 text-sm">
                        {getInitials(user.prenom, user.nom)} {/* Initiales de l'utilisateur */}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-gray-900">
                        {user.prenom} {user.nom} {/* Nom complet de l'utilisateur */}
                      </p>
                      <p className="text-sm text-gray-500">{user.email}</p> {/* Email de l'utilisateur */}
                    </div>
                  </div>

                  {/* Section montant */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Montant</span>
                    <span className="text-lg font-bold text-gray-900">
                      {parseFloat(payment.montant || 0).toFixed(2)} DT {/* Montant formaté */}
                    </span>
                  </div>

                  {/* Date de création */}
                  <div className="text-sm text-gray-500">
                    Créé le {formatDate(payment.dateCreation)} {/* Date formatée */}
                  </div>

                  {/* Date de paiement si elle existe */}
                  {payment.datePaiement && (
                    <div className="text-sm text-gray-500">
                      Payé le {formatDate(payment.datePaiement)} {/* Date de paiement formatée */}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Message si aucun paiement trouvé */}
      {payments.length === 0 && (
        <div className="text-center py-12">
          <CreditCard size={48} className="mx-auto text-gray-400 mb-4" /> {/* Icône de carte de crédit */}
          <p className="text-gray-500">Aucun paiement trouvé</p>
        </div>
      )}
    </div>
  );
}
