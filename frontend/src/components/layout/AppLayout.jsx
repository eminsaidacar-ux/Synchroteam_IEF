import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header.jsx';
import Sidebar from './Sidebar.jsx';
import MobileNav from './MobileNav.jsx';

export default function AppLayout() {
  const location = useLocation();
  return (
    <div className="min-h-full flex flex-col">
      <Header />
      <div className="flex-1 flex max-w-[1400px] w-full mx-auto">
        <Sidebar />
        <main
          key={location.pathname}
          className="flex-1 px-4 md:px-8 py-5 pb-24 md:pb-10 w-full animate-fade-in"
        >
          <div className="max-w-5xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
