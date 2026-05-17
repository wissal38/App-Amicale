import type { Express, Request, Response } from "express";
import { log } from "./vite";
import { createServer, type Server } from "http";
import { MongoStorage } from "./mongodb-storage";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { loginSchema, registerSchema, insertEventSchema, insertParticipationSchema, insertPaymentSchema, insertNotificationSchema, InsertUser, InsertParticipation, InsertNotification } from "@shared/schema";
import emailRoutes from "./routes/email";
import { z } from "zod";
import { requireRole } from "./middleware/role";
import mongoose from "mongoose";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const storage = new MongoStorage();
// Interface pour les requêtes authentifiées
interface AuthenticatedRequest extends Request {
  user?: any;
}

// Middleware pour vérifier le token JWT
const authenticateToken = (req: AuthenticatedRequest, res: Response, next: any) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  console.log(`[authenticateToken] Route: ${req.method} ${req.path}`);
  console.log(`[authenticateToken] Authorization header:`, authHeader ? 'Present' : 'Missing');

  if (!token) {
    console.log('[authenticateToken] Token manquant');
    return res.status(401).json({ message: "Token manquant" });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      console.log('[authenticateToken] Erreur de vérification du token:', err.name, err.message);
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: "Token expiré", code: "TOKEN_EXPIRED" });
      } else if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: "Token invalide", code: "TOKEN_INVALID" });
      } else {
        return res.status(401).json({ message: "Erreur d'authentification", code: "AUTH_ERROR" });
      }
    }
    
    console.log(`[authenticateToken] Token valide pour l'utilisateur:`, user.id, user.email);
    req.user = user;
    next();
  });
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, motDePasse } = loginSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(400).json({ message: "Utilisateur non trouvé" });
      }

      const isMatch = await bcrypt.compare(motDePasse, user.motDePasse);
      if (!isMatch) {
        return res.status(401).json({ message: "Mot de passe incorrect" });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      const { motDePasse: _, ...userWithoutPassword } = user;
      res.setHeader('Content-Type', 'application/json');
      res.json({ token, user: userWithoutPassword });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Données invalides", errors: error.errors });
      }
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { confirmPassword, ...userData } = registerSchema.parse(req.body);
      
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "Cet email est déjà utilisé" });
      }

      // Add default role for new users
      const userDataWithRole: InsertUser = { 
        ...userData, 
        role: 'membre' 
      };
      
      const user = await storage.createUser(userDataWithRole);
      const { motDePasse, ...userWithoutPassword } = user;
      
      res.status(201).json({ message: "Utilisateur créé avec succès", user: userWithoutPassword });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Données invalides", errors: error.errors });
      }
      console.error('[POST /api/auth/register] ERREUR:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        console.error('[GET /api/auth/me] Utilisateur non trouvé:', req.user.id);
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }
      const { motDePasse, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error('[GET /api/auth/me] ERREUR:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Users routes - Admin only
  app.get("/api/users", authenticateToken, requireRole('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const users = await storage.getUsers();
      const usersSansMotDePasse = users.map(({ motDePasse, ...rest }) => rest);
      res.json(usersSansMotDePasse);
    } catch (error) {
      console.error('[GET /api/users] ERREUR:', error);
      res.status(500).json({ message: "Erreur serveur lors de la récupération des utilisateurs" });
    }
  });

  // Obtenir un utilisateur spécifique
  app.get("/api/users/:id", authenticateToken, requireRole('admin'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID utilisateur invalide" });
      }
      
      const user = await storage.getUser(id);
      if (!user) {
        console.error('[GET /api/users/:id] Utilisateur non trouvé:', id);
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }
      
      const { motDePasse, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error('[GET /api/users/:id] ERREUR:', error);
      res.status(500).json({ message: "Erreur serveur lors de la récupération de l'utilisateur" });
    }
  });

  // Mettre à jour un utilisateur
  app.put("/api/users/:id", authenticateToken, requireRole('admin'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID utilisateur invalide" });
      }
      
      // Validation des données d'entrée
      const updateData = req.body;
      if (updateData.motDePasse) {
        // Si le mot de passe est fourni, on le hash
        updateData.motDePasse = await bcrypt.hash(updateData.motDePasse, 10);
      }
      
      const updatedUser = await storage.updateUser(id, updateData);
      if (!updatedUser) {
        console.error('[PUT /api/users/:id] Échec de la mise à jour de l\'utilisateur:', id);
        return res.status(404).json({ error: "Échec de la mise à jour de l'utilisateur" });
      }
      
      const { motDePasse, ...userWithoutPassword } = updatedUser;
      res.json({
        message: "Utilisateur mis à jour avec succès",
        user: userWithoutPassword
      });
    } catch (error) {
      console.error('[PUT /api/users/:id] ERREUR:', error);
      res.status(500).json({ message: "Erreur serveur lors de la mise à jour de l'utilisateur" });
    }
  });

  // Supprimer un utilisateur
  app.delete("/api/users/:id", authenticateToken, requireRole('admin'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID utilisateur invalide" });
      }
      
      // Empêcher l'auto-suppression
      if (req.user && req.user.id === id) {
        return res.status(403).json({ error: "Vous ne pouvez pas supprimer votre propre compte" });
      }
      
      const deleted = await storage.deleteUser(id);
      if (!deleted) {
        console.error('[DELETE /api/users/:id] Échec de la suppression de l\'utilisateur:', id);
        return res.status(404).json({ error: "Échec de la suppression de l'utilisateur" });
      }
      
      res.json({ message: "Utilisateur supprimé avec succès" });
    } catch (error) {
      console.error('[DELETE /api/users/:id] ERREUR:', error);
      res.status(500).json({ message: "Erreur serveur lors de la suppression de l'utilisateur" });
    }
  });
  
  // Créer un nouvel utilisateur (admin seulement)
  app.post("/api/users", authenticateToken, requireRole('admin'), async (req, res) => {
    try {
      // Validation des données d'entrée
      const userData = req.body;
      
      // Vérifier si l'email existe déjà
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ error: "Un utilisateur avec cet email existe déjà" });
      }
      
      // Hacher le mot de passe
      userData.motDePasse = await bcrypt.hash(userData.motDePasse, 10);
      
      // Créer l'utilisateur
      const newUser = await storage.createUser({
        ...userData,
        role: userData.role || 'membre',
        statut: 'actif',
        dateInscription: new Date().toISOString()
      });
      
      const { motDePasse, ...userWithoutPassword } = newUser;
      
      res.status(201).json({
        message: "Utilisateur créé avec succès",
        user: userWithoutPassword
      });
    } catch (error) {
      console.error('[POST /api/users] ERREUR:', error);
      res.status(500).json({ message: "Erreur serveur lors de la création de l'utilisateur" });
    }
  });

  // Events routes
  app.get("/api/events", authenticateToken, async (req, res) => {
    try {
      const events = await storage.getEvents();
      res.json(events);
    } catch (error) {
      console.error('[GET /api/events] ERREUR:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.get("/api/events/:id", authenticateToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const event = await storage.getEvent(id);
      if (!event) {
        console.error('[GET /api/events/:id] Événement non trouvé:', id);
        return res.status(404).json({ error: "Événement non trouvé" });
      }
      res.json(event);
    } catch (error) {
      console.error('[GET /api/events/:id] ERREUR:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Seules les routes de gestion d'événements sont protégées pour l'admin :
  app.post("/api/events", authenticateToken, requireRole('admin'), async (req, res) => {
    try {
      const eventData = insertEventSchema.parse(req.body);
      const event = await storage.createEvent(eventData);
      
      // Envoyer une notification à tous les membres en arrière-plan
      // Ne pas attendre la fin de l'envoi pour répondre à la requête
      try {
        const { notifyMembersAboutNewEvent } = await import('./utils/notificationHelper');
        notifyMembersAboutNewEvent(event).catch(err => 
          console.error('Erreur lors de l\'envoi des notifications:', err)
        );
      } catch (err) {
        console.error('Erreur lors du chargement du module notificationHelper:', err);
      }
      
      res.status(201).json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        log(`[POST /api/events] ERREUR VALIDATION: ${JSON.stringify(error.errors)}`, "events");
        return res.status(400).json({ message: "Données invalides", errors: error.errors });
      }
      console.error('[POST /api/events] ERREUR:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.put("/api/events/:id", authenticateToken, requireRole('admin'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updatedEvent = await storage.updateEvent(id, req.body);
      if (!updatedEvent) {
        console.error('[PUT /api/events/:id] Événement non trouvé:', id);
        return res.status(404).json({ error: "Événement non trouvé" });
      }
      res.json(updatedEvent);
    } catch (error) {
      console.error('[PUT /api/events/:id] ERREUR:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.delete("/api/events/:id", authenticateToken, requireRole('admin'), async (req, res) => {
    try {
      console.log(`[DELETE /api/events/:id] Début de la suppression pour l'ID: ${req.params.id}`);
      const id = parseInt(req.params.id);
      console.log(`[DELETE /api/events/:id] ID parsé: ${id} (type: ${typeof id})`);
      
      if (isNaN(id)) {
        console.error(`[DELETE /api/events/:id] ID invalide: ${req.params.id}`);
        return res.status(400).json({ error: "ID d'événement invalide" });
      }
      
      console.log(`[DELETE /api/events/:id] Appel de storage.deleteEvent avec l'ID: ${id}`);
      const result = await storage.deleteEvent(id);
      console.log(`[DELETE /api/events/:id] Résultat de deleteEvent:`, result);
      
      if (!result.success) {
        console.error(`[DELETE /api/events/:id] Échec de la suppression: ${result.message}`);
        return res.status(404).json({ 
          success: false,
          message: result.message || "Événement non trouvé" 
        });
      }
      
      console.log(`[DELETE /api/events/:id] Événement supprimé avec succès pour l'ID: ${id}`);
      res.json({ 
        success: true,
        message: result.message || "Événement supprimé avec succès" 
      });
    } catch (error) {
      console.error(`[DELETE /api/events/:id] ERREUR lors de la suppression:`, error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Utilisateurs : accessible à tous les utilisateurs authentifiés
  app.get("/api/users", authenticateToken, async (req, res) => {
    try {
      console.log('[GET /api/users] Requête reçue');
      const users = await storage.getUsers();
      // Retirer les mots de passe avant de renvoyer
      const usersSansMdp = users.map(({ motDePasse, ...u }) => u);
      res.json(usersSansMdp);
    } catch (error) {
      console.error('[GET /api/users] ERREUR:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Member routes (corrected comment)
  app.get("/api/users", authenticateToken, async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      console.error('[GET /api/users] ERREUR:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post("/api/participations", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      console.log('[POST /api/participations] Payload reçu:', req.body);

      // Schéma local: ne pas exiger membreId, il vient du JWT
      const payloadSchema = z.object({
        evenementId: z.union([z.number(), z.string()]),
        nombrePlaces: z.number().min(1, "Le nombre de places doit être au moins 1"),
        montantTotal: z.number().min(0, "Le montant total doit être positif"),
        methodePaiement: z.enum(['carte', 'sur_place']).optional(),
        numeroCarte: z.string().optional(),
        estPaye: z.boolean()
      });
      const parsed = payloadSchema.parse(req.body);

      // Récupérer l'utilisateur à partir du token JWT
      if (!req.user) {
        console.log('[POST /api/participations] Aucun utilisateur dans la requête');
        return res.status(401).json({ message: "Non autorisé" });
      }

      const numericUserId = Number(req.user.id);
      if (isNaN(numericUserId)) {
        console.log(`[POST /api/participations] ID utilisateur invalide: ${req.user.id}`);
        return res.status(400).json({ message: "ID utilisateur invalide" });
      }

      const membre = await storage.getUser(numericUserId);
      if (!membre) {
        console.log(`[POST /api/participations] Utilisateur non trouvé pour id: ${numericUserId}`);
        return res.status(400).json({ message: "Utilisateur non trouvé" });
      }

      // Recherche robuste de l'événement (accepte string ou number)
      const numericEventId = typeof parsed.evenementId === 'string' ? Number(parsed.evenementId) : parsed.evenementId;
      if (isNaN(numericEventId)) {
        console.log(`[POST /api/participations] ID événement invalide: ${parsed.evenementId}`);
        return res.status(400).json({ message: "ID événement invalide" });
      }

      const event = await storage.getEvent(numericEventId);
      if (!event) {
        log(`[POST /api/participations] Événement non trouvé pour id: ${parsed.evenementId}`, "participations");
        return res.status(400).json({ message: "Événement non trouvé" });
      }

      // Construire l'insert à partir des valeurs validées + identités résolues
      const insertParticipation: InsertParticipation = {
        membreId: membre.id,
        evenementId: event.id,
        nombrePlaces: parsed.nombrePlaces,
        montantTotal: parsed.montantTotal,
        methodePaiement: parsed.methodePaiement,
        numeroCarte: parsed.numeroCarte,
        estPaye: parsed.estPaye
      };

      const participation = await storage.createParticipation(insertParticipation);
      log(`[POST /api/participations] Participation créée: ${JSON.stringify(participation)}`, "participations");

      // Notification (best-effort)
      try {
        const eventDetails: string[] = [];
        if (event.date) {
          try {
            const eventDate = new Date(event.date);
            if (!isNaN(eventDate.getTime())) {
              const formattedDate = eventDate.toLocaleDateString('fr-FR', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
              });
              eventDetails.push(`📅 ${formattedDate}`);
            }
          } catch {}
        }
        eventDetails.push(event.lieu && event.lieu.trim() !== '' ? `📍 ${event.lieu.trim()}` : '📍 Lieu à confirmer');

        const notification: InsertNotification = {
          utilisateurId: membre.id,
          titre: '🎉 Inscription confirmée !',
          message: `Votre inscription à l'événement "${event.titre || 'sans titre'}" est confirmée.\n\n${eventDetails.join('\n')}\n\nMerci de votre participation !`,
          lue: false,
          lien: `/events/${event.id}`
        };
        await storage.createNotification(notification);
      } catch (notificationError) {
        console.error('[POST /api/participations] Erreur lors de la création de la notification:', notificationError);
      }

      res.status(201).json(participation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        log(`[POST /api/participations] ERREUR VALIDATION: ${JSON.stringify(error.errors)}`, "participations");
        return res.status(400).json({ message: "Données invalides", errors: error.errors });
      }
      if (error instanceof Error) {
        // Retourner le message d'erreur métier pour que le front puisse l'afficher
        log(`[POST /api/participations] ERREUR: ${error.message}`, "participations");
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.delete("/api/participations/:id", authenticateToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteParticipation(id);
      if (!deleted) {
        return res.status(404).json({ message: "Participation non trouvée" });
      }
      // Notification best-effort : désinscription
      try {
        if (req.user?.id) {
          const notification: InsertNotification = {
            utilisateurId: req.user.id,
            titre: '❌ Désinscription effectuée',
            message: `Votre désinscription de l'événement a été prise en compte.`,
            lue: false
          };
          await storage.createNotification(notification);
        }
      } catch (e) {
        console.warn('[DELETE /api/participations/:id] Notification non créée:', e);
      }
      res.json({ message: "Participation supprimée avec succès" });
    } catch (error) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Participations routes (consolidated)
  app.get("/api/participations", authenticateToken, async (req, res) => {
    try {
      const participations = await storage.getParticipations();
      res.json(participations);
    } catch (error) {
      console.error('[GET /api/participations] ERREUR:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.get("/api/participations/member/:memberId", authenticateToken, async (req, res) => {
    try {
      const memberId = parseInt(req.params.memberId);
      const participations = await storage.getParticipationsByMember(memberId);
      res.json(participations);
    } catch (error) {
      console.error('[GET /api/participations/member/:memberId] ERREUR:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.get("/api/participations/event/:eventId", authenticateToken, async (req, res) => {
    try {
      const eventId = parseInt(req.params.eventId);
      const participations = await storage.getParticipationsByEvent(eventId);
      res.json(participations);
    } catch (error) {
      console.error('[GET /api/participations/event/:eventId] ERREUR:', error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Payments routes
  app.get("/api/payments", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      // Admin: accès à tous les paiements
      if (req.user?.role === 'admin') {
        const payments = await storage.getPayments();
        return res.json(payments);
      }
      // Membre: ne voir que ses propres paiements
      const payments = await storage.getPaymentsByMember(req.user!.id);
      return res.json(payments);
    } catch (error) {
      return res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.get("/api/payments/member/:memberId", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const memberId = parseInt(req.params.memberId);
      // Autoriser uniquement l'admin ou le membre concerné
      if (req.user?.role !== 'admin' && req.user?.id !== memberId) {
        return res.status(403).json({ message: "Accès refusé" });
      }
      const payments = await storage.getPaymentsByMember(memberId);
      return res.json(payments);
    } catch (error) {
      return res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post("/api/payments", authenticateToken, async (req, res) => {
    try {
      const paymentData = insertPaymentSchema.parse(req.body);
      const payment = await storage.createPayment(paymentData);
      // Notification best-effort : paiement
      try {
        const { membreId, evenementId, montant, methode, statut } = paymentData;
        const notification: InsertNotification = {
          utilisateurId: membreId,
          titre: statut === 'paye' ? '💳 Paiement confirmé' : '🧾 Paiement enregistré',
          message: `Votre paiement de ${montant} DT pour l'événement #${evenementId} a été ${statut === 'paye' ? 'confirmé' : 'enregistré'}.` ,
          lue: false,
        };
        await storage.createNotification(notification);
      } catch (e) {
        console.warn('[POST /api/payments] Notification non créée:', e);
      }
      res.status(201).json(payment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Données invalides", errors: error.errors });
      }
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.put("/api/payments/:id", authenticateToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updatedPayment = await storage.updatePayment(id, req.body);
      if (!updatedPayment) {
        return res.status(404).json({ message: "Paiement non trouvé" });
      }
      res.json(updatedPayment);
    } catch (error) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Notifications routes
  app.get("/api/notifications", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const notifications = await storage.getNotificationsByUser(req.user.id);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post("/api/notifications", authenticateToken, async (req, res) => {
    try {
      const notificationData = insertNotificationSchema.parse(req.body);
      const notification = await storage.createNotification(notificationData);
      res.status(201).json(notification);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Données invalides", errors: error.errors });
      }
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.put("/api/notifications/:id/read", authenticateToken, async (req, res) => {
    try {
      const idParam = req.params.id; // conserve tel quel (peut être numérique ou ObjectId)
      const updated = await storage.markNotificationAsRead(idParam as any);
      if (!updated) {
        return res.status(404).json({ message: "Notification non trouvée" });
      }
      res.json({ message: "Notification marquée comme lue" });
    } catch (error) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.delete("/api/notifications/:id", authenticateToken, async (req, res) => {
    try {
      const idParam = req.params.id; // conserve tel quel (peut être numérique ou ObjectId)
      const deleted = await storage.deleteNotification(idParam as any);
      if (!deleted) {
        return res.status(404).json({ message: "Notification non trouvée" });
      }
      res.json({ message: "Notification supprimée avec succès" });
    } catch (error) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Stats route
  app.get("/api/stats", authenticateToken, async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
