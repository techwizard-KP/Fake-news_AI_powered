import "@fontsource/chivo/400.css";
import "@fontsource/chivo/600.css";
import "@fontsource/chivo/700.css";
import "@fontsource/chivo/900.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";

import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import { Toaster } from "sonner";

function App() {
  return (
    <div className="App min-h-screen bg-slate-50 text-slate-900" style={{ fontFamily: '"IBM Plex Sans", system-ui, sans-serif' }}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;
