// Importation de Zod pour la validation des schémas
import { z } from "zod";

// Schémas Zod pour la validation des données

// Schéma pour la connexion utilisateur
export const loginSchema = z.object({
  email: z.string().email("Email invalide"), // Validation de l'email avec message d'erreur en français
  motDePasse: z.string().min(1, "Le mot de passe est requis") // Mot de passe requis, au moins 1 caractère
});

// Schéma pour l'inscription d'un nouvel utilisateur
export const registerSchema = z.object({
  nom: z.string().min(1, "Le nom est requis"), // Nom obligatoire
  prenom: z.string().min(1, "Le prénom est requis"), // Prénom obligatoire
  email: z.string().email("Email invalide"), // Email valide requis
  motDePasse: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"), // Mot de passe d'au moins 6 caractères
  confirmPassword: z.string().min(1, "La confirmation du mot de passe est requise"), // Confirmation du mot de passe requise
  telephone: z.string().optional() // Téléphone optionnel
}).refine((data) => data.motDePasse === data.confirmPassword, { // Vérification que les mots de passe correspondent
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"] // Erreur associée au champ confirmPassword
});

// Schéma de base pour le prix : accepter virgule décimale (ex: "8,56"), convertir en nombre et limiter à 2 décimales
const prixSchema = z.preprocess((val) => { // Prétraitement pour normaliser les valeurs de prix
  if (typeof val === 'string') {
    const normalized = val.replace(',', '.').trim(); // Remplacer la virgule par un point et supprimer les espaces
    const num = parseFloat(normalized); // Convertir en nombre flottant
    return Number.isFinite(num) ? num : val; // Retourner le nombre si valide, sinon la valeur originale
  }
  return val; // Retourner la valeur telle quelle si ce n'est pas une chaîne
},
z.number() // Schéma final : doit être un nombre
);

// Schéma pour l'insertion d'un événement
export const insertEventSchema = z.object({
  titre: z.string().min(1, "Le titre est requis").max(100, "Le titre ne doit pas dépasser 100 caractères"), // Titre obligatoire, limité à 100 caractères
  description: z.string().max(2000, "La description ne doit pas dépasser 2000 caractères").optional().default(''), // Description optionnelle, max 2000 caractères, défaut vide
  date: z.string().min(1, "La date est requise"), // Date obligatoire
  dateDebut: z.string().optional(), // Date de début optionnelle pour rétrocompatibilité
  dateFin: z.string().optional(), // Date de fin optionnelle pour rétrocompatibilité
  lieu: z.string().max(200, "Le lieu ne doit pas dépasser 200 caractères").optional().default('À définir'), // Lieu optionnel, max 200 caractères, défaut "À définir"
  placesDisponibles: z.number() // Nombre de places disponibles
    .int("Le nombre de places doit être un entier") // Doit être un entier
    .min(1, "Le nombre de places doit être d'au moins 1") // Minimum 1
    .max(1000, "Le nombre de places ne peut pas dépasser 1000") // Maximum 1000
    .optional() // Optionnel
    .default(10), // Défaut 10
  placesMax: z.number() // Nombre maximum de places
    .int("Le nombre maximum de places doit être un entier") // Doit être un entier
    .min(1, "Le nombre maximum de places doit être d'au moins 1") // Minimum 1
    .max(1000, "Le nombre maximum de places ne peut pas dépasser 1000") // Maximum 1000
    .optional(), // Optionnel
  placesParMembre: z.number() // Nombre de places par membre
    .int("Le nombre de places par membre doit être un entier") // Doit être un entier
    .min(1, "Le nombre de places par membre doit être au moins 1") // Minimum 1
    .max(50, "Le nombre de places par membre ne peut pas dépasser 50") // Maximum 50
    .optional() // Optionnel
    .default(1), // Défaut 1
  prix: prixSchema.optional().default(0), // Prix optionnel, utilisant le schéma prix, défaut 0
  estPayant: z.boolean().default(false), // Indicateur si l'événement est payant, défaut false
  imageUrl: z.string() // URL de l'image
    .url("L'URL de l'image n'est pas valide") // Doit être une URL valide
    .startsWith('http', { message: "L'URL doit commencer par http:// ou https://" }) // Doit commencer par http
    .optional() // Optionnel
    .or(z.literal('')), // Ou chaîne vide
  statut: z.enum(['actif', 'inactif', 'planifie', 'en_cours', 'annulé']).default('planifie') // Statut de l'événement, valeurs énumérées, défaut 'planifie'
}).refine(data => { // Validation croisée pour s'assurer que placesDisponibles <= placesMax
  // S'assurer que placesDisponibles n'est pas supérieur à placesMax si ce dernier est défini et valide
  if (typeof data.placesMax === 'number' && typeof data.placesDisponibles === 'number') {
    return data.placesDisponibles <= data.placesMax; // Retourner true si valide
  }
  return true; // Sinon, considérer comme valide
}, {
  message: "Le nombre de places disponibles ne peut pas être supérieur au nombre maximum de places", // Message d'erreur
  path: ["placesDisponibles"] // Erreur associée au champ placesDisponibles
});

// Schéma pour l'insertion d'une participation
export const insertParticipationSchema = z.object({
  membreId: z.number(), // ID du membre
  evenementId: z.number(), // ID de l'événement
  nombrePlaces: z.number().min(1, "Le nombre de places doit être au moins 1"), // Nombre de places, minimum 1
  montantTotal: z.number().min(0, "Le montant total doit être positif"), // Montant total positif
  methodePaiement: z.enum(['carte', 'sur_place']).optional(), // Méthode de paiement optionnelle
  numeroCarte: z.string().optional(), // Numéro de carte optionnel
  estPaye: z.boolean() // Indicateur si payé
});

// Schéma pour l'insertion d'un paiement
export const insertPaymentSchema = z.object({
  membreId: z.number(), // ID du membre
  evenementId: z.number(), // ID de l'événement
  montant: z.number().min(0, "Le montant doit être positif"), // Montant positif
  datePaiement: z.string().min(1, "La date de paiement est requise"), // Date de paiement requise
  methode: z.enum(['carte', 'especes', 'virement']), // Méthode de paiement énumérée
  statut: z.enum(['en_attente', 'paye', 'annule', 'rembourse']), // Statut du paiement énuméré
  reference: z.string().min(1, "La référence est requise") // Référence requise
});

// Schéma pour l'insertion d'une notification
export const insertNotificationSchema = z.object({
  utilisateurId: z.number(), // ID de l'utilisateur
  titre: z.string().min(1, "Le titre est requis"), // Titre requis
  message: z.string().min(1, "Le message est requis"), // Message requis
  lien: z.string().optional(),
  lue: z.boolean().optional()
});

// Types pour les événements
export interface Event {
  id: number;
  titre: string;
  description: string;
  date: string;
  dateDebut?: string;  // Ajouté pour la compatibilité
  dateFin?: string;    // Ajouté pour la compatibilité
  lieu: string;
  placesDisponibles: number;
  placesMax?: number;  // Ajouté pour la compatibilité
  placesParMembre?: number;
  prix: number;
  estPayant: boolean;
  imageUrl?: string;
  participants?: Array<{
    id: number;
    nom: string;
    prenom: string;
    email: string;
  }>;  // Ajouté pour la compatibilité
  createdAt: string;
  updatedAt: string;
}

export interface InsertEvent {
  titre: string;
  description: string;
  date: string;
  dateFin?: string;
  lieu: string;
  placesDisponibles: number;
  placesMax?: number;
  placesParMembre?: number;
  prix: number;
  estPayant: boolean;
  imageUrl?: string;
  statut?: 'actif' | 'inactif' | 'planifie' | 'en_cours' | 'annulé';
}

// Types pour les participations
export interface Participation {
  id: number;
  membreId: number;
  evenementId: number;
  dateInscription: string;
  statut: 'en_attente' | 'confirme' | 'annule';
  nombrePlaces: number;
  montantTotal: number;
  methodePaiement?: 'carte' | 'sur_place';
  modePaiement?: 'carte' | 'sur_place'; // Alias pour compatibilité
  numeroCarte?: string;
  numeroTransaction?: string; // Ajouté pour la compatibilité
  estPaye: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InsertParticipation {
  membreId: number;
  evenementId: number;
  nombrePlaces: number;
  montantTotal: number;
  methodePaiement?: 'carte' | 'sur_place';
  numeroCarte?: string;
  estPaye: boolean;
}

// Types pour les utilisateurs
export interface User {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  motDePasse: string;
  role: 'admin' | 'membre';
  statut: 'actif' | 'inactif';
  dateInscription: string;
  telephone?: string;
  adresse?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InsertUser {
  nom: string;
  prenom: string;
  email: string;
  motDePasse: string;
  role: 'admin' | 'membre';
  telephone?: string;
  adresse?: string;
}

// Types pour les paiements
export interface Payment {
  id: number;
  membreId: number;
  evenementId: number;
  montant: number;
  datePaiement: string;
  methode: 'carte' | 'especes' | 'virement';
  statut: 'en_attente' | 'paye' | 'annule' | 'rembourse';
  reference: string;
  createdAt: string;
  updatedAt: string;
}

export interface InsertPayment {
  membreId: number;
  evenementId: number;
  montant: number;
  methode: 'carte' | 'especes' | 'virement';
  statut: 'en_attente' | 'paye' | 'annule' | 'rembourse';
  reference: string;
}

// Types pour les notifications
export interface Notification {
  id: number;
  utilisateurId: number;
  titre: string;
  message: string;
  lue: boolean;
  lien?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InsertNotification {
  utilisateurId: number;
  titre: string;
  message: string;
  lien?: string;
  lue?: boolean;
}
