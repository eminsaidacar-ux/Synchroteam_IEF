import { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Link } from 'react-router-dom';
import { useSites } from '../hooks/useSites.js';
import { MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix des icônes par défaut de Leaflet avec Vite (les chemins vers les PNG
// intégrés ne sont pas résolus correctement en bundle).
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon   from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

L.Marker.prototype.options.icon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Vue carte des sites. Les tuiles viennent d'OpenStreetMap (libre, pas de clé).
// Les sites sans lat/lng ne sont pas affichés — ajoute les coordonnées dans
// le formulaire Site (lat/lng en degrés décimaux, ex. 48.8337, 2.2417).
export default function Carte() {
  const { data: sites = [], isLoading } = useSites();
  const placed = useMemo(
    () => sites.filter((s) => typeof s.lat === 'number' && typeof s.lng === 'number'),
    [sites]
  );

  const center = placed.length > 0
    ? [placed[0].lat, placed[0].lng]
    : [46.6, 2.5]; // centre France par défaut
  const zoom = placed.length > 0 ? 11 : 5;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Carte des sites</h1>
          <p className="text-sm text-muted">
            {placed.length} / {sites.length} site(s) placé(s). Ajoute lat/lng depuis le formulaire Site.
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted">Chargement…</p>
      ) : placed.length === 0 ? (
        <div className="card p-8 text-center text-muted">
          <MapPin className="mx-auto mb-3" />
          Aucun site géolocalisé. Édite un site pour ajouter latitude / longitude.
        </div>
      ) : (
        <div className="card overflow-hidden" style={{ height: '70vh' }}>
          <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            {placed.map((s) => (
              <Marker key={s.id} position={[s.lat, s.lng]}>
                <Popup>
                  <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 180 }}>
                    <div style={{ fontWeight: 600 }}>{s.name}</div>
                    {s.ref_affaire && (
                      <div style={{ fontFamily: '"DM Mono", monospace', fontSize: 11, color: '#666' }}>
                        {s.ref_affaire}
                      </div>
                    )}
                    {s.address && <div style={{ fontSize: 12, color: '#444' }}>{s.address}</div>}
                    <Link to={`/sites/${s.id}`}
                          style={{ fontSize: 12, color: '#ff6b00', display: 'inline-block', marginTop: 6 }}>
                      Ouvrir la fiche →
                    </Link>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}
    </div>
  );
}
