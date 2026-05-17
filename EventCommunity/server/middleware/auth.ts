// Ce fichier est réservé à la logique middleware côté serveur (Node.js/Express). Aucun code React/JSX ne doit être ici.
// Placez vos middlewares d'authentification ici si besoin.

// Middleware d'authentification pour Express
// Ajoute req.user si l'utilisateur est authentifié (exemple simple avec JWT)
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// À adapter avec votre clé secrète
const SECRET = process.env.JWT_SECRET || "votre_secret";

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

// Étend l'objet Request pour inclure user
declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

export function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, SECRET) as AuthUser;
      req.user = decoded;
      return next();
    } catch (err) {
      return res.status(403).json({ message: "Token invalide" });
    }
  }
  return res.status(401).json({ message: "Non authentifié" });
}

// Utilisation dans vos routes :
// app.use(authenticateJWT); // pour protéger toutes les routes
// app.use('/api/admin', authenticateJWT, requireRole('admin'));