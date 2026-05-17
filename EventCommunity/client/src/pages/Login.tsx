// Importation des hooks et bibliothèques nécessaires
import { useState } from "react"; // Hook pour gérer l'état local
import { useAuth } from "@/contexts/AuthContext"; // Contexte d'authentification
import { Redirect } from "wouter"; // Composant pour rediriger
// Importation des composants UI pour les cartes, boutons, inputs, etc.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Composants pour les onglets
import { Form, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"; // Composants pour les formulaires
import { useForm } from "react-hook-form"; // Hook pour gérer les formulaires
import { zodResolver } from "@hookform/resolvers/zod"; // Résolveur pour la validation Zod
import { loginSchema, registerSchema } from "@shared/schema"; // Schémas de validation
import { z } from "zod"; // Bibliothèque de validation
import { Users } from "lucide-react"; // Icône pour les utilisateurs

// Types déduits des schémas pour les formulaires
type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;

// Composant principal pour la page de connexion/inscription
export default function Login() {
  // Récupération des fonctions d'authentification depuis le contexte
  const { user, login, register, isLoading } = useAuth();
  // État pour l'onglet actif (connexion ou inscription)
  const [activeTab, setActiveTab] = useState("login");

  // Configuration du formulaire de connexion avec validation
  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema), // Utilise le schéma pour la validation
    defaultValues: {
      email: "",
      motDePasse: "",
    },
  });

  // Configuration du formulaire d'inscription avec validation
  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema), // Utilise le schéma pour la validation
    defaultValues: {
      nom: "",
      prenom: "",
      email: "",
      motDePasse: "",
      confirmPassword: "",
    },
  });

  // Si l'utilisateur est déjà connecté, rediriger vers la page d'accueil
  if (user) {
    return <Redirect to="/" />;
  }

  // Fonction appelée lors de la soumission du formulaire de connexion
  const onLogin = async (data: LoginFormData) => {
    await login(data.email, data.motDePasse);
  };

  // Fonction appelée lors de la soumission du formulaire d'inscription
  const onRegister = async (data: RegisterFormData) => {
    await register(data);
    setActiveTab("login"); // Passer à l'onglet de connexion après inscription
  };

  // Rendu du composant : interface de connexion/inscription
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4"> {/* Conteneur principal centré */}
      <Card className="w-full max-w-md"> {/* Carte principale avec largeur maximale */}
        <CardHeader className="text-center"> {/* En-tête centré */}
          <div className="flex justify-center mb-4"> {/* Logo de l'application */}
            <div className="w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center">
              <Users className="text-white" size={24} />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Amicale</CardTitle> {/* Titre de l'application */}
          <p className="text-gray-600">Gestion des membres</p> {/* Description */}
        </CardHeader>
        <CardContent> {/* Contenu de la carte */}
          <Tabs value={activeTab} onValueChange={setActiveTab}> {/* Onglets pour connexion/inscription */}
            <TabsList className="grid w-full grid-cols-2"> {/* Liste des onglets */}
              <TabsTrigger value="login">Connexion</TabsTrigger>
              <TabsTrigger value="register">Inscription</TabsTrigger>
            </TabsList>
            
            {/* Onglet de connexion */}
            <TabsContent value="login">
              <Form {...loginForm}> {/* Formulaire de connexion avec react-hook-form */}
                <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4"> {/* Formulaire HTML */}
                  <FormItem> {/* Champ email */}
                    <FormLabel htmlFor="email">Email</FormLabel>
                    <FormControl>
                      <Input
                        id="email"
                        type="email"
                        {...loginForm.register("email")} // Enregistrement du champ avec validation
                      />
                    </FormControl>
                    <FormMessage>{loginForm.formState.errors.email?.message}</FormMessage> {/* Message d'erreur */}
                  </FormItem>
                  <FormItem> {/* Champ mot de passe */}
                    <FormLabel htmlFor="motDePasse">Mot de passe</FormLabel>
                    <FormControl>
                      <Input
                        id="motDePasse"
                        type="password"
                        {...loginForm.register("motDePasse")}
                      />
                    </FormControl>
                    <FormMessage>{loginForm.formState.errors.motDePasse?.message}</FormMessage>
                  </FormItem>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading} // Désactiver pendant le chargement
                  >
                    {isLoading ? "Connexion..." : "Se connecter"} {/* Texte dynamique selon l'état */}
                  </Button>
                </form>
              </Form>
              {/* Informations de compte de test */}
              <div className="mt-4 text-center text-sm text-gray-600">
                <p>Compte de test:</p>
                <p>Email: admin@amicale.com</p>
                <p>Mot de passe: admin123</p>
              </div>
            </TabsContent>
            
            {/* Onglet d'inscription */}
            <TabsContent value="register">
              <Form {...registerForm}> {/* Formulaire d'inscription */}
                <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4"> {/* Grille pour prénom et nom */}
                    <FormItem> {/* Champ prénom */}
                      <FormLabel htmlFor="prenom">Prénom</FormLabel>
                      <FormControl>
                        <Input
                          id="prenom"
                          {...registerForm.register("prenom")}
                        />
                      </FormControl>
                      <FormMessage>{registerForm.formState.errors.prenom?.message}</FormMessage>
                    </FormItem>
                    <FormItem> {/* Champ nom */}
                      <FormLabel htmlFor="nom">Nom</FormLabel>
                      <FormControl>
                        <Input
                          id="nom"
                          {...registerForm.register("nom")}
                        />
                      </FormControl>
                      <FormMessage>{registerForm.formState.errors.nom?.message}</FormMessage>
                    </FormItem>
                  </div>
                  <FormItem> {/* Champ email */}
                    <FormLabel htmlFor="email">Email</FormLabel>
                    <FormControl>
                      <Input
                        id="email"
                        type="email"
                        {...registerForm.register("email")}
                      />
                    </FormControl>
                    <FormMessage>{registerForm.formState.errors.email?.message}</FormMessage>
                  </FormItem>
                  <FormItem> {/* Champ téléphone */}
                    <FormLabel htmlFor="telephone">Téléphone</FormLabel>
                    <FormControl>
                      <Input
                        id="telephone"
                        {...registerForm.register("telephone")}
                      />
                    </FormControl>
                    <FormMessage>{registerForm.formState.errors.telephone?.message}</FormMessage>
                  </FormItem>
                  <FormItem> {/* Champ mot de passe */}
                    <FormLabel htmlFor="motDePasse">Mot de passe</FormLabel>
                    <FormControl>
                      <Input
                        id="motDePasse"
                        type="password"
                        {...registerForm.register("motDePasse")}
                      />
                    </FormControl>
                    <FormMessage>{registerForm.formState.errors.motDePasse?.message}</FormMessage>
                  </FormItem>
                  <FormItem> {/* Champ confirmation mot de passe */}
                    <FormLabel htmlFor="confirmPassword">Confirmer le mot de passe</FormLabel>
                    <FormControl>
                      <Input
                        id="confirmPassword"
                        type="password"
                        {...registerForm.register("confirmPassword")}
                      />
                    </FormControl>
                    <FormMessage>{registerForm.formState.errors.confirmPassword?.message}</FormMessage>
                  </FormItem>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? "Inscription..." : "S'inscrire"}
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
