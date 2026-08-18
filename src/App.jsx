import { Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Members from "./pages/Members.jsx";
import MemberDetail from "./pages/MemberDetail.jsx";
import Providers from "./pages/Providers.jsx";
import ProviderDetail from "./pages/ProviderDetail.jsx";
import FraudRings from "./pages/FraudRings.jsx";
import FraudRingDetail from "./pages/FraudRingDetail.jsx";

export default function App() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/members" element={<Members />} />
          <Route path="/members/:id" element={<MemberDetail />} />
          <Route path="/providers" element={<Providers />} />
          <Route path="/providers/:id" element={<ProviderDetail />} />
          <Route path="/fraud-rings" element={<FraudRings />} />
          <Route path="/fraud-rings/:providerId/:sharedNodeId" element={<FraudRingDetail />} />
        </Routes>
      </main>
    </div>
  );
}
