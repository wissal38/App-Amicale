# Application de Gestion d'Événements d'Amicale

## Description
Application complète de gestion d'événements pour une amicale d'entreprise avec frontend React moderne et backend Express.js + MongoDB.

## Fonctionnalités
- 🔐 Authentification JWT (admin/membre)
- 📅 Gestion complète des événements
- 👥 Gestion des membres
- 💳 Suivi des paiements
- 📊 Tableau de bord avec statistiques
- 🔔 Système de notifications
- 📱 Interface responsive

## Configuration MongoDB

### 1. Installer MongoDB
```bash
# Sur Ubuntu/Debian
sudo apt update
sudo apt install mongodb

# Sur macOS avec Homebrew
brew install mongodb-community

# Sur Windows, télécharger depuis mongodb.com
```

### 2. Démarrer MongoDB
```bash
# Démarrer le service MongoDB
sudo systemctl start mongod

# Vérifier le statut
sudo systemctl status mongod

# Ou démarrer manuellement
mongod --dbpath /path/to/your/data/directory
```

### 3. Configuration de l'application
Créer un fichier `.env` à la racine du projet :

```env
MONGODB_URI=mongodb://localhost:27017/applicationamicale
JWT_SECRET=votre_secret_jwt_super_secret
NODE_ENV=development
```

## Installation et Compilation

### 1. Cloner/Télécharger le projet
```bash
git clone <url-du-projet>
cd application-amicale
```

### 2. Installer les dépendances
```bash
npm install
```

### 3. Lancer l'application

#### Mode développement (recommandé)
```bash
npm run dev
```
L'application sera disponible sur `http://localhost:5000`

#### Mode production
```bash
# Compiler l'application
npm run build

# Lancer en production
npm start
```

## Structure du Projet

```
├── client/              # Frontend React
│   ├── src/
│   │   ├── components/  # Composants réutilisables
│   │   ├── pages/       # Pages de l'application
│   │   ├── contexts/    # Contextes React
│   │   ├── hooks/       # Hooks personnalisés
│   │   └── lib/         # Utilitaires
├── server/              # Backend Express
│   ├── index.ts         # Point d'entrée
│   ├── routes.ts        # Routes API
│   ├── mongodb.ts       # Configuration MongoDB
│   ├── mongodb-storage.ts # Implémentation MongoDB
│   └── storage.ts       # Interface de stockage
├── shared/              # Types partagés
│   └── schema.ts        # Schémas Zod et types
└── package.json         # Configuration npm
```

## Utilisation

### 1. Première connexion
- Email : `admin@amicale.com`
- Mot de passe : `admin123`

### 2. Test d'inscription d'un membre

#### Via l'interface web :
1. Aller sur `http://localhost:5000`
2. Cliquer sur "S'inscrire"
3. Remplir le formulaire d'inscription
4. Vérifier dans MongoDB

#### Via MongoDB Shell :
```bash
# Ouvrir le shell MongoDB
mongo

# Utiliser la base de données
use applicationamicale

# Voir tous les utilisateurs
db.users.find().pretty()

# Chercher un utilisateur spécifique
db.users.findOne({email: "test@example.com"})

# Compter le nombre d'utilisateurs
db.users.countDocuments()
```

### 3. Vérification des données

#### Voir toutes les collections :
```bash
mongo
use applicationamicale
show collections
```

#### Vérifier les données :
```bash
# Utilisateurs
db.users.find().pretty()

# Événements
db.events.find().pretty()

# Participations
db.participations.find().pretty()

# Paiements
db.payments.find().pretty()

# Notifications
db.notifications.find().pretty()
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Connexion
- `POST /api/auth/register` - Inscription
- `GET /api/auth/me` - Profil utilisateur

### Users
- `GET /api/users` - Liste des utilisateurs
- `GET /api/users/:id` - Utilisateur spécifique
- `POST /api/users` - Créer un utilisateur
- `PUT /api/users/:id` - Modifier un utilisateur
- `DELETE /api/users/:id` - Supprimer un utilisateur

### Events
- `GET /api/events` - Liste des événements
- `GET /api/events/:id` - Événement spécifique
- `POST /api/events` - Créer un événement
- `PUT /api/events/:id` - Modifier un événement
- `DELETE /api/events/:id` - Supprimer un événement

### Participations
- `GET /api/participations` - Liste des participations
- `GET /api/participations/member/:id` - Membred'un membre
- `GET /api/participations/event/:id` - Membreà un événement
- `POST /api/participations` - Créer une participation
- `DELETE /api/participations/:id` - Supprimer une participation

### Payments
- `GET /api/payments` - Liste des paiements
- `GET /api/payments/member/:id` - Paiements d'un membre
- `POST /api/payments` - Créer un paiement
- `PUT /api/payments/:id` - Modifier un paiement

### Notifications
- `GET /api/notifications` - Notifications de l'utilisateur
- `POST /api/notifications` - Créer une notification
- `PUT /api/notifications/:id/read` - Marquer comme lu
- `DELETE /api/notifications/:id` - Supprimer une notification

## Développement

### Scripts disponibles
```bash
npm run dev      # Développement avec rechargement automatique
npm run build    # Compilation pour production
npm start        # Lancement en mode production
npm run check    # Vérification TypeScript
```

### Technologies utilisées
- **Frontend** : React 18, TypeScript, Tailwind CSS, shadcn/ui
- **Backend** : Express.js, MongoDB, Mongoose
- **Authentification** : JWT, bcryptjs
- **Validation** : Zod
- **Build** : Vite, esbuild

## Support

Pour toute question ou problème, vérifiez :
1. MongoDB est bien démarré
2. Les variables d'environnement sont configurées
3. Les dépendances sont installées
4. Le port 5000 est libre

## Sécurité

- Changez le `JWT_SECRET` en production
- Utilisez HTTPS en production
- Configurez MongoDB avec authentification
- Validez toujours les données côté serveur