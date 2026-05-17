// Importation des composants UI pour la carte
import { Card, CardContent } from "@/components/ui/card";
// Importation de l'icône AlertCircle de Lucide React
import { AlertCircle } from "lucide-react";

// Composant pour la page 404 - Page non trouvée
export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50"> {/* Conteneur plein écran centré avec fond gris */}
      <Card className="w-full max-w-md mx-4"> {/* Carte avec largeur maximale de 28rem et marges latérales */}
        <CardContent className="pt-6"> {/* Contenu de la carte avec padding top */}
          <div className="flex mb-4 gap-2"> {/* En-tête avec icône et titre */}
            <AlertCircle className="h-8 w-8 text-red-500" /> {/* Icône d'alerte rouge */}
            <h1 className="text-2xl font-bold text-gray-900">404 Page Not Found</h1> {/* Titre de la page d'erreur */}
          </div>

          <p className="mt-4 text-sm text-gray-600"> {/* Message explicatif */}
            Did you forget to add the page to the router? {/* Question suggérant d'ajouter la page au routeur */}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
