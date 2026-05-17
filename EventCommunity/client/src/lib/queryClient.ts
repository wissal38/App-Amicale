import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

interface ApiResponse<T = any> {
  success?: boolean;
  data?: T;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  message?: string;
  error?: string;
  // Propriétés pour les réponses d'authentification
  token?: string;
  user?: T;
  // Propriétés pour la compatibilité avec les réponses d'API existantes
  ok?: boolean;
  json?: () => Promise<any>;
}

export async function apiRequest<T = any>(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem("token");
  // Créer un objet d'en-têtes de base
  const headers: Record<string, string> = {
    'Accept': 'application/json'
  };
  
  // Ajouter le Content-Type uniquement si des données sont fournies
  if (data) {
    headers['Content-Type'] = 'application/json';
  }
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  console.log(`[API Request] ${method} ${url}`, { headers, data });
  
  try {
    // Utiliser des URLs relatives pour éviter les problèmes de cross-origin (localhost vs 127.0.0.1)
    // Si une URL absolue est fournie, on la respecte, sinon on garde le chemin relatif
    const apiUrl = url.startsWith('http') ? url : `${url.startsWith('/') ? '' : '/'}${url}`;
    const res = await fetch(apiUrl, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: 'include',
      mode: 'cors',
    });
    
    // Créer un objet simple pour les en-têtes pour éviter les problèmes de type
    const headersObj: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headersObj[key] = value;
    });
    
    // Essayer de parser la réponse en JSON
    let responseData: any = {};
    const contentType = res.headers.get('content-type');
    
    // Ne tenter de parser le JSON que si le content-type est application/json
    if (contentType && contentType.includes('application/json')) {
      try {
        responseData = await res.json();
      } catch (e) {
        console.warn('Failed to parse JSON response', e);
      }
    }
    
    // Pour les réponses DELETE sans contenu, retourner un objet de succès
    if (res.status === 204 || (res.ok && method === 'DELETE' && Object.keys(responseData).length === 0)) {
      return { success: true, message: 'Opération effectuée avec succès' } as unknown as ApiResponse<T>;
    }
    
    console.log(`[API Response] ${method} ${url}`, { 
      status: res.status, 
      statusText: res.statusText,
      headers: headersObj,
      data: responseData
    });

    if (!res.ok) {
      // Si le statut est 401 (non autorisé), on supprime le token et on redirige vers la page de connexion
      if (res.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "/login";
        throw new Error(responseData.message || "Session expirée. Veuillez vous reconnecter.");
      }

      // Pour les autres erreurs, on essaie d'extraire le message d'erreur de la réponse
      const errorMessage = responseData?.message || responseData?.error || `Erreur ${res.status}: ${res.statusText}`;
      const error = new Error(errorMessage);
      (error as any).status = res.status;
      throw error;
    }

    // Pour la route de login, s'assurer que le token est inclus dans la réponse
    if (url === '/auth/login' && responseData.token) {
      // Le backend renvoie déjà le format attendu, donc on peut le retourner tel quel
      return responseData as ApiResponse<T>;
    }

    // Pour les autres réponses, retourner les données formatées
    return responseData as ApiResponse<T>;
  } catch (error) {
    console.error(`[API Error] ${method} ${url}`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Récupère le token JWT depuis le localStorage
    const token = localStorage.getItem("token");
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    
    const res = await fetch(queryKey.join("/") as string, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});