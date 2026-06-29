import { BrowserRouter } from "react-router-dom";
import AppRouter from "./routes/AppRouter.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import AppLoader from "./components/common/AppLoader.jsx";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppLoader />
        <AppRouter />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

