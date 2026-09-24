import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar"
import ScrollToTop from "./components/ScrollToTop"
import CircuitMaps from "./pages/CircuitMaps"
import CircuitDetails from "./pages/CircuitDetails"
import Drivers from "./pages/Drivers"
import DriverDetails from "./pages/DriverDetails"
import GrandPrix from "./pages/RaceWeekend"
import GrandPrixDetails from "./pages/RaceWeekendDetails"
import LandingPage from "./pages/LandingPage"
import Teams from "./pages/Teams"
import TeamDetails from "./pages/TeamDetails"
import AuthPage from "./pages/AuthPage";
import Preferences from "./pages/Preferences";
import Profile from "./pages/Profile";
import ProtectedRoute from "./components/ProtectedRoute";
import DriverComparison from "./pages/DriverComparison";
import TeamComparison from "./pages/TeamComparison";
import F1Dictionary from "./pages/F1Dictionary";
import DictionaryCategory from "./pages/DictionaryCategory";
import DictionaryTerm from "./pages/DictionaryTerm";
import NewsPage from "./pages/NewsPage";
import "./App.css";


/* the auth page uses its own minimal top bar (wordmark + back-to-home)
   instead of the full site navigation, per the auth redesign brief */
function AppShell() {
  const location = useLocation();
  const isAuthPage = location.pathname === "/auth";

  return (
    <>
      <ScrollToTop />
      {!isAuthPage && <Navbar />}
      <Routes>
        <Route path="/" element ={<LandingPage/>}/>
        <Route path="/drivers" element={<Drivers/>}/>
        <Route path="/drivers/:year/:id" element={<DriverDetails/>}/>
        <Route path="/teams" element={<Teams />} />
        <Route path="/teams/:year/:id" element={<TeamDetails/>}/>
        <Route path="/circuitmaps" element={<CircuitMaps />} />
        <Route path="/circuitmaps/:id" element={<CircuitDetails/>}/>
        <Route path="/grandprixdashboard" element={<GrandPrix/>}/>
        <Route path="/grandprixdashboard/:year/:id" element={<GrandPrixDetails/>}/>
        <Route path="/preferences" element={<ProtectedRoute><Preferences /></ProtectedRoute>}/>
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/compare-drivers" element={<DriverComparison />} />
        <Route path="/compare-teams" element={<TeamComparison />} />
        <Route path="/dictionary" element={<F1Dictionary />} />
        <Route path="/dictionary/category/:categorySlug" element={<DictionaryCategory />} />
        <Route path="/dictionary/:slug" element={<DictionaryTerm />} />
        <Route path="/news" element={<NewsPage />} />
        <Route path="/auth" element={<AuthPage />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

export default App