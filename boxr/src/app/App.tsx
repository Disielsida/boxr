import { AuthProvider } from './providers';
import { AppRouter } from './router/AppRouter';
import './styles/global.css';

export const App = () => (
  <AuthProvider>
    <AppRouter />
  </AuthProvider>
);
