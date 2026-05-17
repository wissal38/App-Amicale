import { IStorage } from './storage';
import { User as UserModel, Event as EventModel, Participation as ParticipationModel, Payment as PaymentModel, Notification as NotificationModel } from './mongodb';
import { User, InsertUser, Event, InsertEvent, Participation, InsertParticipation, Payment, InsertPayment, Notification, InsertNotification } from '../shared/schema';
import * as bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

export class MongoStorage implements IStorage {
  
  // Participation methods - Implementation principale
  async createParticipation(insertParticipation: InsertParticipation): Promise<Participation> {
    try {
      console.log('[MongoStorage] createParticipation called with:', JSON.stringify(insertParticipation));
      
      // Convert numeric IDs to MongoDB ObjectIds
      const membreObjectId = await this.findUserObjectIdFromNumericId(insertParticipation.membreId);
      const evenementObjectId = await this.findEventObjectIdFromNumericId(insertParticipation.evenementId);
      
      if (!membreObjectId) {
        throw new Error(`Utilisateur avec l'ID ${insertParticipation.membreId} non trouvé`);
      }
      
      if (!evenementObjectId) {
        throw new Error(`Événement avec l'ID ${insertParticipation.evenementId} non trouvé`);
      }
      
      // Vérifier si l'utilisateur est déjà inscrit à cet événement
      const existingParticipation = await ParticipationModel.findOne({
        membreId: membreObjectId,
        evenementId: evenementObjectId
      });
      
      if (existingParticipation) {
        throw new Error('Vous êtes déjà inscrit à cet événement');
      }

      // Vérifier les places disponibles
      const event = await EventModel.findById(evenementObjectId);
      if (!event) {
        throw new Error('Événement non trouvé lors de la vérification des places disponibles');
      }

      // Récupérer toutes les participations pour cet événement
      const participations = await ParticipationModel.find({
        evenementId: evenementObjectId
      });

      // Calculer le nombre total de places déjà réservées
      const placesReservees = participations.reduce(
        (total, p) => total + (Number(p.nombrePlaces) || 1), 0
      );

      // Enforcer la limite par membre si définie
      const perMemberLimit = Math.max(1, Number((event as any).placesParMembre) || 1);
      const memberAlreadyReserved = participations
        .filter(p => String(p.membreId) === String(membreObjectId))
        .reduce((sum, p) => sum + (Number(p.nombrePlaces) || 1), 0);
      const requested = insertParticipation.nombrePlaces || 1;
      if (memberAlreadyReserved + requested > perMemberLimit) {
        const remaining = Math.max(0, perMemberLimit - memberAlreadyReserved);
        throw new Error(`Limite par membre atteinte. Vous pouvez réserver au maximum ${perMemberLimit} place(s) pour cet événement. Places restantes pour vous: ${remaining}.`);
      }

      // Choisir la capacité totale depuis placesDisponibles (prioritaire) sinon placesMax
      const capaciteTotale = (typeof (event as any).placesDisponibles === 'number' && (event as any).placesDisponibles > 0)
        ? (event as any).placesDisponibles
        : (typeof (event as any).placesMax === 'number' ? (event as any).placesMax : 0);

      if (capaciteTotale > 0) {
        const restantes = Math.max(0, capaciteTotale - placesReservees);
        if (restantes < (insertParticipation.nombrePlaces || 1)) {
          throw new Error(`Nombre de places insuffisant. Il reste ${restantes} place(s) disponible(s).`);
        }
      }
      
      // Créer une nouvelle participation
      const newParticipation = new ParticipationModel({
        membre: membreObjectId,
        evenement: evenementObjectId,
        membreId: membreObjectId,
        evenementId: evenementObjectId,
        nombrePlaces: insertParticipation.nombrePlaces || 1,
        montantTotal: insertParticipation.montantTotal || 0,
        // Mapper correctement les champs de paiement
        methodePaiement: insertParticipation.methodePaiement as any,
        modePaiement: insertParticipation.methodePaiement as any,
        numeroCarte: insertParticipation.numeroCarte || undefined,
        estPaye: insertParticipation.estPaye || false,
        dateInscription: new Date(),
        // Schéma partagé attend 'confirme' sans accent
        statut: 'confirme'
      });
      
      const savedParticipation = await newParticipation.save();
      
      // Mettre à jour les participants de l'événement
      await EventModel.findByIdAndUpdate(
        evenementObjectId,
        { $addToSet: { participants: membreObjectId } },
        { new: true }
      );
      
      // Convertir au schéma partagé et retourner
      return this.convertMongoParticipation(savedParticipation);
      
    } catch (error: unknown) {
      console.error('[MongoStorage] Error in createParticipation:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Erreur inconnue lors de la création de la participation');
    }
  }

  /**
   * Convert a MongoDB participation document to the shared Participation schema
   */
  private async convertMongoParticipation(doc: any): Promise<Participation> {
    try {
      if (!doc) {
        throw new Error('Document de participation invalide');
      }

      // Ne pas utiliser populate pour éviter les erreurs StrictPopulate/execPopulate (Mongoose 7)
      // Extraire les IDs depuis les champs stockés (membreId/evenementId ou membre/evenement)
      const extractId = (value: any): number => {
        if (!value) return 0;
        // Si c'est un ObjectId ou un objet avec _id
        if (value._id) return this.convertObjectId(value._id);
        // Si c'est un ObjectId direct (type mongoose.Types.ObjectId)
        if (typeof value === 'object' && value.toHexString) return this.convertObjectId(value);
        // Si c'est déjà un nombre
        if (typeof value === 'number') return value;
        return 0;
      };

      const computedMembreId = doc.membreId ? extractId(doc.membreId) : extractId(doc.membre);
      const computedEvenementId = doc.evenementId ? extractId(doc.evenementId) : extractId(doc.evenement);

      // Convert to shared schema sans populate
      return {
        // Préférer l'id numérique auto-incrémenté si présent, sinon fallback sur _id ObjectId converti
        id: (typeof doc.id === 'number' && !isNaN(doc.id)) ? doc.id : (doc._id ? this.convertObjectId(doc._id) : 0),
        membreId: computedMembreId || 0,
        evenementId: computedEvenementId || 0,
        dateInscription: doc.dateInscription?.toISOString?.() || new Date(doc.dateInscription || Date.now()).toISOString(),
        statut: (doc.statut || 'confirme') as any,
        nombrePlaces: Number(doc.nombrePlaces) || 1,
        montantTotal: Number(doc.montantTotal) || 0,
        methodePaiement: doc.methodePaiement as 'carte' | 'sur_place' | undefined,
        modePaiement: doc.modePaiement as 'carte' | 'sur_place' | undefined,
        numeroCarte: doc.numeroCarte || undefined,
        numeroTransaction: doc.numeroTransaction || undefined,
        estPaye: Boolean(doc.estPaye) || false,
        createdAt: doc.createdAt?.toISOString?.() || new Date(doc.createdAt || Date.now()).toISOString(),
        updatedAt: doc.updatedAt?.toISOString?.() || new Date(doc.updatedAt || Date.now()).toISOString()
      };
    } catch (error: unknown) {
      console.error('[MongoStorage] Error in convertMongoParticipation:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Erreur inconnue lors de la conversion de la participation');
    }
  }

  // Helper: find Mongo ObjectId from numeric id for users
  private async findUserObjectIdFromNumericId(numericId: number | string): Promise<mongoose.Types.ObjectId | null> {
    try {
      // Validate input
      if (numericId === null || numericId === undefined) {
        console.error('[findUserObjectIdFromNumericId] ID utilisateur invalide: null ou undefined');
        return null;
      }

      // Convert to number if it's a string
      const idNum = typeof numericId === 'string' ? parseInt(numericId, 10) : numericId;
      
      if (isNaN(idNum)) {
        console.error(`[findUserObjectIdFromNumericId] ID utilisateur invalide (pas un nombre): ${numericId}`);
        return null;
      }

      // First try to find by numeric id field
      const user = await UserModel.findOne({ id: idNum });
      
      if (user) {
        return user._id;
      }

      // If still not found, try to find by converting _id to numeric and comparing
      if (mongoose.Types.ObjectId.isValid(String(numericId))) {
        const objectId = new mongoose.Types.ObjectId(String(numericId));
        const userById = await UserModel.findById(objectId);
        if (userById) {
          return userById._id;
        }
      }

      // If still not found, try to find by converting _id to numeric and comparing
      console.log(`[findUserObjectIdFromNumericId] Recherche par correspondance numérique pour l'ID: ${idNum}`);
      
      // Get only necessary fields to optimize performance
      const users = await UserModel.find().select('_id').lean();
      console.log(`[findUserObjectIdFromNumericId] ${users.length} utilisateurs chargés pour la recherche`);
      
      for (const user of users) {
        try {
          const userNumericId = this.convertObjectId(user._id);
          
          if (userNumericId === idNum) {
            console.log(`[findUserObjectIdFromNumericId] Correspondance trouvée pour l'ID numérique ${idNum} -> ObjectId: ${user._id}`);
            return user._id;
          }
        } catch (error) {
          console.error(`[findUserObjectIdFromNumericId] Erreur lors de la recherche avec l'ID comme chaîne:`, error);
        }
      }
      
      console.error(`[findUserObjectIdFromNumericId] Aucun utilisateur trouvé avec l'ID numérique: ${numericId}`);
      return null;
    } catch (error) {
      console.error(`[findUserObjectIdFromNumericId] Erreur critique lors de la recherche de l'ObjectId pour l'ID ${numericId}:`, error);
      return null;
    }
  }

  /**
   * Trouve l'ObjectId MongoDB correspondant à un ID numérique d'événement
   * @param numericId L'ID numérique de l'événement à rechercher
   * @returns L'ObjectId correspondant ou null si non trouvé
   */
  private async findEventObjectIdFromNumericId(numericId: number): Promise<mongoose.Types.ObjectId | null> {
    // Convertir en nombre pour s'assurer que c'est bien un nombre
    const numId = Number(numericId);
    
    if (isNaN(numId)) {
      console.error(`[findEventObjectIdFromNumericId] L'ID fourni n'est pas un nombre valide: ${numericId}`);
      return null;
    }
    
    console.log(`[findEventObjectIdFromNumericId] Recherche de l'ObjectId pour l'ID numérique: ${numId} (type: ${typeof numId})`);
    
    // Essayer de trouver par le champ id numérique
    try {
      console.log(`[findEventObjectIdFromNumericId] Recherche d'un événement avec { id: ${numId} }`);
      const event = await EventModel.findOne({ id: numId }).select('_id id').lean();
      
      if (event) {
        console.log(`[findEventObjectIdFromNumericId] Événement trouvé avec l'ID numérique:`, {
          idRecherche: numId,
          idTrouve: event.id,
          _id: event._id,
          typeIdTrouve: typeof event.id,
          type_idTrouve: typeof event._id
        });
        return event._id;
      } else {
        console.log(`[findEventObjectIdFromNumericId] Aucun événement trouvé avec l'ID numérique: ${numId}`);
        
        // Vérifier si des événements existent dans la base
        const count = await EventModel.countDocuments();
        console.log(`[findEventObjectIdFromNumericId] Nombre total d'événements dans la base: ${count}`);
        
        // Afficher les 5 premiers événements pour vérifier leur structure
        if (count > 0) {
          const sampleEvents = await EventModel.find().limit(5).select('id _id titre').lean();
          console.log('[findEventObjectIdFromNumericId] Exemple d\'événements dans la base:', 
            sampleEvents.map(e => ({
              id: e.id,
              _id: e._id,
              titre: e.titre,
              typeId: typeof e.id,
              type_id: typeof e._id
            }))
          );
        }
      }
    } catch (error) {
      console.error(`[findEventObjectIdFromNumericId] Erreur lors de la recherche par ID numérique:`, error);
    }
    
    // 1. Essayer de trouver directement par l'ID numérique (au cas où c'est déjà un ObjectId)
    try {
      // 1. Essayer de trouver directement par l'ID numérique (au cas où c'est déjà un ObjectId)
      if (mongoose.Types.ObjectId.isValid(numId)) {
        try {
          const event = await EventModel.findOne({ _id: numId }).select('_id').lean();
          if (event) {
            console.log(`[findEventObjectIdFromNumericId] Événement trouvé directement avec l'ID: ${event._id}`);
            return event._id;
          }
        } catch (error) {
          console.error(`[findEventObjectIdFromNumericId] Erreur lors de la recherche directe par ID:`, error);
        }
      }
      
      // 2. Rechercher par correspondance numérique (conversion des 8 derniers caractères hexadécimaux)
      console.log(`[findEventObjectIdFromNumericId] Recherche par correspondance numérique pour l'ID: ${numId}`);
      
      // Récupérer uniquement les champs nécessaires pour optimiser les performances
      const events = await EventModel.find().select('_id').lean();
      console.log(`[findEventObjectIdFromNumericId] ${events.length} événements chargés pour la recherche`);
      
      for (const event of events) {
        try {
          const eventNumericId = this.convertObjectId(event._id);
          
          if (eventNumericId === numId) {
            console.log(`[findEventObjectIdFromNumericId] Correspondance trouvée pour l'ID numérique ${numId} -> ObjectId: ${event._id}`);
            return event._id;
          }
        } catch (error) {
          console.error(`[findEventObjectIdFromNumericId] Erreur lors de la conversion de l'ID de l'événement ${event._id}:`, error);
        }
      }
      
      // 3. Dernier recours: essayer de trouver par l'ID numérique comme chaîne (au cas où)
      try {
        const event = await EventModel.findOne({ _id: numId.toString() }).select('_id').lean();
        if (event) {
          console.log(`[findEventObjectIdFromNumericId] Événement trouvé avec l'ID comme chaîne: ${event._id}`);
          return event._id;
        }
      } catch (error) {
        console.error(`[findEventObjectIdFromNumericId] Erreur lors de la recherche avec l'ID comme chaîne:`, error);
      }
      
      console.error(`[findEventObjectIdFromNumericId] Aucun événement trouvé avec l'ID numérique: ${numId}`);
      return null;
      
    } catch (error) {
      console.error(`[findEventObjectIdFromNumericId] Erreur critique lors de la recherche de l'ObjectId pour l'ID ${numId}:`, error);
      return null;
    }
  }

  // Users
  async getUser(id: number): Promise<User | undefined> {
    const objectId = await this.findUserObjectIdFromNumericId(id);
    if (!objectId) return undefined;
    const user = await UserModel.findById(objectId);
    return user ? this.convertMongoUser(user) : undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const user = await UserModel.findOne({ email });
    return user ? this.convertMongoUser(user) : undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    // Since there's no separate username field, we use email as username
    return this.getUserByEmail(username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.motDePasse, 10);
    const user = await UserModel.create({
      ...insertUser,
      motDePasse: hashedPassword
    });
    return this.convertMongoUser(user);
  }

  async updateUser(id: number, updateData: Partial<InsertUser>): Promise<User | undefined> {
    if (updateData.motDePasse) {
      updateData.motDePasse = await bcrypt.hash(updateData.motDePasse, 10);
    }
    const objectId = await this.findUserObjectIdFromNumericId(id);
    if (!objectId) return undefined;
    const user = await UserModel.findByIdAndUpdate(objectId, updateData, { new: true });
    return user ? this.convertMongoUser(user) : undefined;
  }

  async deleteUser(id: number): Promise<boolean> {
    const objectId = await this.findUserObjectIdFromNumericId(id);
    if (!objectId) return false;
    const result = await UserModel.findByIdAndDelete(objectId);
    return !!result;
  }

  async getUsers(): Promise<User[]> {
    const users = await UserModel.find();
    return Promise.all(users.map(user => this.convertMongoUser(user)));
  }

  // Récupère les utilisateurs avec pagination et recherche
  async getUsersPaginated(page: number, limit: number, search: string = ''): Promise<{ users: User[], total: number }> {
    try {
      // Créer la requête de base
      const query: any = {};
      
      // Ajouter la recherche si spécifiée
      if (search) {
        const searchRegex = new RegExp(search, 'i');
        query.$or = [
          { nom: searchRegex },
          { prenom: searchRegex },
          { email: searchRegex },
          { telephone: searchRegex }
        ];
      }
      
      // Compter le nombre total d'utilisateurs correspondants
      const total = await UserModel.countDocuments(query);
      
      // Récupérer les utilisateurs avec pagination
      const users = await UserModel.find(query)
        .sort({ createdAt: -1 }) // Plus récents d'abord
        .skip((page - 1) * limit)
        .limit(limit);
      
      // Convertir les utilisateurs MongoDB en format d'interface
      const convertedUsers = await Promise.all(
        users.map(user => this.convertMongoUser(user))
      );
      
      return {
        users: convertedUsers,
        total
      };
    } catch (error) {
      console.error('[getUsersPaginated] Erreur:', error);
      throw new Error('Erreur lors de la récupération des utilisateurs');
    }
  }

  async getAllUsers(): Promise<User[]> {
    return this.getUsers();
  }

  // Events
  async getEvent(id: number): Promise<Event | undefined> {
    console.log(`[getEvent] Début de la recherche pour l'ID: ${id} (type: ${typeof id})`);
    
    try {
      console.log(`[getEvent] Recherche de l'ObjectId pour l'ID numérique: ${id}`);
      const objectId = await this.findEventObjectIdFromNumericId(id);
      
      if (!objectId) {
        console.error(`[getEvent] Aucun ObjectId trouvé pour l'ID numérique: ${id}`);
        
        // Vérifier si l'ID est un ObjectId valide
        if (mongoose.Types.ObjectId.isValid(String(id))) {
          console.log(`[getEvent] L'ID ${id} semble être un ObjectId valide, tentative de recherche directe`);
          const event = await EventModel.findById(String(id));
          if (event) {
            console.log(`[getEvent] Événement trouvé avec l'ID ObjectId direct: ${id}`);
            return await this.convertMongoEvent(event);
          }
        }
        
        // Essayer de trouver l'événement directement par son ID numérique
        console.log(`[getEvent] Tentative de recherche par ID numérique direct: ${id}`);
        const eventById = await EventModel.findOne({ id: Number(id) });
        if (eventById) {
          console.log(`[getEvent] Événement trouvé avec l'ID numérique direct: ${id}`);
          return await this.convertMongoEvent(eventById);
        }
        
        console.error(`[getEvent] Événement non trouvé avec l'ID: ${id} (aucune méthode n'a fonctionné)`);
        return undefined;
      }
      
      console.log(`[getEvent] ObjectId trouvé: ${objectId} pour l'ID numérique: ${id}`);
      
      // Rechercher l'événement avec l'ObjectId trouvé
      const event = await EventModel.findById(objectId);
      
      if (!event) {
        console.error(`[getEvent] Aucun événement trouvé avec l'ObjectId: ${objectId} (ID numérique: ${id})`);
        
        // Si on arrive ici, il y a une incohérence dans la base de données
        // Essayer de trouver l'événement par son ID numérique
        console.log(`[getEvent] Tentative de récupération par ID numérique après échec avec ObjectId`);
        const eventByNumId = await EventModel.findOne({ id: Number(id) });
        
        if (eventByNumId) {
          console.log(`[getEvent] Événement récupéré avec succès par ID numérique après échec avec ObjectId`);
          return await this.convertMongoEvent(eventByNumId);
        }
        
        return undefined;
      }
      
      console.log(`[getEvent] Événement trouvé avec succès, conversion en cours...`);
      const convertedEvent = await this.convertMongoEvent(event);
      console.log(`[getEvent] Conversion terminée pour l'événement ID: ${convertedEvent.id}`);
      
      return convertedEvent;
      
    } catch (error) {
      console.error(`[getEvent] Erreur critique lors de la récupération de l'événement avec l'ID ${id}:`, error);
      
      // En cas d'erreur, essayer une dernière méthode de récupération
      try {
        console.log(`[getEvent] Tentative de récupération de secours pour l'ID: ${id}`);
        const event = await EventModel.findOne({ id: Number(id) });
        if (event) {
          console.log(`[getEvent] Récupération de secours réussie pour l'ID: ${id}`);
          return await this.convertMongoEvent(event);
        }
      } catch (fallbackError) {
        console.error(`[getEvent] Échec de la récupération de secours:`, fallbackError);
      }
      
      return undefined;
    }
  }

  async getEvents(): Promise<Event[]> {
    const events = await EventModel.find();
    return Promise.all(events.map(event => this.convertMongoEvent(event)));
  }

  // Méthode utilitaire pour valider et formater les dates
  private getValidDate(dateInput: any): Date {
    if (!dateInput) return new Date();
    if (dateInput instanceof Date) return dateInput;
    if (typeof dateInput === 'string' || typeof dateInput === 'number') {
      const date = new Date(dateInput);
      return isNaN(date.getTime()) ? new Date() : date;
    }
    return new Date();
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    try {
      // Validation des données d'entrée
      if (!insertEvent.titre || !insertEvent.date) {
        throw new Error('Le titre et la date de l\'événement sont obligatoires');
      }

      // Déterminer les places (valeur par défaut à 10 si non fourni)
      const computedPlaces =
        typeof insertEvent.placesDisponibles === 'number' && isFinite(insertEvent.placesDisponibles)
          ? Math.max(0, Math.floor(insertEvent.placesDisponibles))
          : typeof insertEvent.placesMax === 'number' && isFinite(insertEvent.placesMax)
            ? Math.max(0, Math.floor(insertEvent.placesMax))
            : 10;
      const computedPlacesMax =
        typeof insertEvent.placesMax === 'number' && isFinite(insertEvent.placesMax)
          ? Math.max(0, Math.floor(insertEvent.placesMax))
          : computedPlaces;

      // Map fields from InsertEvent to MongoDB event schema (doit respecter eventSchema dans mongodb.ts)
      const mongoEvent: any = {
        titre: insertEvent.titre,
        description: insertEvent.description || '',
        date: this.getValidDate(insertEvent.date),
        dateDebut: this.getValidDate(insertEvent.date),
        dateFin: insertEvent.dateFin ? this.getValidDate(insertEvent.dateFin) : this.getValidDate(insertEvent.date),
        lieu: insertEvent.lieu || 'À définir',
        placesDisponibles: computedPlaces,
        placesMax: computedPlacesMax,
        placesParMembre: ((): number => {
          const v = (insertEvent as any).placesParMembre;
          const n = Number(v);
          return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
        })(),
        prix: insertEvent.prix !== undefined ? parseFloat(Number(insertEvent.prix).toFixed(2)) : 0,
        estPayant: insertEvent.estPayant !== undefined 
          ? Boolean(insertEvent.estPayant) 
          : (insertEvent.prix ? parseFloat(Number(insertEvent.prix).toFixed(2)) > 0 : false),
        imageUrl: insertEvent.imageUrl || '',
        dateCreation: new Date(),
        updatedAt: new Date()
      };
      
      const event = await EventModel.create(mongoEvent);
      return await this.convertMongoEvent(event);
    } catch (error) {
      console.error('Erreur lors de la création de l\'événement:', error);
      throw new Error(error instanceof Error ? error.message : 'Erreur lors de la création de l\'événement');
    }
  }

  async updateEvent(id: number, updateData: Partial<InsertEvent>): Promise<Event | undefined> {
    try {
      // Validation de l'ID
      if (!id || isNaN(id) || id <= 0) {
        throw new Error(`ID d'événement invalide: ${id}`);
      }

      // Trouver l'ObjectId correspondant
      const objectId = await this.findEventObjectIdFromNumericId(id);
      if (!objectId) {
        console.log(`Aucun événement trouvé avec l'ID numérique: ${id} pour la mise à jour`);
        return undefined;
      }
      
      // Préparer les données de mise à jour
      const update: any = {};
      
      // Mapper les champs du schéma partagé vers le schéma MongoDB
      if (updateData.titre !== undefined) update.titre = updateData.titre;
      if (updateData.description !== undefined) update.description = updateData.description;
      
      // Gestion des dates
      if (updateData.date !== undefined) {
        update.dateDebut = this.getValidDate(updateData.date);
      }
      if (updateData.dateFin !== undefined) {
        update.dateFin = this.getValidDate(updateData.dateFin);
      }
      
      if (updateData.lieu !== undefined) update.lieu = updateData.lieu;
      
      // Gestion des places
      if (updateData.placesDisponibles !== undefined) {
        update.placesMax = updateData.placesDisponibles;
      }

      // Gestion de la limite par membre
      if ((updateData as any).placesParMembre !== undefined) {
        const n = Number((updateData as any).placesParMembre);
        if (Number.isFinite(n) && n >= 1) {
          update.placesParMembre = Math.floor(n);
        }
      }
      
      // Gestion du prix et du statut payant avec formatage à 2 décimales
      if (updateData.prix !== undefined) {
        const prixNum = Number(updateData.prix);
        if (!isNaN(prixNum)) {
          update.prix = parseFloat(prixNum.toFixed(2));
          // Mise à jour automatique de estPayant si non spécifié
          if (updateData.estPayant === undefined) {
            update.estPayant = update.prix > 0;
          }
        } else {
          update.prix = 0;
          if (updateData.estPayant === undefined) {
            update.estPayant = false;
          }
        }
      }
      
      if (updateData.estPayant !== undefined) {
        update.estPayant = Boolean(updateData.estPayant);
      }
      
      // Champs optionnels
      if (updateData.imageUrl !== undefined) update.imageUrl = updateData.imageUrl;
      if (updateData.statut !== undefined) update.statut = updateData.statut;
      
      // Mettre à jour la date de mise à jour
      update.updatedAt = new Date();
      
      console.log(`Mise à jour de l'événement ${id} avec les données:`, update);
      
      // Appliquer la mise à jour
      const event = await EventModel.findByIdAndUpdate(
        objectId, 
        { $set: update },
        { new: true }
      );
      
      if (!event) {
        console.log(`Échec de la mise à jour de l'événement avec l'ObjectId: ${objectId} (ID numérique: ${id})`);
        return undefined;
      }
      
      return await this.convertMongoEvent(event);
    } catch (error) {
      console.error(`Erreur lors de la mise à jour de l'événement avec l'ID ${id}:`, error);
      throw new Error(error instanceof Error ? error.message : 'Erreur lors de la mise à jour de l\'événement');
    }
  }

  async deleteEvent(id: number): Promise<{ success: boolean; message: string }> {
    console.log(`\n🗑️ [deleteEvent] === DÉBUT SUPPRESSION ÉVÉNEMENT ===`);
    console.log(`[deleteEvent] ID reçu: ${id} (type: ${typeof id})`);
    
    // 1. Validation de l'ID d'entrée
    if (id === null || id === undefined || isNaN(id) || id <= 0) {
      const errorMsg = `ID d'événement invalide: ${id}`;
      console.error(`❌ [deleteEvent] ${errorMsg}`);
      return { success: false, message: errorMsg };
    }
    
    try {
      // 2. Trouver l'événement par son ID numérique (champ id)
      console.log(`🔍 [deleteEvent] Recherche de l'événement avec l'ID numérique (champ id): ${id}`);
      let targetEvent = await EventModel.findOne({ id }).lean();
      
      // 2b. Fallback: correspondance via conversion de l'ObjectId en entier
      if (!targetEvent) {
        console.log(`ℹ️  [deleteEvent] Aucun événement avec { id: ${id} }, tentative via conversion ObjectId`);
        const allEvents = await EventModel.find().lean();
        targetEvent = allEvents.find(event => this.convertObjectId(event._id) === id) || null;
      }

      // 2c. Fallback supplémentaire : recherche directe par ObjectId si l'ID reçu est un ObjectId valide
      if (!targetEvent && mongoose.Types.ObjectId.isValid(String(id))) {
        console.log(`ℹ️  [deleteEvent] Tentative de recherche directe par ObjectId: ${id}`);
        targetEvent = await EventModel.findById(String(id)).lean();
      }
      
      if (!targetEvent) {
        const errorMsg = `Aucun événement trouvé avec l'ID: ${id}`;
        console.error(`❌ [deleteEvent] ${errorMsg}`);
        return { success: false, message: errorMsg };
      }
      
      console.log(`✅ [deleteEvent] Événement trouvé: "${targetEvent.titre}"`);
      console.log(`   ID numérique: ${id}`);
      console.log(`   ObjectId: ${targetEvent._id}`);
      
      // 3. Supprimer les participations liées
      console.log(`🧹 [deleteEvent] Suppression des participations...`);
      const participationsResult = await ParticipationModel.deleteMany({ evenementId: targetEvent._id });
      console.log(`   ${participationsResult.deletedCount} participations supprimées`);
      
      // 4. Supprimer les paiements liés
      console.log(`💳 [deleteEvent] Suppression des paiements...`);
      const evenementNumericId = (typeof targetEvent.id === 'number' && !isNaN(targetEvent.id))
        ? targetEvent.id
        : this.convertObjectId(targetEvent._id);
      const paymentsResult = await PaymentModel.deleteMany({ evenementId: evenementNumericId });
      console.log(`   ${paymentsResult.deletedCount} paiements supprimés`);
      
      // 5. Supprimer l'événement principal
      console.log(`🗑️ [deleteEvent] Suppression de l'événement principal...`);
      const deleteResult = await EventModel.deleteOne({ _id: targetEvent._id });
      
      if (deleteResult.deletedCount === 0) {
        const errorMsg = `Échec de la suppression de l'événement avec l'ID: ${id}`;
        console.error(`❌ [deleteEvent] ${errorMsg}`);
        return { success: false, message: errorMsg };
      }
      
      console.log(`\n🎉 [deleteEvent] === SUPPRESSION RÉUSSIE ===`);
      console.log(`   Événement: "${targetEvent.titre}"`);
      console.log(`   ID numérique: ${id}`);
      console.log(`   ObjectId: ${targetEvent._id}`);
      console.log(`   Participations supprimées: ${participationsResult.deletedCount}`);
      console.log(`   Paiements supprimés: ${paymentsResult.deletedCount}`);
      console.log(`=== FIN SUPPRESSION ===\n`);
      
      return { 
        success: true, 
        message: `Événement "${targetEvent.titre}" supprimé avec succès` 
      };
    } catch (error) {
      const errorMsg = `Erreur lors de la suppression de l'événement: ${(error as Error).message || 'Erreur inconnue'}`;
      console.error(`❌ [deleteEvent] ${errorMsg}`, error);
      return { success: false, message: errorMsg };
    }
  }

  // Participations
  async getParticipation(id: number): Promise<Participation | undefined> {
    try {
      // Find participation by numeric ID
      const participation = await ParticipationModel.findOne({ id: id });
      return participation ? await this.convertMongoParticipation(participation) : undefined;
    } catch (error) {
      console.error(`[getParticipation] Erreur lors de la récupération de la participation:`, error);
      return undefined;
    }
  }

  async getParticipations(): Promise<Participation[]> {
    const participations = await ParticipationModel.find();
    return Promise.all(participations.map(p => this.convertMongoParticipation(p)));
  }

  async getParticipationsByMember(membreId: number): Promise<Participation[]> {
    try {
      // Convert numeric membreId to ObjectId for MongoDB query
      const userObjectId = await this.findUserObjectIdFromNumericId(membreId);
      if (!userObjectId) {
        return [];
      }
      
      const participations = await ParticipationModel.find({ membreId: userObjectId });
      return Promise.all(participations.map(p => this.convertMongoParticipation(p)));
    } catch (error) {
      console.error(`[getParticipationsByMember] Erreur:`, error);
      return [];
    }
  }

  async getParticipationsByEvent(evenementId: number): Promise<Participation[]> {
    try {
      // Convert numeric evenementId to ObjectId for MongoDB query
      const eventObjectId = await this.findEventObjectIdFromNumericId(evenementId);
      if (!eventObjectId) {
        return [];
      }
      
      const participations = await ParticipationModel.find({ evenementId: eventObjectId });
      return Promise.all(participations.map(p => this.convertMongoParticipation(p)));
    } catch (error) {
      console.error(`[getParticipationsByEvent] Erreur:`, error);
      return [];
    }
  }

  // Suppression de la méthode en double - Voir l'implémentation principale plus haut
  // Le code dupliqué a été supprimé pour éviter les erreurs de syntaxe

  async deleteParticipation(id: number): Promise<boolean> {
    try {
      // Find and delete participation by numeric ID
      const result = await ParticipationModel.findOneAndDelete({ id: id });
      if (!result) return false;
      // Retirer le membre de la liste des participants de l'événement
      try {
        const eventId = (result as any).evenementId; // ObjectId
        const memberId = (result as any).membreId; // ObjectId
        if (eventId && memberId) {
          await EventModel.findByIdAndUpdate(eventId, { $pull: { participants: memberId } });
        }
      } catch (e) {
        console.warn('[deleteParticipation] Impossible de mettre à jour Event.participants:', e);
      }
      return true;
    } catch (error) {
      console.error(`[deleteParticipation] Erreur lors de la suppression de la participation:`, error);
      return false;
    }
  }

  // Payments
  async getPayment(id: number): Promise<Payment | undefined> {
    const payment = await PaymentModel.findById(id);
    return payment ? this.convertMongoPayment(payment) : undefined;
  }

  async getPayments(): Promise<Payment[]> {
    const payments = await PaymentModel.find();
    return payments.map(p => this.convertMongoPayment(p));
  }

  async getPaymentsByMember(membreId: number): Promise<Payment[]> {
    const payments = await PaymentModel.find({ membreId });
    return payments.map(p => this.convertMongoPayment(p));
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const payment = await PaymentModel.create(insertPayment);
    return this.convertMongoPayment(payment);
  }

  async updatePayment(id: number, updateData: Partial<InsertPayment>): Promise<Payment | undefined> {
    const payment = await PaymentModel.findByIdAndUpdate(id, updateData, { new: true });
    return payment ? this.convertMongoPayment(payment) : undefined;
  }

  // Notifications
  async getNotification(id: number): Promise<Notification | undefined> {
    const notification = await NotificationModel.findOne({ id: id });
    return notification ? this.convertMongoNotification(notification) : undefined;
  }

  async getNotifications(): Promise<Notification[]> {
    const notifications = await NotificationModel.find();
    return notifications.map(n => this.convertMongoNotification(n));
  }

  async getNotificationsByUser(userId: number): Promise<Notification[]> {
    const notifications = await NotificationModel.find({ utilisateurId: userId });
    return notifications.map(n => this.convertMongoNotification(n));
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const notification = await NotificationModel.create(insertNotification);
    return this.convertMongoNotification(notification);
  }

  async markNotificationAsRead(id: number | string): Promise<boolean> {
    try {
      console.log(`[MongoDB] Tentative de marquage comme lue pour notification ID: ${id} (type=${typeof id})`);
      const numericId = typeof id === 'string' ? Number(id) : id;
      
      // Essayer d'abord par champ id numérique
      let result = await NotificationModel.findOneAndUpdate(
        { id: numericId },
        { 
          $set: { 
            lue: true,
            updatedAt: new Date() 
          } 
        },
        { new: true }
      );
      
      // Si pas trouvé par id numérique, essayer par _id ObjectId
      if (!result && mongoose.Types.ObjectId.isValid(String(id))) {
        console.log(`[MongoDB] Tentative par ObjectId pour notification: ${id}`);
        result = await NotificationModel.findByIdAndUpdate(
          id,
          { 
            $set: { 
              lue: true,
              updatedAt: new Date() 
            } 
          },
          { new: true }
        );
      }

      // Fallback legacy: si l'ID fourni est un nombre non-ObjectId et qu'aucun doc par champ id
      // ne correspond, on tente de retrouver le doc dont la conversion d'_id en nombre correspond
      if (!result && typeof numericId === 'number' && !isNaN(numericId)) {
        console.log(`[MongoDB] Fallback legacy: recherche par conversion _id -> nombre pour ${numericId}`);
        const candidate = await NotificationModel.findOne();
        // Parcourir en flux pour éviter de charger toute la collection si elle est volumineuse
        const cursor = NotificationModel.find().cursor();
        for await (const doc of cursor as any) {
          const converted = this.convertObjectId(doc._id);
          if (converted === numericId) {
            result = await NotificationModel.findByIdAndUpdate(
              doc._id,
              {
                $set: {
                  lue: true,
                  updatedAt: new Date(),
                },
              },
              { new: true }
            );
            break;
          }
        }
      }
      
      if (result) {
        console.log(`[MongoDB] Notification ${id} marquée comme lue avec succès`);
        return true;
      } else {
        console.log(`[MongoDB] Notification ${id} non trouvée`);
        return false;
      }
    } catch (error) {
      console.error(`[MongoDB] Erreur lors du marquage comme lue de la notification ${id}:`, error);
      return false;
    }
  }

  async deleteNotification(id: number | string): Promise<boolean> {
    try {
      const numericId = typeof id === 'string' ? Number(id) : id;
      // Essai par champ id numérique
      let deleted: any = await NotificationModel.findOneAndDelete({ id: numericId });
      if (deleted) return true;

      // Essai par ObjectId
      if (mongoose.Types.ObjectId.isValid(String(id))) {
        deleted = await NotificationModel.findByIdAndDelete(id);
        if (deleted) return true;
      }

      // Fallback legacy: correspondance par conversion _id -> nombre
      if (typeof numericId === 'number' && !isNaN(numericId)) {
        const cursor = NotificationModel.find().cursor();
        for await (const doc of cursor as any) {
          const converted = this.convertObjectId(doc._id);
          if (converted === numericId) {
            const del = await NotificationModel.findByIdAndDelete(doc._id);
            return del != null;
          }
        }
      }
      return false;
    } catch (e) {
      console.error('[MongoDB] Erreur deleteNotification:', e);
      return false;
    }
  }

  async getStats() {
    try {
      // Get total counts
      const [
        totalMembers,
        totalEvents,
        totalParticipations,
        totalPayments,
        payments
      ] = await Promise.all([
        UserModel.countDocuments(),
        EventModel.countDocuments(),
        ParticipationModel.countDocuments(),
        PaymentModel.countDocuments(),
        PaymentModel.find({ statut: 'paye' })
      ]);
      
      // Calculate total revenue
      const totalRevenue = payments.reduce((sum, payment) => {
        const amount = typeof payment.montant === 'string' 
          ? parseFloat(payment.montant) 
          : payment.montant;
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);

      // Calculate monthly growth (last 30 days)
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      
      const [
        newMembersThisMonth,
        newEventsThisMonth,
        newParticipationsThisMonth,
        newPaymentsThisMonth
      ] = await Promise.all([
        UserModel.countDocuments({ createdAt: { $gte: oneMonthAgo } }),
        EventModel.countDocuments({ date: { $gte: oneMonthAgo } }),
        ParticipationModel.countDocuments({ createdAt: { $gte: oneMonthAgo } }),
        PaymentModel.aggregate([
          {
            $match: { 
              statut: 'paye',
              datePaiement: { $gte: oneMonthAgo }
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: { $toDouble: "$montant" } }
            }
          }
        ])
      ]);

      // Calculate growth percentages
      const memberGrowth = totalMembers > 0 ? 
        Math.round((newMembersThisMonth / totalMembers) * 100) : 0;
      
      const eventGrowth = totalEvents > 0 ? 
        Math.round((newEventsThisMonth / totalEvents) * 100) : 0;
      
      const participationGrowth = totalParticipations > 0 ? 
        Math.round((newParticipationsThisMonth / totalParticipations) * 100) : 0;
      
      const revenueThisMonth = newPaymentsThisMonth[0]?.total || 0;
      const revenueGrowth = totalRevenue > 0 ? 
        Math.round((revenueThisMonth / totalRevenue) * 100) : 0;

      return {
        totalMembers,
        totalEvents,
        totalParticipations,
        totalRevenue,
        monthlyGrowth: {
          members: memberGrowth,
          events: eventGrowth,
          participations: participationGrowth,
          revenue: revenueGrowth
        }
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
      return {
        totalMembers: 0,
        totalEvents: 0,
        totalParticipations: 0,
        totalRevenue: 0,
        monthlyGrowth: {
          members: 0,
          events: 0,
          participations: 0,
          revenue: 0
        }
      };
    }
  }

  // Méthodes de conversion MongoDB -> App Schema
  private convertMongoUser(mongoUser: any): User {
    return {
      // Préférer l'ID numérique stocké en base lorsqu'il existe, sinon fallback sur un ID dérivé de _id
      id: (typeof mongoUser.id === 'number' && !isNaN(mongoUser.id)) ? mongoUser.id : this.convertObjectId(mongoUser._id),
      nom: mongoUser.nom,
      prenom: mongoUser.prenom,
      email: mongoUser.email,
      motDePasse: mongoUser.motDePasse,
      role: mongoUser.role,
      statut: mongoUser.statut || 'actif',
      dateInscription: mongoUser.dateInscription ? mongoUser.dateInscription.toISOString() : new Date().toISOString(),
      telephone: mongoUser.telephone,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  private async convertMongoEvent(mongoEvent: any): Promise<Event> {
    try {
      // Récupérer les participants si non inclus dans le document
      let participantsArray = [];
      let placesOccupees = 0;
      
      if (mongoEvent.participants && Array.isArray(mongoEvent.participants)) {
        // Si les participants sont déjà inclus dans le document (via populate)
        participantsArray = mongoEvent.participants.map((p: any) => ({
          id: p.id || this.convertObjectId(p._id),
          nom: p.nom || '',
          prenom: p.prenom || '',
          email: p.email || ''
        }));
        placesOccupees = participantsArray.length;
      } else {
        // Sinon, récupérer les participations non annulées
        try {
          const participations = await ParticipationModel.find({
            evenementId: mongoEvent._id,
            statut: { $ne: 'annulé' }
          });
          
          // Récupérer les détails des utilisateurs pour chaque participation
          const participantIds = new Set(); // Pour éviter les doublons
          
          for (const p of participations) {
            if (participantIds.has(p.membreId.toString())) continue;
            
            const user = await UserModel.findById(p.membreId);
            if (user) {
              participantIds.add(p.membreId.toString());
              participantsArray.push({
                id: this.convertObjectId(user._id),
                nom: user.nom || '',
                prenom: user.prenom || '',
                email: user.email || ''
              });
              placesOccupees += p.nombrePlaces || 1;
            }
          }
        } catch (error) {
          console.error('Erreur lors de la récupération des participants:', error);
        }
      }
      
      const dateDebut = this.getValidDate(mongoEvent.dateDebut || mongoEvent.date);
      const dateFin = this.getValidDate(mongoEvent.dateFin);
      
      // Gestion des places
      const placesMax = Math.max(0, Number(mongoEvent.placesMax) || Number(mongoEvent.placesDisponibles) || 0);
      const placesDisponibles = Math.max(0, placesMax - placesOccupees);
      
      // Gestion du prix avec formatage à 2 décimales
      let prix = 0;
      if (mongoEvent.prix !== undefined && mongoEvent.prix !== null) {
        // Convertir en nombre et formater à 2 décimales
        const prixNum = typeof mongoEvent.prix === 'string' 
          ? parseFloat(mongoEvent.prix) 
          : Number(mongoEvent.prix);
          
        if (!isNaN(prixNum)) {
          // Utiliser toFixed(2) pour forcer 2 décimales, puis reconvertir en nombre
          prix = parseFloat(prixNum.toFixed(2));
        }
      }
      
      // Déterminer si l'événement est payant
      const estPayant = mongoEvent.estPayant !== undefined 
        ? Boolean(mongoEvent.estPayant)
        : (prix > 0);
      
      // Construction de l'objet d'événement
      const event: Event = {
        id: mongoEvent.id || this.convertObjectId(mongoEvent._id) || 0,
        titre: String(mongoEvent.titre || ''),
        description: String(mongoEvent.description || ''),
        date: dateDebut.toISOString(),
        dateDebut: dateDebut.toISOString(),
        dateFin: dateFin.toISOString(),
        lieu: String(mongoEvent.lieu || ''),
        placesDisponibles,
        placesMax,
        placesParMembre: Math.max(1, Number(mongoEvent.placesParMembre) || 1),
        prix,
        estPayant,
        imageUrl: mongoEvent.imageUrl || '',
        participants: participantsArray,
        createdAt: this.getValidDate(mongoEvent.dateCreation || mongoEvent.createdAt).toISOString(),
        updatedAt: this.getValidDate(mongoEvent.dateMiseAJour || mongoEvent.updatedAt || mongoEvent.dateCreation || mongoEvent.createdAt).toISOString()
      };
      
      return event;
    } catch (error) {
      console.error('Erreur lors de la conversion de l\'événement:', error);
      // Retourner un événement vide en cas d'erreur
      return {
        id: 0,
        titre: 'Erreur de chargement',
        description: 'Impossible de charger les détails de l\'événement',
        date: new Date().toISOString(),
        dateDebut: new Date().toISOString(),
        dateFin: new Date().toISOString(),
        lieu: '',
        placesDisponibles: 0,
        placesMax: 0,
        prix: 0,
        estPayant: false,
        imageUrl: '',
        participants: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
  }



  private convertMongoPayment(mongoPayment: any): Payment {
    return {
      id: this.convertObjectId(mongoPayment._id),
      membreId: this.convertObjectId(mongoPayment.membreId),
      evenementId: this.convertObjectId(mongoPayment.evenementId),
      montant: parseFloat(mongoPayment.montant), // Convert montant to number
      datePaiement: mongoPayment.datePaiement || mongoPayment.dateCreation, // Map dateCreation to datePaiement if needed
      methode: mongoPayment.methode || 'carte', // Default to 'carte' if not specified
      // Normaliser l'éventuel 'payé' vers 'paye' pour correspondre au type partagé
      statut: (mongoPayment.statut === 'payé') ? 'paye' : (mongoPayment.statut || 'en_attente'),
      reference: mongoPayment.reference || '', // Default to empty string if not specified
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  private convertMongoNotification(mongoNotification: any): Notification {
    return {
      id: typeof mongoNotification.id === 'number' && !isNaN(mongoNotification.id)
        ? mongoNotification.id
        : this.convertObjectId(mongoNotification._id),
      utilisateurId: mongoNotification.utilisateurId, // Utiliser directement l'ID numérique
      titre: mongoNotification.titre,
      message: mongoNotification.message,
      lue: mongoNotification.lue || false,
      lien: mongoNotification.lien || undefined,
      createdAt: mongoNotification.dateCreation ? new Date(mongoNotification.dateCreation).toISOString() : new Date().toISOString(),
      updatedAt: mongoNotification.dateMiseAJour ? new Date(mongoNotification.dateMiseAJour).toISOString() : new Date().toISOString()
    };
  }

  private convertObjectId(objectId: any): number {
    try {
      if (objectId === null || objectId === undefined) {
        console.error('[convertObjectId] ID null ou undefined reçu, retour 0');
        return 0;
      }
      // Si l'ID est déjà un nombre, s'assurer qu'il est dans la limite 31-bit
      if (typeof objectId === 'number') {
        const validId = objectId & 0x7FFFFFFF; // Force à être un entier 31-bit positif
        if (validId !== objectId) {
          console.log(`[convertObjectId] ID numérique corrigé: ${objectId} -> ${validId}`);
        }
        return validId > 0 ? validId : Math.abs(validId) + 1;
      }
      
      // Si l'ID est une chaîne qui peut être convertie en nombre, la convertir
      if (typeof objectId === 'string' && /^\d+$/.test(objectId)) {
        const numId = parseInt(objectId, 10);
        const validId = numId & 0x7FFFFFFF;
        console.log(`[convertObjectId] Conversion chaîne numérique: ${objectId} -> ${validId}`);
        return validId > 0 ? validId : Math.abs(validId) + 1;
      }
      
      // Pour les ObjectId MongoDB, utiliser une fonction de hachage sûre
      const objectIdStr = objectId.toString();
      let hash = 0;
      
      // Fonction de hachage simple mais efficace
      for (let i = 0; i < objectIdStr.length; i++) {
        hash = ((hash << 5) - hash) + objectIdStr.charCodeAt(i);
        hash = hash & hash; // Convertir en entier 32-bit
      }
      
      // S'assurer que le résultat est un entier 31-bit positif
      const validId = Math.abs(hash) & 0x7FFFFFFF;
      const finalId = validId > 0 ? validId : Math.abs(validId) + 1;
      
      console.log(`[convertObjectId] Conversion ObjectId: ${objectIdStr} -> ${finalId}`);
      
      return finalId;
    } catch (error) {
      console.error(`[convertObjectId] Erreur lors de la conversion de l'ID:`, error);
      // En cas d'erreur, retourner un ID aléatoire valide
      const fallbackId = Math.floor(Math.random() * 1000000) + 1;
      console.log(`[convertObjectId] ID de secours généré: ${fallbackId}`);
      return fallbackId;
    }
  }
}