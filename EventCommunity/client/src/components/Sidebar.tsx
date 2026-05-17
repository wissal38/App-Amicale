import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { 
  Calendar, 
  UserCheck, 
  CreditCard, 
  Bell, 
  Settings, 
  BarChart3,
  LogOut,
  User,
  Users
} from "lucide-react";
import { Notification } from "@shared/schema";

interface SidebarProps {
  isOpen: boolean;
}

export default function Sidebar({ isOpen }: SidebarProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["/api/stats"],
  });

  const { data: notifications } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
  });

  const unreadNotifications = notifications?.filter((n) => !n.lue).length || 0;

  const menuItems = [
    { path: "/", icon: BarChart3, label: "Dashboard", active: location === "/" },
    { path: "/events", icon: Calendar, label: "Événements", active: location.startsWith("/events") },
    ...(user?.role === "admin"
      ? [{ path: "/members", icon: UserCheck, label: "Membres", active: location.startsWith("/members") }]
      : []),
    { path: "/payments", icon: CreditCard, label: "Paiements", active: location.startsWith("/payments") },
    { 
      path: "/notifications", 
      icon: Bell, 
      label: "Notifications", 
      badge: unreadNotifications,
      badgeColor: "bg-red-100 text-red-600",
      active: location.startsWith("/notifications") 
    },
    { path: "/settings", icon: Settings, label: "Paramètres", active: location.startsWith("/settings") },
  ];

  return (
    <aside className={`w-64 bg-white shadow-lg transition-all duration-300 ease-in-out ${isOpen ? "" : "-translate-x-full"}`}>
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Amicale</h1>
            <p className="text-sm text-gray-500"></p>
          </div>
        </div>
      </div>

      <nav className="mt-6">
        <div className="px-4 space-y-2">
          {menuItems.map((item) => (
            <Link key={item.path} href={item.path}>
              <a
                className={`flex items-center px-4 py-3 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors ${
                  item.active ? "bg-primary-50 text-primary-700 border-r-2 border-primary-600" : ""
                }`}
              >
                <item.icon className="mr-3" size={20} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className={`ml-auto px-2 py-1 rounded-full text-xs font-medium ${
                    item.badgeColor || "bg-primary-100 text-primary-600"
                  }`}>
                    {item.badge}
                  </span>
                )}
              </a>
            </Link>
          ))}
        </div>
      </nav>

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
            <User className="text-gray-600" size={20} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">
              {user?.prenom} {user?.nom}
            </p>
            <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
          </div>
          <button
            onClick={logout}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </aside>
  );
}
