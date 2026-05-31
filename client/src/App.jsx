import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar"
import CircuitMaps from "./pages/CircuitMaps"
import CircuitDetails from "./pages/CircuitDetails"
import Drivers from "./pages/Drivers"
import DriverDetails from "./pages/DriverDetails"
import GrandPrix from "./pages/GrandPrix"
import GrandPrixDetails from "./pages/GrandPrixDetails"
import LandingPage from "./pages/LandingPage"
import Teams from "./pages/Teams"
import TeamDetails from "./pages/TeamDetails"


function App() {

  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element ={<LandingPage/>}/>
        <Route path="/drivers" element={<Drivers/>}/>
        <Route path="/drivers/:id" element={<DriverDetails/>}/>
        <Route path="/teams" element={<Teams />} />
        <Route path="/teams/:id" element={<TeamDetails/>}/>
        <Route path="/circuitmaps" element={<CircuitMaps />} />
        <Route path="/circuitmaps/:id" element={<CircuitDetails/>}/>
        <Route path="/grandprixdashboard" element={<GrandPrix/>}/>
        <Route path="/grandprixdashboard/:id" element={<GrandPrixDetails/>}/>
      </Routes>
    </BrowserRouter>
  )

}

export default App