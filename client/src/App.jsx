import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar"
import ScrollProgress from "./components/ScrollProgress"
import CircuitMaps from "./pages/CircuitMaps"
import CircuitDetails from "./pages/CircuitDetails"
import Drivers from "./pages/Drivers"
import DriverDetails from "./pages/DriverDetails"
import GrandPrix from "./pages/GrandPrix"
import GrandPrixDetails from "./pages/GrandPrixDetails"
import LandingPage from "./pages/LandingPage"
import Teams from "./pages/Teams"
import TeamDetails from "./pages/TeamDetails"
import AuthPage from "./pages/AuthPage";
import Preferences from "./pages/Preferences";
import Profile from "./pages/Profile";
import ProtectedRoute from "./components/ProtectedRoute";
import DriverComparison from "./pages/DriverComparison";
import TeamComparison from "./pages/TeamComparison";
import "./App.css";


function App() {

  return (
    <BrowserRouter>
      <ScrollProgress />
      <Navbar />
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
        <Route path="/auth" element={<AuthPage />} />
      </Routes>
    </BrowserRouter>
  )

}

export default App