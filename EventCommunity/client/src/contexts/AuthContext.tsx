import { createContext, useContext, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  role: string;
  statut?: string;
  dateInscription?: string;
  telephone?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, motDePasse: string) => Promise<void>;
  register: (userData: any) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check if user is already logged in
  const { data: currentUser, isLoading, error } = useQuery<Partial<User>>({
    queryKey: ["/api/auth/me"],
    enabled: !!localStorage.getItem("token"),
    retry: false,
  });

  useEffect(() => {
    console.log('Current user changed:', { currentUser, error }); // Pour le débogage
    
    if (currentUser && currentUser.id && currentUser.email) {
      // Vérifier si l'utilisateur a les propriétés minimales requises
      const hasNameProperties = currentUser.nom && currentUser.prenom;
      const hasFullName = (currentUser as any).name;
      
      // Normaliser les données utilisateur avant de les stocker
      const normalizedUser: User = {
        id: currentUser.id,
        nom: currentUser.nom || (hasFullName ? (currentUser as any).name.split(' ').slice(0, -1).join(' ') : 'Utilisateur'),
        prenom: currentUser.prenom || (hasFullName ? (currentUser as any).name.split(' ').pop() : ''),
        email: currentUser.email,
        role: currentUser.role || 'user',
        ...(currentUser.statut && { statut: currentUser.statut }),
        ...(currentUser.dateInscription && { dateInscription: currentUser.dateInscription }),
        ...(currentUser.telephone && { telephone: currentUser.telephone }),
      };
      
      setUser(normalizedUser);
    } else if (error) {
      console.error('Error fetching current user:', error);
      // Déconnecter l'utilisateur en cas d'erreur
      if (user !== null) {
        setUser(null);
      }
      localStorage.removeItem("token");
      queryClient.clear();
    }
  }, [currentUser, error, queryClient]);

  interface LoginResponse {
    token: string;
    user: {
      id: number;
      nom?: string;
      prenom?: string;
      email: string;
      role: string;
      statut?: string;
      dateInscription?: string;
      telephone?: string;
      name?: string;
    };
  }

  const loginMutation = useMutation<LoginResponse, Error, { email: string; motDePasse: string }>({
    mutationFn: async ({ email, motDePasse }) => {
      try {
        const response = await api.login<LoginResponse>({ email, motDePasse });
        console.log('Login API Response:', response);
        
        // Vérifier si la réponse contient un token
        if (!response || !response.token) {
          throw new Error("Token d'authentification manquant dans la réponse");
        }
        
        // Vérifier si les données utilisateur sont présentes
        if (!response.user || response.user.id === undefined) {
          throw new Error("Données utilisateur manquantes dans la réponse");
        }
        
        // Stocker le token dans le localStorage
        localStorage.setItem("token", response.token);
        
        // Retourner les données pour onSuccess
        return response;
      } catch (error) {
        console.error('Login API Error:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log('Login success data:', data);
      
      // Vérifier que le token est bien présent
      if (!data.token) {
        console.error('Token manquant dans la réponse de connexion');
        throw new Error("Erreur d'authentification: token manquant");
      }
      
      // Normaliser les données utilisateur
      const userData = data.user;
      const normalizedUser: User = {
        id: userData.id,
        nom: userData.nom || userData.name?.split(' ').slice(0, -1).join(' ') || '',
        prenom: userData.prenom || userData.name?.split(' ').pop() || '',
        email: userData.email,
        role: userData.role || 'user',
        ...(userData.statut && { statut: userData.statut }),
        ...(userData.dateInscription && { dateInscription: userData.dateInscription }),
        ...(userData.telephone && { telephone: userData.telephone }),
      };
      
      // Mettre à jour l'état avec l'utilisateur connecté
      setUser(normalizedUser);
      queryClient.setQueryData(["/api/auth/me"], normalizedUser);
      
      // Afficher un message de succès
      toast({
        title: "Connexion réussie",
        description: `Bienvenue ${normalizedUser.prenom || ''} !`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur de connexion",
        description: error.message || "Identifiants invalides",
        variant: "destructive",
      });
    },
  });

  interface RegisterResponse {
    success: boolean;
    message: string;
    user?: {
      id: number;
      nom?: string;
      prenom?: string;
      email: string;
      role: string;
      statut?: string;
      dateInscription?: string;
      telephone?: string;
      name?: string;
    };
    token?: string;
  }

  const registerMutation = useMutation<RegisterResponse, Error, any>({
    mutationFn: async (userData) => {
      try {
        const response = await api.register<RegisterResponse>(userData);
        console.log('Register API Response:', response);
        
        if (!response) {
          throw new Error("Réponse d'inscription invalide");
        }
        
        return response;
      } catch (error) {
        console.error('Register API Error:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log('Register success data:', data);
      
      // Afficher un message de succès
      toast({
        title: data.success ? "Inscription réussie" : "Information",
        description: data.message || "Votre compte a été créé avec succès",
        variant: data.success ? "default" : "destructive"
      });
      
      // Si l'utilisateur est inclus dans la réponse, on le connecte automatiquement
      if (data.user && data.token) {
        const userData = data.user;
        
        // Normaliser les données utilisateur
        const normalizedUser: User = {
          id: userData.id,
          nom: userData.nom || userData.name?.split(' ').slice(0, -1).join(' ') || '',
          prenom: userData.prenom || userData.name?.split(' ').pop() || '',
          email: userData.email,
          role: userData.role || 'user',
          ...(userData.statut && { statut: userData.statut }),
          ...(userData.dateInscription && { dateInscription: userData.dateInscription }),
          ...(userData.telephone && { telephone: userData.telephone }),
        };
        
        // Stocker le token et mettre à jour l'état
        localStorage.setItem("token", data.token);
        setUser(normalizedUser);
        queryClient.setQueryData(["/api/auth/me"], normalizedUser);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Erreur d'inscription",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
    },
  });

  const login = async (email: string, motDePasse: string) => {
    await loginMutation.mutateAsync({ email, motDePasse });
  };

  const register = async (userData: any) => {
    await registerMutation.mutateAsync(userData);
  };

  const logout = () => {
    try {
      // Clear all local storage items related to authentication
      localStorage.removeItem("token");
      
      // Clear all query cache
      queryClient.clear();
      
      // Reset user state
      setUser(null);
      
      // Invalidate all queries to ensure fresh data on next login
      queryClient.invalidateQueries();
      
      // Redirect to login page
      window.location.href = "/login";
      
      toast({
        title: "Déconnexion réussie",
        description: "Vous avez été déconnecté avec succès",
      });
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la déconnexion",
        variant: "destructive",
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        logout,
        isLoading: isLoading || loginMutation.isPending || registerMutation.isPending,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export { AuthContext };
