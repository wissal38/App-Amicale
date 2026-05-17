// Importation des hooks et bibliothèques nécessaires
import { useState } from "react"; // Hook pour gérer l'état local du composant
import { useQuery } from "@tanstack/react-query"; // Hook pour effectuer des requêtes de données
// Importation des composants UI pour les cartes et autres éléments
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatsCard from "@/components/ui/stats-card"; // Composant pour afficher les statistiques
import EventCard from "@/components/ui/event-card"; // Composant pour afficher un événement
import QuickActions from "@/components/ui/quick-actions"; // Composant pour les actions rapides
import MemberTable from "@/components/ui/member-table"; // Composant pour afficher la table des membres
// Importation des modales pour ajouter/éditer membres et événements
import MemberModal from "@/components/modals/MemberModal";
import EventModal from "@/components/modals/EventModal";
// Importation des icônes de Lucide React
import { Users, Calendar, UserCheck, TrendingUp } from "lucide-react";
// Importation des types depuis le schéma partagé
import { User, Event } from "@shared/schema";
// Importation du contexte d'authentification pour récupérer l'utilisateur connecté
import { useAuth } from "@/contexts/AuthContext";

// Composant principal du tableau de bord
export default function Dashboard() {
  // États locaux pour gérer l'ouverture des modales et le membre sélectionné
  const [memberModalOpen, setMemberModalOpen] = useState(false); // État pour la modale des membres
  const [eventModalOpen, setEventModalOpen] = useState(false); // État pour la modale des événements
  const [selectedMember, setSelectedMember] = useState<User | undefined>(); // Membre sélectionné pour édition

  // Récupération de l'utilisateur connecté depuis le contexte d'authentification
  const { user } = useAuth();

  // Définition du type pour les statistiques affichées sur le tableau de bord
  type Stats = {
    totalMembers: number; // Nombre total de membres
    totalEvents: number; // Nombre total d'événements
    totalParticipations: number; // Nombre total de participations
    totalRevenue: number; // Revenus totaux
    monthlyGrowth: { // Croissance mensuelle pour chaque métrique
      members: number; // Croissance des membres en pourcentage
      events: number; // Croissance des événements
      participations: number; // Croissance des participations
      revenue: number; // Croissance des revenus
    };
  };

  // Requête pour récupérer les statistiques depuis l'API
  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/stats"], // Clé unique pour cette requête
  });

  // Requête pour récupérer la liste des événements
  const { data: events } = useQuery<Event[]>({
    queryKey: ["/api/events"], // Clé unique pour cette requête
  });

  // Requête pour récupérer la liste des membres
  const { data: members } = useQuery<User[]>({
    queryKey: ["/api/users"], // Clé unique pour cette requête
  });

  // Extraction des événements et membres récents (3 premiers éléments)
  const recentEvents = events?.slice(0, 3) || []; // Événements récents pour affichage
  const recentMembers = members?.slice(0, 3) || []; // Membres récents pour affichage

  // Fonction pour éditer un membre existant : définit le membre sélectionné et ouvre la modale
  const handleEditMember = (member: User) => {
    setSelectedMember(member);
    setMemberModalOpen(true);
  };

  // Fonction pour créer un nouveau membre : réinitialise le membre sélectionné et ouvre la modale
  const handleNewMember = () => {
    setSelectedMember(undefined);
    setMemberModalOpen(true);
  };

  // Fonction pour fermer les modales : ferme toutes les modales et réinitialise le membre sélectionné
  const handleCloseModal = () => {
    setMemberModalOpen(false);
    setEventModalOpen(false);
    setSelectedMember(undefined);
  };

  // Rendu du composant : structure principale du tableau de bord
  return (
    <div className="space-y-8"> {/* Conteneur principal avec espacement vertical */}
      {/* Section des cartes de statistiques : visible pour tous, sauf revenus réservés aux admins */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"> {/* Grille responsive pour les stats */}
        {/* Carte pour le nombre total de membres */}
        <StatsCard
          title="Total Membres"
          value={stats?.totalMembers || 0}
          change={`+${stats?.monthlyGrowth?.members || 0}% ce mois`}
          changeType="positive"
          icon={Users}
          iconColor="bg-blue-100 text-blue-600"
        />
        {/* Carte pour le nombre d'événements */}
        <StatsCard
          title="Événements"
          value={stats?.totalEvents || 0}
          change={`${stats?.monthlyGrowth?.events || 0} ce mois`}
          changeType="neutral"
          icon={Calendar}
          iconColor="bg-purple-100 text-purple-600"
        />
        {/* Carte pour le nombre de participations */}
        <StatsCard
          title="Participations"
          value={stats?.totalParticipations || 0}
          change={`+${stats?.monthlyGrowth?.participations || 0}% ce mois`}
          changeType="positive"
          icon={UserCheck}
          iconColor="bg-green-100 text-green-600"
        />
        {/* Carte des revenus, visible uniquement pour les administrateurs */}
        {user?.role === 'admin' && (
          <StatsCard
            title="Revenus"
            value={`${stats?.totalRevenue?.toFixed(2) || "0.00"} DT`}
            change={`+${stats?.monthlyGrowth?.revenue || 0}% ce mois`}
            changeType="positive"
            icon={TrendingUp}
            iconColor="bg-yellow-100 text-yellow-600"
          />
        )}
      </div>

      {/* Section avec grille pour événements récents et actions rapides */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Carte pour afficher les événements récents */}
        <Card className="border border-gray-200">
          <CardHeader className="border-b border-gray-200">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-gray-900">
                Événements Récents
              </CardTitle>
              <button className="text-primary-600 hover:text-primary-700 font-medium text-sm">
                Voir tout
              </button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Affichage des événements récents ou message si aucun */}
              {recentEvents.length > 0 ? (
                recentEvents.map((event: Event) => (
                  <EventCard key={event.id} event={event} />
                ))
              ) : (
                <p className="text-gray-500 text-center py-8">
                  Aucun événement trouvé
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Actions rapides, visibles uniquement pour les administrateurs */}
        {user?.role === 'admin' && (
          <QuickActions
            onNewMember={handleNewMember}
            onNewEvent={() => setEventModalOpen(true)}
          />
        )}
      </div>

      {/* Table des membres récents */}
      <MemberTable
        members={recentMembers}
        onAddMember={handleNewMember}
        onEditMember={handleEditMember}
        isAdmin={user?.role === 'admin'}
      />

      {/* Modales pour ajouter/éditer membres et événements */}
      <MemberModal
        isOpen={memberModalOpen}
        onClose={handleCloseModal}
        member={selectedMember}
      />
      <EventModal
        isOpen={eventModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
}
