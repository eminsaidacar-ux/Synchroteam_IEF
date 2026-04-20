import { useNavigate } from 'react-router-dom';
import { Plus, Video, Info } from 'lucide-react';
import { newRoomId } from '../lib/peerClient.js';

// Dashboard Télé-assistance : point d'entrée pour créer une session.
// Une fois créée, le technicien reçoit un lien + QR à partager au client.
export default function TeleAssistance() {
  const nav = useNavigate();

  const createRoom = () => {
    const roomId = newRoomId();
    nav(`/assistance/r/${roomId}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1>Télé-assistance client</h1>
        <p className="text-muted text-sm mt-1">
          Démarre une session vidéo temps réel avec un client. Partage le lien ou le
          QR — le client ouvre sur son téléphone, montre l'équipement, tu peux figer
          l'image et annoter pour orienter l'intervention.
        </p>
      </div>

      <div className="card p-6 flex flex-col md:flex-row items-start md:items-center gap-4">
        <div className="h-14 w-14 rounded-2xl grid place-items-center shrink-0"
             style={{ background: 'linear-gradient(135deg, #ff7a1a, #b34a00)' }}>
          <Video className="text-white" size={24} />
        </div>
        <div className="flex-1">
          <div className="font-semibold">Créer une session</div>
          <div className="text-sm text-muted mt-0.5">
            Génère une room éphémère + lien sécurisé à partager au client.
          </div>
        </div>
        <button className="btn btn-primary btn-lg" onClick={createRoom}>
          <Plus size={16} /> Nouvelle session
        </button>
      </div>

      <div className="card p-4 space-y-2 text-sm">
        <div className="flex items-center gap-2 text-text2">
          <Info size={14} className="text-info" />
          <span className="font-medium">Comment ça marche</span>
        </div>
        <ol className="list-decimal pl-5 space-y-1 text-muted">
          <li>Tu crées une session → un QR + lien apparaissent.</li>
          <li>Le client ouvre le lien sur son téléphone (Safari / Chrome).</li>
          <li>Il autorise caméra + micro, sa vidéo arrive en temps réel.</li>
          <li>Tu vois ce qu'il voit. Bouton <span className="ref">Figer</span> pour
              arrêter sur une image, puis annoter + capturer une photo.</li>
          <li>Les photos capturées peuvent être rattachées à un équipement existant.</li>
        </ol>
        <p className="text-[11px] text-subtle pt-2 border-t border-border mt-3">
          Technologie : WebRTC peer-to-peer (chiffrement DTLS-SRTP), signaling via
          PeerJS Cloud. Pas de serveur média intermédiaire — flux direct navigateur-
          à-navigateur. Les sessions sont éphémères, rien n'est enregistré côté serveur.
        </p>
      </div>
    </div>
  );
}
