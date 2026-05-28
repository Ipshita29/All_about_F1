import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar"
import CircuitMaps from "./pages/CircuitMaps"
import Drivers from "./pages/Drivers"
import GrandPrix from "./pages/GrandPrix"
import LandingPage from "./pages/LandingPage"
import Teams from "./pages/Teams"


function App() {

  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element ={<LandingPage/>}/>
        <Route path="/drivers" element={<Drivers/>}/>
        <Route path="/teams" element={<Teams />} />
        <Route path="/circuitmaps" element={<CircuitMaps />} />
        <Route path="/grandprixdashboard" element={<GrandPrix/>}/>
      </Routes>
    </BrowserRouter>
  )

}

export default App