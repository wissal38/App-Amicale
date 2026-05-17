import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Edit, Trash2, UserPlus } from "lucide-react";
import { User } from "@shared/schema";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface MemberTableProps {
  members: User[];
  onAddMember: () => void;
  onEditMember: (member: User) => void;
  isAdmin: boolean;
}

import { useAuth } from "@/contexts/AuthContext";

export default function MemberTable({ members, onAddMember, onEditMember, isAdmin }: MemberTableProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => api.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Membre supprimé",
        description: "Le membre a été supprimé avec succès",
      });
      setDeleteId(null);
    },
    onError: (err: any) => {
      const message = err?.message || err?.response?.data?.error || err?.response?.data?.message || "Impossible de supprimer le membre";
      toast({
        title: "Erreur",
        description: message,
        variant: "destructive",
      });
      setDeleteId(null);
    },
  });

  const filteredMembers = members.filter((member) => {
    const query = searchQuery.toLowerCase();
    return (
      member.nom?.toLowerCase().includes(query) ||
      member.prenom?.toLowerCase().includes(query) ||
      member.email?.toLowerCase().includes(query)
    );
  });

  const getStatusColor = (status: string) => {
    return status === "actif" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800";
  };

  const getInitials = (prenom?: string, nom?: string) => {
    return `${prenom?.charAt(0) || ''}${nom?.charAt(0) || ''}`.toUpperCase();
  };

  const formatDate = (date?: Date | string | null) => {
    return date ? new Date(date).toLocaleDateString("fr-FR") : "-";
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Membres</h3>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Rechercher un membre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 pl-10"
              />
            </div>
            {isAdmin && (
              <Button onClick={onAddMember} className="bg-primary-600 hover:bg-primary-700">
                <UserPlus size={16} className="mr-2" />
                Ajouter Membre
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="text-left">Membre</TableHead>
              <TableHead className="text-left">Email</TableHead>
              <TableHead className="text-left">Statut</TableHead>
              <TableHead className="text-left">Date d'inscription</TableHead>
              {isAdmin && <TableHead className="text-left">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMembers.map((member, idx) => (
              <TableRow
                key={`${member.id ?? "noid"}-${member.email ?? "noemail"}-${idx}`}
                className="hover:bg-gray-50"
              >
                <TableCell>
                  <div className="flex items-center space-x-3">
                    <Avatar>
                      <AvatarFallback className="bg-primary-100 text-primary-600">
                        {getInitials(member.prenom, member.nom)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium text-gray-900">
                        {member.prenom} {member.nom}
                      </div>
                      <div className="text-sm text-gray-500 capitalize">
                        {member.role}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-gray-900">{member.email}</TableCell>
                <TableCell>
                  <Badge className={getStatusColor(member.statut || 'inactif')}>
                    {member.statut === "actif" ? "Actif" : "Inactif"}
                  </Badge>
                </TableCell>
                <TableCell className="text-gray-500">
                  {member.dateInscription ? formatDate(member.dateInscription) : "-"}
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditMember(member)}
                        className="text-primary-600 hover:text-primary-700"
                        title="Modifier"
                        disabled={!member}
                      >
                        <Edit size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        disabled={
                          deleteUserMutation.isPending ||
                          !user ||
                          !member ||
                          member.email === user.email ||
                          !member.id || Number(member.id) <= 0
                        }
                        title={
                          !user || !member
                            ? "Action indisponible"
                            : member.email === user.email
                            ? "Vous ne pouvez pas supprimer votre propre compte"
                            : (!member.id || Number(member.id) <= 0)
                            ? "ID membre invalide. Veuillez rafraîchir la page et/ou vous reconnecter."
                            : "Supprimer"
                        }
                        onClick={() => setDeleteId(member.id)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                    {/* Confirmation dialog */}
                    {deleteId === member.id && (
                      <div className="mt-2 bg-white border border-gray-200 rounded shadow p-4 z-50 absolute">
                        <p className="mb-2 text-sm">Confirmer la suppression de ce membre ?</p>
                        <div className="flex space-x-2">
                          <Button size="sm" variant="destructive" onClick={() => deleteUserMutation.mutate(member.id.toString())} disabled={deleteUserMutation.isPending}>
                            Oui, supprimer
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setDeleteId(null)}>
                            Annuler
                          </Button>
                        </div>
                      </div>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Affichage de <span className="font-medium">1</span> à{" "}
            <span className="font-medium">{filteredMembers.length}</span> sur{" "}
            <span className="font-medium">{members.length}</span> membres
          </div> 
        </div>
      </div>
    </div>
  );
}
