import React from 'react';
import { Routes, Route } from 'react-router-dom';
import CallPage from './pages/CallPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<CallPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  );
}
