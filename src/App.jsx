import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Devices from './pages/Devices'
import Broadcast from './pages/Broadcast'
import AutoReply from './pages/AutoReply'
import Webhook from './pages/Webhook'
import Contacts from './pages/Contacts'
import MessageLogs from './pages/MessageLogs'
import Settings from './pages/Settings'
import ApiDocs from './pages/ApiDocs'
import N8nTutorial from './pages/N8nTutorial'
import N8nSetup from './pages/N8nSetup'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import LandingPage from './pages/LandingPage'
import Inbox from './pages/Inbox'
import Templates from './pages/Templates'
import ChatbotBuilder from './pages/ChatbotBuilder'
import Security from './pages/Security'
import Analytics from './pages/Analytics'
import Integrations from './pages/Integrations'
import AIFeatures from './pages/AIFeatures'
import Billing from './pages/Billing'
import Team from './pages/Team'
import Groups from './pages/Groups'
import SmartKnowledge from './pages/SmartKnowledge'
import MonitoringDashboard from './pages/MonitoringDashboard'
import MonitoringUsers from './pages/monitoring/MonitoringUsers'
import MonitoringConnections from './pages/monitoring/MonitoringConnections'
import MonitoringIntegrations from './pages/monitoring/MonitoringIntegrations'
import MonitoringChatbots from './pages/monitoring/MonitoringChatbots'
import MonitoringBroadcasts from './pages/monitoring/MonitoringBroadcasts'
import MonitoringContacts from './pages/monitoring/MonitoringContacts'
import MonitoringWebhooks from './pages/monitoring/MonitoringWebhooks'
import { SocketProvider } from './context/SocketContext'
import './index.css'
import GoogleAnalytics from './components/GoogleAnalytics'
import { Toaster } from 'react-hot-toast'
import DeviceWatcher from './components/DeviceWatcher'
import { PWAProvider } from './components/PWAComponents'
import { ConfirmProvider } from './components/ConfirmDialog'

// Protected Route Component
const ProtectedRoute = () => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
};

// Layout with Sidebar Component
const LayoutWithSidebar = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed);

  return (
    <div className="app-layout">
      <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      <main className={`main-content ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <Outlet />
      </main>
    </div>
  );
};



function App() {
  return (
    <PWAProvider>
      <ConfirmProvider>
        <SocketProvider>
          <DeviceWatcher />
          <Toaster position="top-right" />
          <Router>
            <GoogleAnalytics />
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Protected Routes */}
              <Route element={<ProtectedRoute />}>
                <Route element={<LayoutWithSidebar />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/inbox" element={<Inbox />} />
                  <Route path="/templates" element={<Templates />} />
                  <Route path="/devices" element={<Devices />} />
                  <Route path="/broadcast" element={<Broadcast />} />
                  <Route path="/chatbot" element={<ChatbotBuilder />} />
                  <Route path="/smart-knowledge" element={<SmartKnowledge />} />
                  <Route path="/auto-reply" element={<AutoReply />} />
                  <Route path="/webhook" element={<Webhook />} />
                  <Route path="/contacts" element={<Contacts />} />
                  <Route path="/logs" element={<MessageLogs />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/integrations" element={<Integrations />} />
                  <Route path="/ai" element={<AIFeatures />} />
                  <Route path="/api-docs" element={<ApiDocs />} />
                  <Route path="/n8n-tutorial" element={<N8nTutorial />} />
                  <Route path="/n8n-setup" element={<N8nSetup />} />
                  <Route path="/security" element={<Security />} />
                  <Route path="/billing" element={<Billing />} />
                  <Route path="/team" element={<Team />} />
                  <Route path="/groups" element={<Groups />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/monitoring" element={<MonitoringDashboard />} />
                  <Route path="/monitoring/users" element={<MonitoringUsers />} />
                  <Route path="/monitoring/connections" element={<MonitoringConnections />} />
                  <Route path="/monitoring/integrations" element={<MonitoringIntegrations />} />
                  <Route path="/monitoring/chatbots" element={<MonitoringChatbots />} />
                  <Route path="/monitoring/broadcasts" element={<MonitoringBroadcasts />} />
                  <Route path="/monitoring/contacts" element={<MonitoringContacts />} />
                  <Route path="/monitoring/webhooks" element={<MonitoringWebhooks />} />
                </Route>
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </SocketProvider>
      </ConfirmProvider>
    </PWAProvider>
  )
}

export default App

