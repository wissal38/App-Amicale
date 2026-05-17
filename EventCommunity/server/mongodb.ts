// Importation des modules nécessaires
// Mongoose pour l'interaction avec MongoDB
import mongoose from 'mongoose';
// bcryptjs pour le hachage des mots de passe
import * as bcrypt from 'bcryptjs';

// Configuration de la base de données MongoDB
// URI de connexion MongoDB, utilise une variable d'environnement ou une valeur par défaut
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/applicationamicale';

// Désactiver strictPopulate pour éviter les erreurs en Mongoose 7+ lorsqu'aucun populate n'est nécessaire
// Utile en développement si des chemins non référencés sont passés par erreur à populate
mongoose.set('strictPopulate', false);

// Configuration des options de connexion à MongoDB
const mongoOptions: mongoose.ConnectOptions = {
  autoIndex: true, // Construire les index automatiquement
  maxPoolSize: 10, // Maintenir jusqu'à 10 connexions socket
  serverSelectionTimeoutMS: 5000, // Continuer à essayer d'envoyer des opérations pendant 5 secondes
  socketTimeoutMS: 45000, // Fermer les sockets après 45 secondes d'inactivité
  family: 4, // Utiliser IPv4, ignorer IPv6
  retryWrites: true, // Réessayer les écritures en cas d'échec
  w: 'majority' // Attendre la majorité des réplicas pour les écritures
};

// Définition du schéma pour les utilisateurs (User)
// Ce schéma définit la structure des documents utilisateur dans la collection MongoDB
const userSchema = new mongoose.Schema({
  id: { type: Number, unique: true, index: true }, // Identifiant numérique unique et indexé
  nom: { type: String, required: true }, // Nom de l'utilisateur, obligatoire
  prenom: { type: String, required: true }, // Prénom de l'utilisateur, obligatoire
  email: { type: String, required: true, unique: true }, // Email unique et obligatoire
  motDePasse: { type: String, required: true }, // Mot de passe haché, obligatoire
  role: { type: String, enum: ['admin', 'membre'], default: 'membre' }, // Rôle : admin ou membre, défaut membre
  statut: { type: String, enum: ['actif', 'inactif'], default: 'actif' }, // Statut : actif ou inactif, défaut actif
  dateInscription: { type: Date, default: Date.now }, // Date d'inscription, par défaut la date actuelle
  telephone: { type: String, default: null } // Numéro de téléphone, optionnel
});

// Hook pre-save pour auto-incrémenter l'ID numérique de l'utilisateur
// Avant de sauvegarder un nouvel utilisateur, si l'ID n'est pas défini, on trouve le dernier ID et on l'incrémente
userSchema.pre('save', async function (next) {
  if (this.isNew && (this.id === undefined || this.id === null)) {
    const last = await mongoose.model('User').findOne({}, {}, { sort: { id: -1 } });
    this.id = last && last.id ? last.id + 1 : 1;
  }
  next();
});

// Définition du schéma pour les événements (Event)
// Ce schéma définit la structure des documents événement dans la collection MongoDB
const eventSchema = new mongoose.Schema({
  id: { type: Number, unique: true, index: true }, // Identifiant numérique unique et indexé
  titre: { type: String, required: true }, // Titre de l'événement, obligatoire
  description: { type: String, required: true }, // Description de l'événement, obligatoire
  date: { type: Date, required: true }, // Date unifiée de l'événement, obligatoire
  dateDebut: { type: Date, required: true }, // Date de début pour rétrocompatibilité, obligatoire
  dateFin: { type: Date }, // Date de fin optionnelle pour rétrocompatibilité
  lieu: { type: String, required: true }, // Lieu de l'événement, obligatoire
  placesDisponibles: { type: Number, required: true, min: 0 }, // Places disponibles, obligatoire, minimum 0
  placesMax: { type: Number, required: true, min: 0 }, // Nombre maximum de places pour rétrocompatibilité, obligatoire
  // Nouveau champ : nombre maximum de places qu'un membre peut réserver, optionnel, défaut 1
  placesParMembre: { type: Number, required: false, min: 1, default: 1 },
  prix: { type: Number, required: true, min: 0 }, // Prix de l'événement, obligatoire, minimum 0
  estPayant: { type: Boolean, required: true, default: false }, // Indique si l'événement est payant, défaut false
  imageUrl: { type: String }, // URL de l'image de l'événement, optionnel
  statut: { 
    type: String, 
    enum: ['actif', 'inactif', 'planifie', 'en_cours', 'annulé'], 
    default: 'planifie' 
  }, // Statut de l'événement, valeurs énumérées, défaut 'planifie'
  participants: [{ // Liste des participants
    id: { type: Number, required: true }, // ID du participant
    nom: { type: String, required: true }, // Nom du participant
    prenom: { type: String, required: true }, // Prénom du participant
    email: { type: String, required: true }, // Email du participant
    nombrePlaces: { type: Number, required: true, min: 1 } // Nombre de places réservées
  }],
  dateCreation: { type: Date, default: Date.now }, // Date de création, par défaut actuelle
  dateMiseAJour: { type: Date, default: Date.now } // Date de mise à jour, par défaut actuelle
});

// Hook pre-save pour auto-incrémenter l'ID numérique de l'événement
// Avant de sauvegarder un nouvel événement, si l'ID n'est pas défini, on trouve le dernier ID et on l'incrémente
eventSchema.pre('save', async function (next) {
  if (this.isNew && (this.id === undefined || this.id === null)) {
    const last = await mongoose.model('Event').findOne({}, {}, { sort: { id: -1 } });
    this.id = last && last.id ? last.id + 1 : 1;
  }
  next();
});

// Définition du schéma pour les participations (Participation)
// Ce schéma définit la structure des documents participation dans la collection MongoDB
const participationSchema = new mongoose.Schema({
  id: { type: Number, unique: true, index: true }, // Identifiant numérique unique et indexé
  membreId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Référence à l'utilisateur, obligatoire
  evenementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true }, // Référence à l'événement, obligatoire
  // Retrait de la contrainte max rigide ; le plafond est désormais géré par la logique métier (placesParMembre)
  nombrePlaces: { type: Number, required: true, default: 1, min: 1 }, // Nombre de places réservées, obligatoire, minimum 1
  montantTotal: { type: Number, required: true, default: 0 }, // Montant total à payer, obligatoire, défaut 0
  estPaye: { type: Boolean, required: true, default: false }, // Indique si le paiement est effectué, défaut false
  modePaiement: { type: String, enum: ['sur_place', 'carte'], default: 'sur_place', required: true }, // Mode de paiement, énuméré
  numeroCarte: { type: String, required: false }, // Numéro de carte, optionnel
  // Utiliser des valeurs non accentuées pour correspondre au schéma partagé (shared/schema.ts)
  // et aux payloads envoyés par le frontend: 'confirme' | 'en_attente' | 'annule'
  statut: { type: String, enum: ['confirme', 'en_attente', 'annule'], default: 'confirme' }, // Statut de la participation
  dateInscription: { type: Date, default: Date.now } // Date d'inscription, par défaut actuelle
});

// Hook pre-save pour auto-incrémenter l'ID numérique de la participation
// Avant de sauvegarder une nouvelle participation, si l'ID n'est pas défini, on trouve le dernier ID et on l'incrémente
participationSchema.pre('save', async function (next) {
  if (this.isNew && (this.id === undefined || this.id === null)) {
    const last = await Participation.findOne({}, {}, { sort: { id: -1 } });
    this.id = last && last.id ? last.id + 1 : 1;
  }
  next();
});

// Définition du schéma pour les paiements (Payment)
// Ce schéma définit la structure des documents paiement dans la collection MongoDB
// Aligné avec shared/schema.ts :: InsertPayment
// Utilise des IDs numériques pour cohérence avec le reste de l'application
const paymentSchema = new mongoose.Schema({
  membreId: { type: Number, required: true }, // ID du membre effectuant le paiement, obligatoire
  evenementId: { type: Number, required: true }, // ID de l'événement concerné, obligatoire
  montant: { type: Number, required: true }, // Montant du paiement, obligatoire
  // Méthode de paiement : 'carte' | 'especes' | 'virement'
  methode: { type: String, enum: ['carte', 'especes', 'virement'], required: true }, // Méthode de paiement, énumérée, obligatoire
  // Statut : 'en_attente' | 'paye' | 'annule' | 'rembourse'
  statut: { type: String, enum: ['en_attente', 'paye', 'annule', 'rembourse'], default: 'en_attente' }, // Statut du paiement, défaut 'en_attente'
  reference: { type: String, required: true }, // Référence unique du paiement, obligatoire
  dateCreation: { type: Date, default: Date.now }, // Date de création, par défaut actuelle
  datePaiement: { type: Date, default: null } // Date du paiement, optionnel
});

// Définition du schéma pour les notifications (Notification)
// Ce schéma définit la structure des documents notification dans la collection MongoDB
const notificationSchema = new mongoose.Schema({
  id: { type: Number, unique: true, index: true }, // Identifiant numérique unique et indexé
  utilisateurId: { type: Number, required: true }, // ID de l'utilisateur destinataire, obligatoire
  titre: { type: String, required: true }, // Titre de la notification, obligatoire
  message: { type: String, required: true }, // Message de la notification, obligatoire
  lue: { type: Boolean, default: false }, // Indique si la notification a été lue, défaut false
  lien: { type: String }, // Lien optionnel associé à la notification
  dateCreation: { type: Date, default: Date.now }, // Date de création, par défaut actuelle
  dateMiseAJour: { type: Date, default: Date.now } // Date de mise à jour, par défaut actuelle
});

// Hook pre-save pour auto-incrémenter l'ID numérique de la notification
// Avant de sauvegarder une nouvelle notification, si l'ID n'est pas défini, on trouve le dernier ID et on l'incrémente
notificationSchema.pre('save', async function (next) {
  if (this.isNew && (this.id === undefined || this.id === null)) {
    const last = await mongoose.model('Notification').findOne({}, {}, { sort: { id: -1 } });
    this.id = last && last.id ? last.id + 1 : 1;
  }
  next();
});

// Création et exportation des modèles Mongoose basés sur les schémas définis
// Ces modèles permettent d'interagir avec les collections MongoDB correspondantes
export const User = mongoose.model('User', userSchema); // Modèle pour les utilisateurs
export const Event = mongoose.model('Event', eventSchema); // Modèle pour les événements
export const Participation = mongoose.model('Participation', participationSchema); // Modèle pour les participations
export const Payment = mongoose.model('Payment', paymentSchema); // Modèle pour les paiements
export const Notification = mongoose.model('Notification', notificationSchema); // Modèle pour les notifications

// Fonction pour établir la connexion à MongoDB
// Cette fonction configure les gestionnaires d'événements et tente de se connecter à la base de données
export async function connectMongoDB() {
  // Gestionnaire d'erreur de connexion : affiche l'erreur en console
  mongoose.connection.on('error', (err) => {
    console.error('Erreur de connexion MongoDB:', err);
  });

  // Gestionnaire de déconnexion : affiche un message de déconnexion
  mongoose.connection.on('disconnected', () => {
    console.log('Déconnecté de MongoDB');
  });

  try {
    // Tentative de connexion à MongoDB avec les options configurées
    console.log('Tentative de connexion à MongoDB...');
    await mongoose.connect(MONGODB_URI, mongoOptions);
    
    console.log('✅ Connexion à MongoDB réussie');
    
    // Création d'un utilisateur admin par défaut s'il n'existe pas déjà
    try {
      // Vérifier si un admin existe déjà
      const adminExists = await User.findOne({ email: 'admin@amicale.com' });
      if (!adminExists) {
        // Hacher le mot de passe par défaut
        const hashedPassword = await bcrypt.hash('admin123', 10);
        // Créer l'utilisateur admin
        await User.create({
          nom: 'Admin',
          prenom: 'User',
          email: 'admin@amicale.com',
          motDePasse: hashedPassword,
          role: 'admin',
          statut: 'actif',
          dateInscription: new Date(),
          telephone: '0123456789'
        });
        console.log('✅ Utilisateur admin créé avec succès');
      } else {
        console.log('ℹ️  Utilisateur admin existe déjà');
      }
    } catch (userError) {
      // En cas d'erreur lors de la création de l'admin, afficher l'erreur mais ne pas arrêter le serveur
      console.error('Erreur lors de la création de l\'utilisateur admin:', userError);
    }
    
    // Retourner la connexion Mongoose
    return mongoose.connection;
  } catch (error) {
    // En cas d'échec de connexion, afficher l'erreur et arrêter l'application
    console.error('❌ Erreur de connexion à MongoDB:', error);
    process.exit(1);
  }
}

// Fermer la connexion
export async function closeMongoDB() {
  await mongoose.connection.close();
  console.log('Connexion à MongoDB fermée');
}