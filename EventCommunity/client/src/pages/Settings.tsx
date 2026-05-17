// Importation des hooks et bibliothèques nécessaires
import { useState } from "react"; // Hook pour gérer l'état local
import { useAuth } from "@/contexts/AuthContext"; // Contexte d'authentification
// Importation des composants UI pour les cartes, boutons, inputs, etc.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch"; // Composant pour les interrupteurs
import { Separator } from "@/components/ui/separator"; // Séparateur visuel
import { Badge } from "@/components/ui/badge"; // Badge pour afficher le statut
import { useForm } from "react-hook-form"; // Hook pour gérer les formulaires
import { zodResolver } from "@hookform/resolvers/zod"; // Résolveur pour la validation Zod
import { z } from "zod"; // Bibliothèque de validation
import { useToast } from "@/hooks/use-toast"; // Hook pour afficher des notifications
// Importation des icônes Lucide React
import { 
  Settings as SettingsIcon, 
  User, 
  Bell, 
  Shield, 
  Download,
  Upload,
  Trash2,
  Save
} from "lucide-react";

// Schéma de validation pour le formulaire de profil
const profileSchema = z.object({
  nom: z.string().min(1, "Le nom est requis"), // Nom obligatoire
  prenom: z.string().min(1, "Le prénom est requis"), // Prénom obligatoire
  email: z.string().email("Email invalide"), // Email avec validation
  telephone: z.string().optional(), // Téléphone optionnel
});

// Type déduit du schéma pour les données du formulaire
type ProfileFormData = z.infer<typeof profileSchema>;

// Composant principal pour la page des paramètres
export default function Settings() {
  // Récupération de l'utilisateur connecté
  const { user } = useAuth();
  // Hook pour afficher des notifications
  const { toast } = useToast();
  // États pour les paramètres de notifications
  const [emailNotifications, setEmailNotifications] = useState(true); // Notifications par email
  const [pushNotifications, setPushNotifications] = useState(true); // Notifications push
  const [eventReminders, setEventReminders] = useState(true); // Rappels d'événements
  const [paymentAlerts, setPaymentAlerts] = useState(true); // Alertes de paiement

  // Configuration du formulaire de profil avec validation
  const {
    register, // Fonction pour enregistrer les champs
    handleSubmit, // Fonction pour gérer la soumission
    formState: { errors }, // Erreurs de validation
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema), // Utilise le schéma pour la validation
    defaultValues: {
      nom: user?.nom || "", // Valeur par défaut depuis l'utilisateur
      prenom: user?.prenom || "",
      email: user?.email || "",
      telephone: user?.telephone || "",
    },
  });

  // Fonction appelée lors de la soumission du formulaire de profil
  const onSubmitProfile = (data: ProfileFormData) => {
    // Simulation d'un appel API (à remplacer par un vrai appel)
    toast({
      title: "Profil mis à jour",
      description: "Vos informations ont été mises à jour avec succès",
    });
  };

  // Fonction pour exporter les données
  const handleExportData = () => {
    toast({
      title: "Export en cours",
      description: "Vos données sont en cours d'export",
    });
  };

  // Fonction pour importer les données
  const handleImportData = () => {
    toast({
      title: "Import en cours",
      description: "Import des données en cours de traitement",
    });
  };

  // Fonction pour supprimer le compte
  const handleDeleteAccount = () => {
    toast({
      title: "Suppression de compte",
      description: "Cette fonctionnalité n'est pas encore disponible",
      variant: "destructive",
    });
  };

  // Rendu du composant : interface des paramètres
  return (
    <div className="space-y-6"> {/* Conteneur principal avec espacement */}
      <div className="flex items-center space-x-3"> {/* En-tête avec icône et titre */}
        <SettingsIcon size={32} className="text-gray-700" /> {/* Icône des paramètres */}
        <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1> {/* Titre de la page */}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"> {/* Grille responsive pour les cartes */}
        {/* Carte des informations personnelles */}
        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User size={20} /> {/* Icône utilisateur */}
              <span>Informations personnelles</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmitProfile)} className="space-y-4"> {/* Formulaire de profil */}
              <div className="grid grid-cols-2 gap-4"> {/* Grille pour prénom et nom */}
                <div>
                  <Label htmlFor="prenom">Prénom</Label>
                  <div>
                    <Input
                      id="prenom"
                      {...register("prenom")} // Enregistrement du champ avec validation
                      className={errors.prenom ? 'border-red-500' : ''} // Bordure rouge en cas d'erreur
                    />
                    {errors.prenom && ( // Affichage de l'erreur si elle existe
                      <p className="mt-1 text-sm text-red-500">{errors.prenom.message}</p>
                    )}
                  </div>
                </div>
                <div>
                  <Label htmlFor="nom">Nom</Label>
                  <div>
                    <Input
                      id="nom"
                      {...register("nom")}
                      className={errors.nom ? 'border-red-500' : ''}
                    />
                    {errors.nom && (
                      <p className="mt-1 text-sm text-red-500">{errors.nom.message}</p>
                    )}
                  </div>
                </div>
              </div>

              <div> {/* Champ email */}
                <Label htmlFor="email">Email</Label>
                <div>
                  <Input
                    id="email"
                    type="email"
                    {...register("email")}
                    className={errors.email ? 'border-red-500' : ''}
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
                  )}
                </div>
              </div>

              <div> {/* Champ téléphone */}
                <Label htmlFor="telephone">Téléphone</Label>
                <div>
                  <Input
                    id="telephone"
                    {...register("telephone")}
                    className={errors.telephone ? 'border-red-500' : ''}
                  />
                  {errors.telephone && (
                    <p className="mt-1 text-sm text-red-500">{errors.telephone.message}</p>
                  )}
                </div>
              </div>

              {/* Badges affichant le rôle et le statut de l'utilisateur */}
              <div className="flex items-center space-x-2">
                <Badge variant="secondary" className="capitalize">
                  {user?.role} {/* Rôle de l'utilisateur */}
                </Badge>
                <Badge className={user?.statut === "actif" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}>
                  {user?.statut === "actif" ? "Actif" : "Inactif"} {/* Statut de l'utilisateur */}
                </Badge>
              </div>

              <Button type="submit" className="w-full"> {/* Bouton de soumission */}
                <Save size={16} className="mr-2" />
                Sauvegarder les modifications
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Carte des paramètres de notifications */}
        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bell size={20} /> {/* Icône cloche */}
              <span>Notifications</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Interrupteur pour les notifications par email */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Notifications par email</p>
                <p className="text-sm text-gray-500">
                  Recevoir les notifications par email
                </p>
              </div>
              <Switch
                checked={emailNotifications}
                onCheckedChange={setEmailNotifications}
              />
            </div>

            <Separator /> {/* Séparateur visuel */}

            {/* Interrupteur pour les notifications push */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Notifications push</p>
                <p className="text-sm text-gray-500">
                  Recevoir les notifications sur l'application
                </p>
              </div>
              <Switch
                checked={pushNotifications}
                onCheckedChange={setPushNotifications}
              />
            </div>

            <Separator />

            {/* Interrupteur pour les rappels d'événements */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Rappels d'événements</p>
                <p className="text-sm text-gray-500">
                  Être notifié avant les événements
                </p>
              </div>
              <Switch
                checked={eventReminders}
                onCheckedChange={setEventReminders}
              />
            </div>

            <Separator />

            {/* Interrupteur pour les alertes de paiement */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Alertes de paiement</p>
                <p className="text-sm text-gray-500">
                  Notifications pour les paiements
                </p>
              </div>
              <Switch
                checked={paymentAlerts}
                onCheckedChange={setPaymentAlerts}
              />
            </div>
          </CardContent>
        </Card>

        {/* Carte des paramètres de sécurité */}
        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield size={20} /> {/* Icône bouclier */}
              <span>Sécurité</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div> {/* Champ mot de passe actuel */}
              <Label htmlFor="currentPassword">Mot de passe actuel</Label>
              <Input id="currentPassword" type="password" />
            </div>

            <div> {/* Champ nouveau mot de passe */}
              <Label htmlFor="newPassword">Nouveau mot de passe</Label>
              <Input id="newPassword" type="password" />
            </div>

            <div> {/* Champ confirmation mot de passe */}
              <Label htmlFor="confirmPassword">Confirmer le nouveau mot de passe</Label>
              <Input id="confirmPassword" type="password" />
            </div>

            <Button className="w-full" variant="outline"> {/* Bouton changement mot de passe */}
              <Shield size={16} className="mr-2" />
              Changer le mot de passe
            </Button>
          </CardContent>
        </Card>

        {/* Section gestion des données (commentée dans le code original) */}
        
      </div>

   
      
    </div>
  );
}
