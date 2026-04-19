import { Outlet } from 'react-router-dom';
import Header from './Header.jsx';
import Sidebar from './Sidebar.jsx';
import MobileNav from './MobileNav.jsx';

export default function AppLayout() {
  return (
    <div className="min-h-full flex flex-col">
      <Header />
      <div className="flex-1 flex">
        <Sidebar />
        <main className="flex-1 px-4 md:px-8 py-6 pb-24 md:pb-8 max-w-6xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
