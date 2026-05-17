import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

// Schema de validation pour le formulaire d'événement
const eventFormSchema = z.object({
  titre: z.string().min(1, "Le titre est obligatoire").max(100, "Le titre ne doit pas dépasser 100 caractères"),
  description: z.string().min(1, "La description est requise").max(2000, "La description ne doit pas dépasser 2000 caractères"),
  dateDebut: z.string().min(1, "La date de début est obligatoire"),
  dateFin: z.string().optional(),
  lieu: z.string().min(1, "Le lieu est requis").max(200, "Le lieu ne doit pas dépasser 200 caractères"),
  placesMax: z.number()
    .int("Le nombre de places doit être un entier")
    .min(1, "Le nombre de places doit être d'au moins 1")
    .max(1000, "Le nombre de places ne peut pas dépasser 1000")
    .optional(),
  placesParMembre: z.number()
    .int("Le nombre doit être un entier")
    .min(1, "Au moins 1 place par membre")
    .max(50, "Maximum 50 places par membre")
    .optional(),
  prix: z.preprocess((val) => {
    if (typeof val === 'string') {
      const normalized = val.replace(',', '.').trim();
      const num = parseFloat(normalized);
      return Number.isFinite(num) ? num : undefined;
    }
    return val;
  }, z.number().optional()),
  categorie: z.string().optional(),
  statut: z.enum(['actif', 'inactif', 'planifie', 'en_cours']).default('planifie')
});

type EventFormData = z.infer<typeof eventFormSchema>;

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingEvent?: any;
}

export default function EventModal({ isOpen, onClose, editingEvent }: EventModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
    setError,
    clearErrors,
  } = useForm<EventFormData>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      titre: "",
      description: "",
      dateDebut: new Date().toISOString().slice(0, 16), // Date et heure actuelles comme valeur par défaut
      dateFin: "",
      lieu: "",
      placesMax: 10, // Valeur par défaut pour les places
      placesParMembre: 1, // Défaut 1
      prix: 0, // Prix par défaut à 0
      statut: 'planifie',
    },
  });

  const createEventMutation = useMutation({
    mutationFn: (data: any) => api.createEvent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({
        title: "Événement créé",
        description: "L'événement a été créé avec succès",
      });
      handleClose();
    },
    onError: (error: any) => {
      console.error("Erreur createEvent:", error.response?.data || error.message);
      const errorMessage = error.response?.data?.message || "Impossible de créer l'événement";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.updateEvent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({
        title: "Événement modifié",
        description: "L'événement a été modifié avec succès",
      });
      handleClose();
    },
    onError: (error: any) => {
      console.error("Erreur updateEvent:", error.response?.data || error.message);
      const errorMessage = error.response?.data?.message || "Impossible de modifier l'événement";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (editingEvent && isOpen) {
      const formatDateForInput = (date: Date | string | null) => {
        if (!date) return "";
        const d = new Date(date);
        return d.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:mm
      };

      setValue("titre", editingEvent.titre || "");
      setValue("description", editingEvent.description || "");
      setValue("dateDebut", formatDateForInput(editingEvent.dateDebut));
      setValue("dateFin", formatDateForInput(editingEvent.dateFin));
      setValue("lieu", editingEvent.lieu || "");
      setValue("placesMax", editingEvent.placesMax || undefined);
      setValue("placesParMembre", editingEvent.placesParMembre || 1);
      setValue("prix", editingEvent.prix ? parseFloat(editingEvent.prix.toString()) : undefined);
      setValue("categorie", editingEvent.categorie || "");
      setValue("statut", editingEvent.statut || "planifie");
    }
  }, [editingEvent, isOpen, setValue]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = (formData: EventFormData) => {
    console.log('Données du formulaire reçues:', formData);

    // Nettoyage des données
    const titre = formData.titre?.trim();
    const description = formData.description?.trim() || '';
    const lieu = formData.lieu?.trim() || '';

    // La validation est déjà gérée par Zod via le schéma
    if (errors && Object.keys(errors).length > 0) {
      // Afficher les erreurs de validation
      Object.entries(errors).forEach(([key, error]) => {
        toast({
          title: "Erreur de validation",
          description: error.message?.toString() || `Erreur dans le champ ${key}`,
          variant: "destructive",
        });
      });
      return;
    }

    // Validation des dates
    const dateDebut = new Date(formData.dateDebut);
    if (isNaN(dateDebut.getTime())) {
      toast({
        title: "Erreur",
        description: "La date de début n'est pas valide",
        variant: "destructive",
      });
      return;
    }

    let dateFin = null;
    if (formData.dateFin && formData.dateFin.trim() !== "") {
      dateFin = new Date(formData.dateFin);
      if (isNaN(dateFin.getTime())) {
        toast({
          title: "Erreur",
          description: "La date de fin n'est pas valide",
          variant: "destructive",
        });
        return;
      }
      if (dateFin <= dateDebut) {
        toast({
          title: "Erreur",
          description: "La date de fin doit être après la date de début",
          variant: "destructive",
        });
        return;
      }
    }

      // Validation et formatage des nombres
    const placesMax = formData.placesMax && formData.placesMax > 0 ? Math.floor(Number(formData.placesMax)) : 10; // Valeur par défaut de 10 places
    const placesParMembre = formData.placesParMembre && formData.placesParMembre > 0 ? Math.floor(Number(formData.placesParMembre)) : 1;
    
    // Prix: libre (nombre), fallback 0 si vide ou NaN
    let prix = 0;
    if (formData.prix !== undefined && formData.prix !== null) {
      const prixNum = Number(formData.prix);
      if (Number.isFinite(prixNum)) {
        prix = prixNum;
      }
    }

    // Préparation du payload final selon le schéma attendu par le backend
    const payload = {
      titre: titre,
      description: description,
      date: dateDebut.toISOString(),
      dateFin: dateFin ? dateFin.toISOString() : undefined,
      lieu: lieu,
      placesDisponibles: placesMax,
      placesMax: placesMax, // Pour la rétrocompatibilité
      placesParMembre: placesParMembre,
      prix: prix,
      estPayant: prix > 0,
      imageUrl: "", // Champ requis par le schéma
      statut: formData.statut || 'planifie'
    };
    
    console.log('Payload envoyé au serveur:', payload);

    console.log("Payload final envoyé :", payload);
    
    if (editingEvent) {
      // Mode édition
      updateEventMutation.mutate({ id: editingEvent.id, data: payload });
    } else {
      // Mode création
      createEventMutation.mutate(payload);
    }
  };

  const categories = [
    "Assemblée générale",
    "Dîner",
    "Sport",
    "Culture",
    "Voyage",
    "Formation",
    "Autre",
  ];

  useEffect(() => {
    if (isOpen) {
      reset();
    }
  }, [isOpen, reset]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{editingEvent ? "Modifier l'événement" : "Nouvel événement"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="titre">Titre *</Label>
            <Input 
              id="titre" 
              {...register("titre")}
              placeholder="Entrez le titre de l'événement"
            />
            {errors.titre && (
              <p className="text-red-500 text-sm">{errors.titre.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="description">Description *</Label>
            <Textarea 
              id="description" 
              {...register("description")}
              placeholder="Décrivez en détail votre événement..."
              className="min-h-[100px]"
            />
            {errors.description && (
              <p className="text-red-500 text-sm">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dateDebut">Date de début *</Label>
              <Input
                type="datetime-local"
                id="dateDebut"
                {...register("dateDebut")}
              />
              {errors.dateDebut && (
                <p className="text-red-500 text-sm">{errors.dateDebut.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="dateFin">Date de fin</Label>
              <Input
                type="datetime-local"
                id="dateFin"
                {...register("dateFin")}
              />
              {errors.dateFin && (
                <p className="text-red-500 text-sm">{errors.dateFin.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="lieu">Lieu</Label>
            <Input 
              id="lieu" 
              {...register("lieu")}
              placeholder="Lieu de l'événement"
            />
            {errors.lieu && (
              <p className="text-red-500 text-sm">{errors.lieu.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="placesMax">Places max</Label>
              <Input
                type="number"
                id="placesMax"
                min="0"
                {...register("placesMax", { 
                  valueAsNumber: true,
                  setValueAs: (value) => value === "" ? undefined : Number(value)
                })}
                placeholder="Nombre de places"
              />
              {errors.placesMax && (
                <p className="text-red-500 text-sm">{errors.placesMax.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="placesParMembre">Places par membre</Label>
              <Input
                type="number"
                id="placesParMembre"
                min="1"
                {...register("placesParMembre", {
                  valueAsNumber: true,
                  setValueAs: (value) => value === "" ? 1 : Number(value)
                })}
                placeholder="1"
              />
              {errors.placesParMembre && (
                <p className="text-red-500 text-sm">{errors.placesParMembre.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="prix">Prix (DT)</Label>
              <Input 
                type="text"
                id="prix"
                inputMode="decimal"
                {...register("prix", {
                  setValueAs: (value) => {
                    if (value === "" || value == null) return undefined;
                    const normalized = String(value).replace(',', '.').trim();
                    const num = parseFloat(normalized);
                    return Number.isFinite(num) ? num : undefined;
                  }
                })}
                placeholder="0"
              />
              {errors.prix && (
                <p className="text-red-500 text-sm">{errors.prix.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="categorie">Catégorie</Label>
            <Select
              value={watch("categorie") || ""}
              onValueChange={(value) => setValue("categorie", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une catégorie" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.categorie && (
              <p className="text-red-500 text-sm">{errors.categorie.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="statut">Statut</Label>
            <Select
              value={watch("statut") || "planifie"}
              onValueChange={(value) => setValue("statut", value as any)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="planifie">Planifié</SelectItem>
                <SelectItem value="actif">Actif</SelectItem>
                <SelectItem value="en_cours">En cours</SelectItem>
              </SelectContent>
            </Select>
            {errors.statut && (
              <p className="text-red-500 text-sm">{errors.statut.message}</p>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={createEventMutation.isPending || updateEventMutation.isPending}>
              {editingEvent 
                ? (updateEventMutation.isPending ? "Modification..." : "Modifier l'événement")
                : (createEventMutation.isPending ? "Création..." : "Créer l'événement")
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}