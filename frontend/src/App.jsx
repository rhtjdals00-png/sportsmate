import { BrowserRouter } from "react-router-dom";
import AppRouter from "./routes/AppRouter.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import AppLoader from "./components/common/AppLoader.jsx";
import ErrorBoundary from "./components/common/ErrorBoundary.jsx";

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <AppLoader />
          <AppRouter />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;

