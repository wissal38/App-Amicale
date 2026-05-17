import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, CalendarPlus } from "lucide-react";

interface QuickActionsProps {
  onNewMember: () => void;
  onNewEvent: () => void;
}

export default function QuickActions({
  onNewMember,
  onNewEvent,
}: QuickActionsProps) {
  const actions = [
    {
      icon: UserPlus,
      label: "Nouveau Membre",
      color: "bg-primary-50 hover:bg-primary-100 text-primary-600",
      onClick: onNewMember,
    },
    {
      icon: CalendarPlus,
      label: "Nouvel Événement",
      color: "bg-purple-50 hover:bg-purple-100 text-purple-600",
      onClick: onNewEvent,
    },
  ];

  return (
    <Card className="border border-gray-200">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">
          Actions Rapides
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant="ghost"
              className={`flex flex-col items-center p-6 h-auto ${action.color}`}
              onClick={action.onClick}
            >
              <action.icon size={24} className="mb-3" />
              <span className="font-medium">{action.label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
