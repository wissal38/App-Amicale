// Importation des hooks React et bibliothèques nécessaires
import React, { useState, useEffect, useCallback } from "react"; // Hooks pour gérer l'état et les effets
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"; // Hooks pour les requêtes de données
// Importation des composants UI pour les cartes, boutons, badges
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// Importation du hook pour les notifications toast
import { useToast } from "@/hooks/use-toast";
// Importation de la modale pour créer/éditer des événements
import EventModal from "@/components/modals/EventModal";
// Importation des icônes Lucide React
import { Calendar, MapPin, Users, Plus, Edit, Trash2, UserPlus, CreditCard, AlertCircle } from "lucide-react";
// Importation des types depuis le schéma partagé
import { Event, Participation } from "@shared/schema";
// Importation du contexte d'authentification
import { useAuth } from "@/contexts/AuthContext";
// Importation de l'API pour les requêtes
import { api } from "@/lib/api";

// Définition du type pour les réponses API
type ApiResponse<T = any> = {
  success: boolean; // Indique si la requête a réussi
  data?: T; // Données de réponse optionnelles
  error?: string; // Message d'erreur optionnel
  message?: string; // Message informatif optionnel
};

// Composant principal pour la page des événements
export default function Events() {
  // États locaux pour gérer les modales et les événements sélectionnés
  const [eventModalOpen, setEventModalOpen] = useState(false); // État pour la modale d'événement
  const [editingEvent, setEditingEvent] = useState<Event | null>(null); // Événement en cours d'édition
  const [showRegistrationModal, setShowRegistrationModal] = useState(false); // État pour la modale d'inscription
  const [showPaymentModal, setShowPaymentModal] = useState(false); // État pour la modale de paiement
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null); // Événement sélectionné
  // État optimiste pour afficher immédiatement l'inscription réussie
  const [optimisticRegistered, setOptimisticRegistered] = useState<Set<number>>(new Set());
  // Récupération de l'utilisateur connecté
  const { user } = useAuth();
  // Hook pour afficher des notifications
  const { toast } = useToast();
  // Client pour invalider les requêtes
  const queryClient = useQueryClient();

  // Requête pour récupérer la liste des événements
  const eventsQuery = useQuery<Event[]>({
    queryKey: ["/api/events"], // Clé unique pour cette requête
    retry: 3, // Nombre de tentatives en cas d'échec
    retryDelay: 1000, // Délai entre les tentatives
    staleTime: 30000, // Temps pendant lequel les données sont considérées comme fraîches
  });

  

  // Mutation pour se désinscrire d'un événement
  const cancelParticipationMutation = useMutation({
    mutationFn: async (eventId: number) => {
      // Vérification que l'utilisateur est connecté
      if (!user?.id) {
        throw new Error("Vous devez être connecté pour vous désinscrire.");
      }
      // Conversion de l'ID utilisateur en nombre
      const uid = Number(user.id);
      if (isNaN(uid)) throw new Error("Session utilisateur invalide.");

      // Recherche de la participation de l'utilisateur pour cet événement
      const participation = participations.find(
        (p) => Number(p.evenementId) === Number(eventId) && Number(p.membreId) === uid
      );
      if (!participation || participation.id == null) {
        throw new Error("Aucune participation trouvée pour cet événement.");
      }

      // Requête DELETE pour supprimer la participation
      const resp = await fetch(`/api/participations/${participation.id}` , {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      let data: any = null;
      try {
        data = await resp.json();
      } catch {}

      if (!resp.ok) {
        const msg = (data && (data.message || data.error)) || `Erreur serveur (${resp.status})`;
        throw new Error(msg);
      }
      return data || { success: true };
    },
    onSuccess: () => {
      // Invalidation des requêtes pour rafraîchir les données
      queryClient.invalidateQueries({ queryKey: ["/api/participations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      // Affichage d'une notification de succès
      toast({
        title: "Désinscription réussie",
        description: "Vous n'êtes plus inscrit à cet événement.",
      });
      // Fermeture de la modale d'inscription si elle était ouverte
      setShowRegistrationModal(false);
      setSelectedEvent(null);
    },
    onError: (error: any) => {
      // Affichage d'une notification d'erreur
      toast({
        title: "Erreur de désinscription",
        description: error?.message || "Impossible de se désinscrire pour le moment",
        variant: "destructive",
      });
    }
  });
  
  React.useEffect(() => {
    if (eventsQuery.data) {
      console.log("✅ [Events] Événements chargés avec succès:", eventsQuery.data.length, "événements");
    }
    
    if (eventsQuery.error) {
      console.error("❌ [Events] Erreur lors du chargement des événements:", eventsQuery.error);
      toast({
        title: "Erreur de chargement",
        description: "Impossible de charger les événements",
        variant: "destructive",
      });
    }
  }, [eventsQuery.data, eventsQuery.error, toast]);
  
  const events = React.useMemo(() => {
    if (!eventsQuery.data) return [];
    return eventsQuery.data.filter(event => event && event.id && event.titre);
  }, [eventsQuery.data]);
  
  const { data: participations = [] } = useQuery<Participation[]>({
    queryKey: ["/api/participations"],
    enabled: !!user,
  });
  
  // Fermer la modale d'inscription si l'utilisateur est déjà inscrit (évite une 400 inutile)
  useEffect(() => {
    if (showRegistrationModal && selectedEvent && isUserRegistered(selectedEvent.id)) {
      setShowRegistrationModal(false);
      setSelectedEvent(null);
      toast({
        title: "Information",
        description: "Vous êtes déjà inscrit à cet événement",
      });
    }
  }, [showRegistrationModal, selectedEvent, participations]);
  
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
    enabled: !!user,
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      if (!eventId || isNaN(eventId)) {
        throw new Error(`ID d'événement invalide: ${eventId}`);
      }
      
      const eventExists = events.find(event => event.id === eventId);
      if (!eventExists) {
        throw new Error(`Événement avec l'ID ${eventId} non trouvé`);
      }
      
      try {
        const response = await api.deleteEvent(eventId);
        if (!response.success) {
          throw new Error(response.message || 'Échec de la suppression');
        }
        return { ...response, event: eventExists };
      } catch (error: any) {
        if (error.response?.status === 404) {
          throw new Error(`Événement non trouvé dans la base de données (ID: ${eventId})`);
        } else if (error.response?.status === 500) {
          throw new Error(`Erreur serveur lors de la suppression: ${error.response.data?.message || 'Erreur inconnue'}`);
        } else if (error.message) {
          throw error; // Re-lancer les erreurs déjà formatées
        } else {
          throw new Error(`Impossible de supprimer: ${error.message || 'Erreur inconnue'}`);
        }
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({
        title: "Succès",
        description: data.message || `L'événement a été supprimé avec succès`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur de suppression",
        description: error.message || 'Une erreur est survenue lors de la suppression',
        variant: "destructive",
      });
    },
  });

  interface RegisterForEventPayload {
    eventId: number;
    nombrePlaces: number;
    modePaiement: "sur_place" | "carte";
    numeroCarte?: string;
  }

  const registerForEventMutation = useMutation<ApiResponse, Error, RegisterForEventPayload>({
    mutationFn: async ({ eventId, nombrePlaces, modePaiement, numeroCarte }): Promise<ApiResponse> => {
      // Validation de l'utilisateur connecté
      if (!user?.id) {
        throw new Error("Vous devez être connecté pour vous inscrire à un événement.");
      }

      // Validation de l'ID utilisateur
      const userId = Number(user.id);
      if (isNaN(userId) || userId <= 0) {
        throw new Error("Session utilisateur invalide. Veuillez vous reconnecter.");
      }

      // Validation de l'ID d'événement
      const validEventId = Number(eventId);
      if (isNaN(validEventId) || validEventId <= 0) {
        throw new Error("Événement invalide. Veuillez réessayer.");
      }

      // Validation du nombre de places (valide numériquement; limites appliquées après récupération de l'événement)
      const places = Number(nombrePlaces);
      if (isNaN(places) || places < 1) {
        throw new Error('Veuillez choisir au moins 1 place.');
      }

      // Validation du mode de paiement et du numéro de carte
      if (modePaiement !== 'sur_place' && modePaiement !== 'carte') {
        throw new Error('Mode de paiement non valide');
      }

      if (modePaiement === 'carte') {
        const cleanedCardNumber = (numeroCarte || '').replace(/\s/g, '');
        if (cleanedCardNumber.length !== 16 || !/^\d+$/.test(cleanedCardNumber)) {
          throw new Error('Numéro de carte bancaire invalide. 16 chiffres requis.');
        }
      }
      
      // Vérifier si l'utilisateur est déjà inscrit
      const existingParticipation = participations.find(
        p => p.evenementId === validEventId && p.membreId === userId
      );
      
      if (existingParticipation) {
        throw new Error('Vous êtes déjà inscrit à cet événement');
      }
      
      // Vérifier que l'événement existe et a des places disponibles
      const event = events.find(e => e.id === validEventId);
      if (!event) {
        throw new Error('Événement non trouvé');
      }
      
      // Calculer les places disponibles (compat placesDisponibles || placesMax)
      const participationsForEvent = participations.filter(p => p.evenementId === validEventId);
      const placesReservees = participationsForEvent.reduce(
        (total, p) => total + (Number(p.nombrePlaces) || 0), 0
      );

      const capaciteTotale = (typeof (event as any).placesDisponibles === 'number' && (event as any).placesDisponibles > 0)
        ? (event as any).placesDisponibles
        : (Number(event.placesMax) || 0);
      const placesDisponibles = Math.max(0, capaciteTotale - placesReservees);
      const perMemberLimit = Number((event as any).placesParMembre || 1);
      if (places > perMemberLimit) {
        throw new Error(`Vous pouvez réserver au maximum ${perMemberLimit} place(s) pour cet événement.`);
      }
      if (places > placesDisponibles) {
        throw new Error(`Désolé, il ne reste que ${placesDisponibles} place(s) disponible(s)`);
      }
      
      // Préparer les données de participation
      const eventPrice = event.prix ? Number(event.prix) : 0;
      const montantTotal = eventPrice * places;
      
      const participationData = {
        membreId: userId,
        evenementId: validEventId,
        nombrePlaces: places,
        montantTotal: montantTotal,
        methodePaiement: modePaiement || 'sur_place',
        estPaye: false,
        ...(modePaiement === 'carte' && numeroCarte && String(numeroCarte).replace(/\s/g, '').length > 0
          ? { numeroCarte: String(numeroCarte).replace(/\s/g, '') }
          : {})
      };
      
      console.log('[Frontend] Envoi de la requête de participation...', {
        ...participationData,
        // Masquer les données sensibles dans les logs
        numeroCarte: modePaiement === 'carte' ? '***' + (numeroCarte?.slice(-4) || '') : undefined
      });
      
      try {
        // Utiliser une URL relative pour éviter les problèmes de cross-origin
        const response = await fetch('/api/participations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(participationData)
        });
        
        let responseData;
        try {
          responseData = await response.json();
        } catch (e) {
          console.error('Erreur lors de l\'analyse de la réponse JSON:', e);
          throw new Error('Réserve du serveur invalide. Veuillez réessayer.');
        }
        
        if (!response.ok) {
          console.error('[Frontend] Erreur de réponse:', response.status, responseData);
          const errorMessage = responseData.message || responseData.error || 
            `Erreur serveur (${response.status}): ${response.statusText}`;
          throw new Error(errorMessage);
        }
        
        console.log('[Frontend] Participation créée avec succès:', responseData);
        
        // Nouveau flux: le paiement est effectué après l'inscription via le bouton "Payer"
        
        return { 
          success: true, 
          message: 'Inscription réussie',
          data: { participation: responseData }
        };
      } catch (error) {
        console.error('Erreur lors de l\'inscription:', error);
        throw error instanceof Error 
          ? error 
          : new Error("Une erreur inattendue est survenue");
      }
    },
    onSuccess: async (data, variables) => {
      setShowRegistrationModal(false);
      setSelectedEvent(null);
      // Afficher immédiatement l'état "Inscrit" pour l'événement concerné
      setOptimisticRegistered((prev) => new Set(prev).add(variables.eventId));
      
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/participations"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/events"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
      ]);
      
      const event = events.find(e => e.id === variables.eventId);
      toast({
        title: "✅ Inscription confirmée",
        description: `Vous êtes maintenant inscrit à "${event?.titre || 'l\'événement'}" pour ${variables.nombrePlaces} place(s).`,
        duration: 6000,
      });
    },
    onError: (error: any) => {
      const message = String(error?.message || "Impossible de s'inscrire à l'événement");
      if (message.includes("déjà inscrit")) {
        // UX douce: fermer la modale et informer, sans rouge
        setShowRegistrationModal(false);
        setSelectedEvent(null);
        toast({
          title: "Information",
          description: "Vous êtes déjà inscrit à cet événement",
          duration: 4000,
        });
        return;
      }

      let errorMessage = message;
      if (message.includes("place") && message.includes("disponible")) {
        errorMessage = message;
      } else if (message.includes("carte")) {
        errorMessage = "Veuillez saisir un numéro de carte valide (16 chiffres)";
      } else if (message.includes("connecté") || message.includes("Session")) {
        errorMessage = "Votre session a expiré. Veuillez vous reconnecter.";
      }

      toast({
        title: "❌ Erreur d'inscription",
        description: errorMessage,
        variant: "destructive",
        duration: 5000,
      });
    },
  });

  const createPaymentMutation = useMutation({
    mutationFn: async ({ eventId, amount, paymentMethod }: { eventId: number; amount: number; paymentMethod: string }) => {
      if (!user?.id) throw new Error("Utilisateur non connecté");

      const paymentData = {
        membreId: Number(user.id),
        evenementId: Number(eventId),
        montant: Number(amount),
        datePaiement: new Date().toISOString(),
        methode: paymentMethod === 'carte' ? 'carte' : 'especes',
        statut: paymentMethod === 'carte' ? 'paye' : 'en_attente',
        reference: (paymentMethod === 'carte' ? 'CARD-' : 'CASH-') + Date.now()
      };

      // apiRequest lève déjà une erreur si la réponse n'est pas OK
      return api.createPayment(paymentData);
    },
    onSuccess: () => {
      setShowPaymentModal(false);
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      toast({
        title: "Paiement effectué",
        description: "Votre paiement a été enregistré avec succès",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur de paiement",
        description: error.message || "Impossible de traiter le paiement",
        variant: "destructive",
      });
    },
  });

  const getParticipantsForEvent = (eventId: number) => {
    return participations.filter((p) => p.evenementId === eventId);
  };

  const getUserById = (userId: number | string) => {
    // Convertir l'ID en nombre si nécessaire
    const id = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    if (isNaN(id)) return null;
    return users.find((u) => u.id === id);
  };

  const isUserRegistered = (eventId: number) => {
    if (!user) return false;
    const uid = Number(user.id);
    if (isNaN(uid)) return false;
    return participations.some((p: Participation) => Number(p.evenementId) === Number(eventId) && Number(p.membreId) === uid);
  };

  const getUserParticipation = (eventId: number) => {
    if (!user) return null;
    const uid = Number(user.id);
    if (isNaN(uid)) return null;
    return participations.find((p: Participation) => Number(p.evenementId) === Number(eventId) && Number(p.membreId) === uid) || null;
  };

  const hasUserPaid = (eventId: number) => {
    const participation = getUserParticipation(eventId);
    if (!participation) return false;
    // Vérifier si le paiement est confirmé
    // Cette logique dépendrait de votre implémentation des paiements
    return participation.modePaiement === 'carte'; // Simplification
  };

  const handleEditEvent = useCallback((event: Event) => {
    if (!event || !event.id) {
      toast({
        title: "Erreur",
        description: "Événement invalide",
        variant: "destructive",
      });
      return;
    }
    setEditingEvent(event);
    setEventModalOpen(true);
  }, [toast]);

  const handleDeleteEvent = useCallback((eventId: number) => {
    const event = events.find(e => e.id === eventId);
    if (!event) {
      toast({
        title: "Erreur",
        description: "Événement non trouvé",
        variant: "destructive",
      });
      return;
    }
    
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer l'événement "${event.titre}" ?`)) {
      deleteEventMutation.mutate(eventId);
    }
  }, [events, deleteEventMutation, toast]);

  const handleRegisterForEvent = useCallback((eventId: number) => {
    if (!user?.id) {
      toast({
        title: "Erreur",
        description: "Vous devez être connecté pour vous inscrire",
        variant: "destructive",
      });
      return;
    }
    
    const event = events.find(e => e.id === eventId);
    if (!event) {
      toast({
        title: "Erreur",
        description: "Événement non trouvé",
        variant: "destructive",
      });
      return;
    }
    
    if (isUserRegistered(eventId)) {
      toast({
        title: "Information",
        description: "Vous êtes déjà inscrit à cet événement",
        variant: "default",
      });
      return;
    }
    
    setSelectedEvent(event);
    setShowRegistrationModal(true);
  }, [user?.id, events, isUserRegistered, toast]);

  const handlePayForEvent = useCallback((event: Event) => {
    if (!user?.id) {
      toast({
        title: "Erreur",
        description: "Vous devez être connecté pour effectuer un paiement",
        variant: "destructive",
      });
      return;
    }
    
    setSelectedEvent(event);
    setShowPaymentModal(true);
  }, [user?.id, toast]);

  const formatDate = useCallback((date: Date | string) => {
    try {
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        return "Date invalide";
      }
      return dateObj.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      console.error("Erreur de formatage de date:", error);
      return "Date invalide";
    }
  }, []);

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">les Événements</h1>
          {user?.role === "admin" && (
            <Button
              onClick={() => setEventModalOpen(true)}
              className="bg-primary-600 hover:bg-primary-700"
            >
              <Plus size={16} className="mr-2" />
              Nouvel Événement
            </Button>
          )}
        </div>

        {eventsQuery.isLoading && (
          <div className="text-center py-12 text-gray-500">Chargement des événements…</div>
        )}
        {eventsQuery.isError && (
          <div className="text-center py-12 text-red-500">
            Erreur lors du chargement des événements.<br />
            {eventsQuery.error instanceof Error ? eventsQuery.error.message : String(eventsQuery.error)}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event: Event) => (
            <Card key={event.id} className="border border-gray-200 hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{event.titre}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-gray-600">{event.description}</p>
                  <div className="flex items-center text-sm text-gray-500">
                    <Calendar size={16} className="mr-2" />
                    {event.dateDebut ? formatDate(event.dateDebut) : formatDate(event.date)}
                  </div>
                  {event.lieu && (
                    <div className="flex items-center text-sm text-gray-500">
                      <MapPin size={16} className="mr-2" />
                      {event.lieu}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2">
                    {event.placesMax && (
                      <div className="flex items-center text-sm text-gray-500">
                        <Users size={16} className="mr-2" />
                        {event.placesMax} places
                      </div>
                    )}
                    {event.prix && (
                      <div className="text-sm font-medium text-gray-900">
                        {event.prix} DT
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex gap-2">
                    {user?.role === "admin" ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditEvent(event)}
                          className="flex-1"
                        >
                          <Edit size={14} className="mr-1" />
                          Modifier
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteEvent(event.id)}
                          disabled={deleteEventMutation.isPending}
                        >
                          <Trash2 size={14} className="mr-1" />
                          Supprimer
                        </Button>
                      </>
                    ) : (
                      <>
                        {!(isUserRegistered(event.id) || optimisticRegistered.has(event.id)) ? (
                          <Button
                            size="sm"
                            onClick={() => {
                              if (!user?.id) {
                                localStorage.setItem('redirectAfterLogin', window.location.pathname);
                                window.location.href = '/login';
                              } else {
                                handleRegisterForEvent(event.id);
                              }
                            }}
                            className="flex-1"
                            disabled={registerForEventMutation.isPending && selectedEvent?.id === event.id}
                          >
                            <UserPlus size={14} className="mr-1" />
                            {user?.id ? "S'inscrire" : "Se connecter pour s'inscrire"}
                          </Button>
                        ) : (
                          <>
                            <Badge
                              variant="secondary"
                              className="flex-1 justify-center"
                            >
                              ✓ Inscrit
                            </Badge>
                            {event.prix && parseFloat(event.prix.toString()) > 0 && !hasUserPaid(event.id) && (
                              <Button
                                size="sm"
                                variant="default"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => handlePayForEvent(event)}
                              >
                                <CreditCard size={14} className="mr-1" />
                                Payer
                              </Button>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                  {user?.role === "admin" && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold mb-2">Participants inscrits :</h4>
                      {getParticipantsForEvent(event.id).length === 0 ? (
                        <p className="text-xs text-gray-500">Aucun participant</p>
                      ) : (
                        <ul className="text-xs text-gray-700 space-y-1">
                          {getParticipantsForEvent(event.id).map((p) => {
                            if (p.membreId === null || p.membreId === undefined) return null;
                            const participant = getUserById(p.membreId);
                            if (!participant) return null;
                            return (
                              <li key={p.id} className="flex items-center space-x-2">
                                <span className="font-medium">{participant.prenom} {participant.nom}</span>
                                <span className="text-gray-400">({participant.email})</span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {events.length === 0 && (
        <div className="text-center py-12">
          <Calendar size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">Aucun événement trouvé</p>
          {user?.role === "admin" && (
            <Button
              onClick={() => setEventModalOpen(true)}
              className="mt-4 bg-primary-600 hover:bg-primary-700"
            >
              Créer le premier événement
            </Button>
          )}
        </div>
      )}

      <EventModal
        isOpen={eventModalOpen}
        onClose={() => {
          setEventModalOpen(false);
          setEditingEvent(null);
        }}
        editingEvent={editingEvent}
      />

      {/* Modal d'inscription */}
      {showRegistrationModal && selectedEvent && (
        <RegistrationModal
          isOpen={showRegistrationModal}
          onClose={() => {
            setShowRegistrationModal(false);
            setSelectedEvent(null);
          }}
          event={selectedEvent}
          user={user}
          onRegister={async (places, paymentMethod, cardNumber) => {
            try {
              await registerForEventMutation.mutateAsync({
                eventId: selectedEvent.id,
                nombrePlaces: places,
                modePaiement: paymentMethod,
                numeroCarte: paymentMethod === 'carte' ? cardNumber : undefined
              });
            } catch (err: any) {
              toast({
                title: "Erreur d'inscription",
                description: err.message || "Une erreur est survenue lors de l'inscription. Veuillez réessayer.",
                variant: "destructive",
                duration: 5000,
              });
            }
          }}
        />
      )}

      {/* Modal de paiement */}
      {showPaymentModal && selectedEvent && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedEvent(null);
          }}
          event={selectedEvent}
          user={user}
          onPay={(amount, paymentMethod, cardNumber) => {
            createPaymentMutation.mutate({
              eventId: selectedEvent.id,
              amount,
              paymentMethod
            });
          }}
        />
      )}
    </>
  );
}

// Composant modal d'inscription
type RegistrationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  event: any;
  user: any;
  onRegister: (places: number, paymentMethod: "sur_place" | "carte", cardNumber?: string) => void;
};

function RegistrationModal({ isOpen, onClose, event, user, onRegister }: RegistrationModalProps) {
  const [places, setPlaces] = React.useState(1);
  const [paymentMethod, setPaymentMethod] = React.useState<'sur_place' | 'carte'>('sur_place');
  const [cardNumber, setCardNumber] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  // Utiliser directement les places disponibles depuis l'événement
  const placesRestantes = event.placesDisponibles !== undefined ? 
    Number(event.placesDisponibles) : 
    (Number(event.placesMax) || 0);
  const perMemberLimit = Number(event.placesParMembre || 1);
  const maxReservable = Math.max(1, Math.min(placesRestantes, perMemberLimit));
  const prixUnitaire = parseFloat(event.prix?.toString() || '0');
  const total = prixUnitaire * places;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (places < 1) {
      setError('Veuillez choisir au moins 1 place.');
      return;
    }
    if (places > perMemberLimit) {
      setError(`Vous pouvez réserver au maximum ${perMemberLimit} place(s) pour cet événement.`);
      return;
    }
    
    if (placesRestantes <= 0) {
      setError('Désolé, il n\'y a plus de places disponibles pour cet événement.');
      return;
    }
    
    if (places > placesRestantes) {
      setError(`Désolé, il ne reste que ${placesRestantes} place(s) disponible(s).`);
      return;
    }
    
    if (paymentMethod === 'carte' && (!cardNumber || cardNumber.replace(/\s/g, '').length !== 16)) {
      setError('Veuillez saisir un numéro de carte valide (16 chiffres).');
      return;
    }
    
    onRegister(places, paymentMethod, paymentMethod === 'carte' ? cardNumber : undefined);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 relative">
        <button className="absolute top-2 right-2 text-gray-400 hover:text-gray-600" onClick={onClose}>&times;</button>
        <h2 className="text-lg font-bold mb-2">Inscription à "{event.titre}"</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Nombre de places à réserver</label>
            <input
              type="number"
              min={1}
              max={maxReservable}
              value={places}
              onChange={e => setPlaces(Number(e.target.value))}
              className="border rounded px-2 py-1 w-20 mt-1"
            />
            <span className="ml-2 text-xs text-gray-500">(max {maxReservable})</span>
          </div>
          <div className="text-sm text-gray-700">
            Places restantes : <span className="font-semibold">{placesRestantes}</span>
          </div>
          <div className="text-sm text-gray-700">
            Prix unitaire : <span className="font-semibold">{prixUnitaire} DT</span>
          </div>
          <div className="text-sm text-gray-700">
            Total à payer : <span className="font-semibold">{total} DT</span>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Mode de paiement</label>
            <div className="flex space-x-4 mt-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('sur_place')}
                className={`flex items-center px-4 py-2 rounded border transition focus:outline-none ${paymentMethod === 'sur_place' ? 'border-primary-600 bg-primary-50 text-primary-700 font-semibold shadow' : 'border-gray-300 bg-white text-gray-700'}`}
                aria-pressed={paymentMethod === 'sur_place'}
              >
                <span className="mr-2">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path fill={paymentMethod === 'sur_place' ? '#2563eb' : '#9ca3af'} d="M2 7a2 2 0 012-2h16a2 2 0 012 2v2H2V7zm0 4h20v6a2 2 0 01-2 2H4a2 2 0 01-2-2v-6zm5 3a1 1 0 100 2 1 1 0 000-2z"/></svg>
                </span>
                Sur place
                <span className="ml-2 text-xs text-gray-400">(espèces ou chèque)</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('carte')}
                className={`flex items-center px-4 py-2 rounded border transition focus:outline-none ${paymentMethod === 'carte' ? 'border-primary-600 bg-primary-50 text-primary-700 font-semibold shadow' : 'border-gray-300 bg-white text-gray-700'}`}
                aria-pressed={paymentMethod === 'carte'}
              >
                <span className="mr-2">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path fill={paymentMethod === 'carte' ? '#2563eb' : '#9ca3af'} d="M2 7a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V7zm2 0v2h16V7H4zm0 4v6h16v-6H4zm4 3a1 1 0 100 2 1 1 0 000-2z"/></svg>
                </span>
                Carte bancaire
                <span className="ml-2 text-xs text-gray-400">(paiement sécurisé)</span>
              </button>
            </div>
          </div>
          {paymentMethod === 'carte' && (
            <div>
              <label className="block text-sm font-medium mb-1">Numéro de carte</label>
              <input
                type="text"
                value={cardNumber}
                onChange={e => {
                  const value = e.target.value.replace(/\D/g, ''); // Garder seulement les chiffres
                  const formatted = value.replace(/(\d{4})/g, '$1 ').trim();
                  setCardNumber(formatted);
                }}
                className="border rounded px-2 py-1 w-full"
                placeholder="1234 5678 9012 3456"
                maxLength={19}
              />
            </div>
          )}
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <div className="flex justify-end space-x-2 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300">Annuler</button>
            <button type="submit" className="px-4 py-2 rounded bg-primary-600 text-white hover:bg-primary-700">Valider</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Composant modal de paiement
type PaymentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  event: any;
  user: any;
  onPay: (amount: number, paymentMethod: string, cardNumber?: string) => void;
};

function PaymentModal({ isOpen, onClose, event, user, onPay }: PaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = React.useState('sur_place');
  const [cardNumber, setCardNumber] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const prixUnitaire = parseFloat(event.prix?.toString() || '0');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    try {
      // Validation du mode de paiement
      if (paymentMethod !== 'sur_place' && paymentMethod !== 'carte') {
        throw new Error('Mode de paiement non valide');
      }
      
      // Validation du numéro de carte si paiement par carte
      if (paymentMethod === 'carte') {
        const cleanedCardNumber = cardNumber.replace(/\s/g, '');
        if (!cleanedCardNumber || cleanedCardNumber.length !== 16 || !/^\d+$/.test(cleanedCardNumber)) {
          throw new Error('Veuillez saisir un numéro de carte valide (16 chiffres)');
        }
      }
      
      // Appel de la fonction de paiement
      onPay(
        prixUnitaire, 
        paymentMethod, 
        paymentMethod === 'carte' ? cardNumber.replace(/\s/g, '') : undefined
      );
      
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Une erreur est survenue');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 relative">
        <button className="absolute top-2 right-2 text-gray-400 hover:text-gray-600" onClick={onClose}>&times;</button>
        <h2 className="text-lg font-bold mb-2">Paiement pour "{event.titre}"</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-sm text-gray-700">
            Montant à payer : <span className="font-semibold">{prixUnitaire} DT</span>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Mode de paiement</label>
            <div className="flex space-x-4 mt-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('sur_place')}
                className={`flex items-center px-4 py-2 rounded border transition focus:outline-none ${paymentMethod === 'sur_place' ? 'border-primary-600 bg-primary-50 text-primary-700 font-semibold shadow' : 'border-gray-300 bg-white text-gray-700'}`}
                aria-pressed={paymentMethod === 'sur_place'}
              >
                <span className="mr-2">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path fill={paymentMethod === 'sur_place' ? '#2563eb' : '#9ca3af'} d="M2 7a2 2 0 012-2h16a2 2 0 012 2v2H2V7zm0 4h20v6a2 2 0 01-2 2H4a2 2 0 01-2-2v-6zm5 3a1 1 0 100 2 1 1 0 000-2z"/></svg>
                </span>
                Sur place
                <span className="ml-2 text-xs text-gray-400">(espèces ou chèque)</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('carte')}
                className={`flex items-center px-4 py-2 rounded border transition focus:outline-none ${paymentMethod === 'carte' ? 'border-primary-600 bg-primary-50 text-primary-700 font-semibold shadow' : 'border-gray-300 bg-white text-gray-700'}`}
                aria-pressed={paymentMethod === 'carte'}
              >
                <span className="mr-2">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path fill={paymentMethod === 'carte' ? '#2563eb' : '#9ca3af'} d="M2 7a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V7zm2 0v2h16V7H4zm0 4v6h16v-6H4zm4 3a1 1 0 100 2 1 1 0 000-2z"/></svg>
                </span>
                Carte bancaire
                <span className="ml-2 text-xs text-gray-400">(paiement sécurisé)</span>
              </button>
            </div>
          </div>
          {paymentMethod === 'carte' && (
            <div>
              <label className="block text-sm font-medium mb-1">Numéro de carte</label>
              <input
                type="text"
                value={cardNumber}
                onChange={e => {
                  const value = e.target.value.replace(/\D/g, ''); // Garder seulement les chiffres
                  const formatted = value.replace(/(\d{4})/g, '$1 ').trim();
                  setCardNumber(formatted);
                }}
                className="border rounded px-2 py-1 w-full"
                placeholder="1234 5678 9012 3456"
                maxLength={19}
              />
            </div>
          )}
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <div className="flex justify-end space-x-2 mt-4">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 transition-colors"
            >
              Annuler
            </button>
            <button 
              type="submit" 
              className="px-4 py-2 rounded bg-primary-600 text-white hover:bg-primary-700 transition-colors"
              disabled={!paymentMethod}
            >
              {paymentMethod === 'carte' ? 'Payer par carte' : 'Confirmer le paiement sur place'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}