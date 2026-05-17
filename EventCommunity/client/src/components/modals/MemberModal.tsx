import { useState } from "react";
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
import { User } from "@shared/schema";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/contexts/AuthContext";

const memberSchema = z.object({
  nom: z.string().min(1, "Le nom est requis"),
  prenom: z.string().min(1, "Le prénom est requis"),
  email: z.string().email("Email invalide"),
  telephone: z.string().optional(),
  role: z.enum(["membre", "admin"]),
  statut: z.enum(["actif", "inactif"]),
  motDePasse: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères").optional(),
});

type MemberFormData = z.infer<typeof memberSchema>;

interface MemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  member?: User;
}

export default function MemberModal({ isOpen, onClose, member }: MemberModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!member;

  const form = useForm<MemberFormData>({
    resolver: zodResolver(memberSchema),
    defaultValues: member ? {
      nom: member.nom,
      prenom: member.prenom,
      email: member.email,
      telephone: member.telephone || "",
      role: member.role as "membre" | "admin",
      statut: member.statut as "actif" | "inactif",
      motDePasse: "",
    } : {
      nom: "",
      prenom: "",
      email: "",
      telephone: "",
      role: "membre",
      statut: "actif",
      motDePasse: "",
    },
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = form;

  // Remplace la création de membre pour utiliser l'API d'inscription du backend
  const createMemberMutation = useMutation({
    mutationFn: (data: MemberFormData) =>
      api.register({ ...data, confirmPassword: data.motDePasse }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Membre créé",
        description: "Le membre a été créé avec succès",
      });
      onClose();
      reset();
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de créer le membre",
        variant: "destructive",
      });
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: (data: Partial<MemberFormData>) => api.updateUser(member!.id.toString(), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Membre modifié",
        description: "Le membre a été modifié avec succès",
      });
      onClose();
      reset();
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de modifier le membre",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: MemberFormData) => {
    if (isEditing) {
      const { motDePasse, ...updateData } = data;
      if (motDePasse) {
        (updateData as any).motDePasse = motDePasse;
      }
      updateMemberMutation.mutate(updateData);
    } else {
      createMemberMutation.mutate(data);
    }
  };

  const isPending = createMemberMutation.isPending || updateMemberMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Modifier le membre" : "Nouveau membre"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="prenom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prénom</FormLabel>
                      <FormControl>
                        <Input {...field} id="prenom" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="nom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom</FormLabel>
                      <FormControl>
                        <Input {...field} id="nom" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input {...field} id="email" type="email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="telephone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Téléphone</FormLabel>
                  <FormControl>
                    <Input {...field} id="telephone" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {user?.role === "admin" ? (
              <div>
                <Label htmlFor="role">Rôle</Label>
                <Select
                  value={watch("role")}
                  onValueChange={(value) => setValue("role", value as "membre" | "admin")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un rôle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="membre">Membre</SelectItem>
                    <SelectItem value="admin">Administrateur</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label htmlFor="role">Rôle</Label>
                <Input value={watch("role") === "admin" ? "Administrateur" : "Membre"} readOnly disabled />
              </div>
            )}

            <div>
              <Label htmlFor="statut">Statut</Label>
              <Select
                value={watch("statut")}
                onValueChange={(value) => setValue("statut", value as "actif" | "inactif")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="actif">Actif</SelectItem>
                  <SelectItem value="inactif">Inactif</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <FormField
              control={form.control}
              name="motDePasse"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {isEditing ? "Nouveau mot de passe (optionnel)" : "Mot de passe"}
                  </FormLabel>
                  <FormControl>
                    <Input {...field} id="motDePasse" type="password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Annuler
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Traitement..." : isEditing ? "Modifier" : "Créer"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
