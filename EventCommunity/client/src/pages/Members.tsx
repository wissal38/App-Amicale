// Importation des hooks et bibliothèques nécessaires
import { useState } from "react"; // Hook pour gérer l'état local
import { useQuery } from "@tanstack/react-query"; // Hook pour les requêtes de données
// Importation des composants UI pour la table des membres et la modale
import MemberTable from "@/components/ui/member-table";
import MemberModal from "@/components/modals/MemberModal";
// Importation des types depuis le schéma partagé
import { User } from "@shared/schema";
// Importation du contexte d'authentification
import { useAuth } from "@/contexts/AuthContext";
// Importation de l'API pour les requêtes
import { api } from "@/lib/api";
// Importation des composants UI pour les inputs et boutons
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
// Importation des icônes Lucide React
import { PlusCircle, Search } from "lucide-react";

// Composant principal pour la page de gestion des membres
export default function Members() {
  // Récupération de l'utilisateur connecté
  const { user } = useAuth();
  // États locaux pour gérer la modale et le membre sélectionné
  const [isModalOpen, setIsModalOpen] = useState(false); // État d'ouverture de la modale
  const [selectedMember, setSelectedMember] = useState<User | undefined>(); // Membre sélectionné pour édition
  const [searchQuery, setSearchQuery] = useState(""); // Requête de recherche

  // Requête pour récupérer la liste des membres avec filtrage par recherche
  const { data: membersData, isLoading, error, refetch } = useQuery({
    queryKey: ["members", searchQuery], // Clé unique incluant la recherche pour le cache
    queryFn: () => 
      api.getUsers() // Récupération de tous les utilisateurs
        .then(members => {
          // Filtrage des membres en fonction de la requête de recherche
          if (!searchQuery) return members;
          
          const query = searchQuery.toLowerCase();
          return members.filter(member => 
            member.nom.toLowerCase().includes(query) ||
            member.prenom.toLowerCase().includes(query) ||
            member.email.toLowerCase().includes(query) ||
            member.telephone?.toLowerCase().includes(query) ||
            false
          );
        })
  });

  // Fonction pour éditer un membre existant
  const handleEditMember = (member: User) => {
    setSelectedMember(member);
    setIsModalOpen(true);
  };

  // Fonction pour créer un nouveau membre
  const handleNewMember = () => {
    setSelectedMember(undefined);
    setIsModalOpen(true);
  };

  // Fonction pour fermer la modale et rafraîchir les données
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedMember(undefined);
    refetch(); // Rafraîchir la liste des membres après modification
  };

  // Fonction pour gérer la soumission du formulaire de recherche
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // La recherche est gérée automatiquement par le useQuery via la dépendance searchQuery
  };

  // Restriction d'accès : seuls les administrateurs peuvent voir cette page
  if (user?.role !== "admin") {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Gestion des Membres
        </h1>
        <p className="text-gray-500">Accès réservé aux administrateurs.</p>
      </div>
    );
  }

  // Rendu du composant : interface de gestion des membres
  return (
    <div className="space-y-6"> {/* Conteneur principal avec espacement */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"> {/* En-tête avec titre et contrôles */}
        <h1 className="text-2xl font-bold text-gray-900">Gestion des Membres</h1> {/* Titre de la page */}
        <div className="flex gap-2"> {/* Controles de recherche et ajout */}
          <form onSubmit={handleSearch} className="flex gap-2"> {/* Formulaire de recherche */}
            <div className="relative"> {/* Conteneur relatif pour l'icône de recherche */}
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" /> {/* Icône de recherche */}
              <Input
                type="search"
                placeholder="Rechercher un membre..." // Placeholder pour la recherche
                className="pl-8 w-full md:w-[300px]" // Padding gauche pour l'icône
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)} // Mise à jour de la requête de recherche
              />
            </div>
            <Button type="submit" variant="outline"> {/* Bouton de recherche */}
              <Search className="h-4 w-4 mr-2" />
              Rechercher
            </Button>
          </form>
          <Button onClick={handleNewMember}> {/* Bouton pour ajouter un nouveau membre */}
            <PlusCircle className="h-4 w-4 mr-2" />
            Nouveau membre
          </Button>
        </div>
      </div>

      {/* Gestion des états de chargement et d'erreur */}
      {isLoading ? ( // Affichage du spinner de chargement
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : error ? ( // Affichage de l'erreur si elle existe
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Erreur lors du chargement des membres : {error.message}
        </div>
      ) : ( // Affichage du contenu principal si pas d'erreur
        <>
          <MemberTable // Table des membres
            members={membersData || []} // Liste des membres filtrés
            onAddMember={handleNewMember} // Fonction pour ajouter un membre
            onEditMember={handleEditMember} // Fonction pour éditer un membre
            isAdmin={user?.role === 'admin'} // Indicateur si l'utilisateur est admin
          />
          
          <MemberModal // Modale pour ajouter/éditer un membre
            isOpen={isModalOpen} // État d'ouverture
            onClose={handleCloseModal} // Fonction de fermeture
            member={selectedMember} // Membre à éditer (undefined pour nouveau)
          />
        </>
      )}
    </div>
  );
}
