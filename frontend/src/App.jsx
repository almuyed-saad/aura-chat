import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { ThemeProvider } from './context/ThemeContext'
import { SocketProvider } from './context/SocketContext'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ChatPage from './pages/ChatPage'
import { useNotifications } from './hooks/useNotifications'

function App() {
  const { enableNotifications } = useNotifications()
  return (
    <ThemeProvider>
      <SocketProvider>   {/* ✅ SocketProvider MUST wrap the Router */}
        <Router>
          <Toaster />
          <Routes>
            <Route path="/" element={<ChatPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Routes>
        </Router>
      </SocketProvider>
    </ThemeProvider>
  )
}

export default App