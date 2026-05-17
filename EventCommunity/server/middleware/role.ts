// Middleware d'authentification et de gestion des rôles pour Express
// Usage : app.use('/api/route', requireRole('admin'))

import { Request, Response, NextFunction } from "express";

// Vérifie que l'utilisateur est authentifié et a le bon rôle
export function requireRole(role: 'admin' | 'membre') {
  return (req: Request, res: Response, next: NextFunction) => {
    // Supposons que req.user est défini par un middleware d'authentification précédent
    const user = req.user as { role?: string };
    if (!user) {
      return res.status(401).json({ message: "Non authentifié" });
    }
    if (user.role !== role) {
      return res.status(403).json({ message: "Accès interdit : rôle insuffisant" });
    }
    next();
  };
}

// Exemple d'utilisation dans vos routes Express :
// router.post('/notifications', requireRole('admin'), sendNotificationHandler);
// router.post('/evenements', requireRole('admin'), createEventHandler);
// router.get('/participants', requireRole('admin'), getParticipantsHandler);
// router.get('/membres', requireRole('admin'), manageMembersHandler);
// router.get('/paiements', requireRole('membre'), getPaymentsHandler);
