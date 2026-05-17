import { apiRequest } from "./queryClient";

export const api = {
  // Auth
  login: <T = any>(credentials: { email: string; motDePasse: string }) =>
    apiRequest<T>("POST", "/api/auth/login", credentials) as Promise<T>,
  
  register: <T = any>(userData: any) =>
    apiRequest<T>("POST", "/api/auth/register", userData) as Promise<T>,

  createUser: (userData: any) =>
    apiRequest("POST", "/api/users", userData),
  
  getCurrentUser: () =>
    apiRequest("GET", "/api/auth/me"),
  
  // Users
  getUsers: () =>
    apiRequest("GET", "/api/users").then((response: any) => {
      // Supporter deux formats: tableau brut ou objet { data: [] }
      if (Array.isArray(response)) return response;
      if (Array.isArray(response?.data)) return response.data;
      // Certains backends renvoient { success, users: [] }
      if (Array.isArray(response?.users)) return response.users;
      return [];
    }),
  
  getUsersPaginated: (page: number = 1, limit: number = 10, search: string = '') =>
    apiRequest("GET", `/api/users?page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  
  getUser: (id: string) =>
    apiRequest("GET", `/api/users/${id}`),
  
  updateUser: (id: string, userData: any) =>
    apiRequest("PUT", `/api/users/${id}`, userData),
  
  deleteUser: (id: string) =>
    apiRequest("DELETE", `/api/users/${id}`),
  
  // Events
  getEvents: () =>
    apiRequest("GET", "/api/events"),
  
  getEvent: (id: number) =>
    apiRequest("GET", `/api/events/${id}`),
  
  createEvent: (eventData: any) =>
    apiRequest("POST", "/api/events", eventData),
  
  updateEvent: (id: number, eventData: any) =>
    apiRequest("PUT", `/api/events/${id}`, eventData),
  
  deleteEvent: (id: number) =>
    apiRequest("DELETE", `/api/events/${id}`),
  
  // Participations
  getParticipations: () =>
    apiRequest("GET", "/api/participations"),
  
  getParticipationsByMember: (memberId: number) =>
    apiRequest("GET", `/api/participations/member/${memberId}`),
  
  getParticipationsByEvent: (eventId: number) =>
    apiRequest("GET", `/api/participations/event/${eventId}`),
  
  createParticipation: (participationData: any) =>
    apiRequest("POST", "/api/participations", participationData),
  
  deleteParticipation: (id: number) =>
    apiRequest("DELETE", `/api/participations/${id}`),
  
  // Payments
  getPayments: () =>
    apiRequest("GET", "/api/payments"),
  
  getPaymentsByMember: (memberId: number) =>
    apiRequest("GET", `/api/payments/member/${memberId}`),
  
  createPayment: (paymentData: any) =>
    apiRequest("POST", "/api/payments", paymentData),
  
  updatePayment: (id: number, paymentData: any) =>
    apiRequest("PUT", `/api/payments/${id}`, paymentData),
  
  // Notifications
  getNotifications: () =>
    apiRequest("GET", "/api/notifications"),
  
  createNotification: (notificationData: any) =>
    apiRequest("POST", "/api/notifications", notificationData),
  
  markNotificationAsRead: (id: number) =>
    apiRequest("PUT", `/api/notifications/${id}/read`),
  
  deleteNotification: (id: number) =>
    apiRequest("DELETE", `/api/notifications/${id}`),
  
  // Stats
  getStats: () =>
    apiRequest("GET", "/api/stats"),
    
  // Email
  sendConfirmationEmail: (data: { userId: number; eventId: number; places: number }) =>
    apiRequest("POST", "/api/email/confirm-registration", data),
};
