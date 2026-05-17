import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, MapPin } from "lucide-react";
import { Event } from "@shared/schema";

interface EventCardProps {
  event: Event;
}

export default function EventCard({ event }: EventCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "termine":
        return "bg-green-100 text-green-700";
      case "planifie":
        return "bg-blue-100 text-blue-700";
      case "en_cours":
        return "bg-yellow-100 text-yellow-700";
      case "annule":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const determineEventStatus = (eventDate: string) => {
    const now = new Date();
    const eventDateObj = new Date(eventDate);
    
    if (eventDateObj < now) {
      return "termine";
    } else if (eventDateObj > now) {
      return "planifie";
    } else {
      return "en_cours";
    }
  };

  const eventStatus = determineEventStatus(event.date);

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
            <Calendar className="text-primary-600" size={20} />
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-gray-900">{event.titre}</h4>
            <div className="flex items-center space-x-4 mt-1">
              <p className="text-sm text-gray-500 flex items-center">
                <Calendar size={14} className="mr-1" />
                {formatDate(event.date)}
              </p>
              {event.lieu && (
                <p className="text-sm text-gray-500 flex items-center">
                  <MapPin size={14} className="mr-1" />
                  {event.lieu}
                </p>
              )}
            </div>
          </div>
          <Badge className={getStatusColor(eventStatus)}>
            {eventStatus === "termine" ? "Terminé" : 
             eventStatus === "planifie" ? "Planifié" :
             eventStatus === "en_cours" ? "En cours" : "Annulé"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
