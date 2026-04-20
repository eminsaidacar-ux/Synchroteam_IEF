import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

// Fil d'Ariane minimal Apple-like. items: [{ label, to? }], le dernier
// est le contexte courant (non cliquable).
export default function Breadcrumb({ items = [] }) {
  if (items.length === 0) return null;
  return (
    <nav className="flex items-center gap-1 text-xs text-muted" aria-label="Breadcrumb">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1 min-w-0">
            {item.to && !isLast ? (
              <Link to={item.to} className="hover:text-text transition-colors truncate max-w-[200px]">
                {item.label}
              </Link>
            ) : (
              <span className={`truncate max-w-[200px] ${isLast ? 'text-text' : ''}`}>{item.label}</span>
            )}
            {!isLast && <ChevronRight size={12} className="text-subtle shrink-0" />}
          </span>
        );
      })}
    </nav>
  );
}
