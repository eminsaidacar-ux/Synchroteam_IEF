import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Video, Mic, MicOff, VideoOff, PhoneOff, RotateCw, AlertCircle } from 'lucide-react';
import { createGuestPeer, peerIdFor, getLocalMedia } from '../lib/peerClient.js';

// Vue client : ouverte depuis le QR / lien envoyé par le technicien.
// Layout minimal plein écran, aucune chrome application. Demande caméra
// + micro, connecte au peer du technicien, affiche les deux flux.
export default function JoinRoom() {
  const { roomId } = useParams();
  const peerRef = useRef(null);
  const callRef = useRef(null);
  const localRef  = useRef(null);
  const remoteRef = useRef(null);
  const [localStream,  setLocalStream]  = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | asking | dialing | connected | ended | error
  const [err, setErr] = useState(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [facing, setFacing] = useState('environment');

  const startCall = async () => {
    setStatus('asking');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      setLocalStream(stream);
      setStatus('dialing');

      const peer = createGuestPeer();
      peerRef.current = peer;
      peer.on('open', () => {
        const call = peer.call(peerIdFor(roomId), stream);
        callRef.current = call;
        call.on('stream', (rs) => { setRemoteStream(rs); setStatus('connected'); });
        call.on('close', () => setStatus('ended'));
        call.on('error', (e) => { setErr(e.message); setStatus('error'); });
      });
      peer.on('error', (e) => { setErr(e.message); setStatus('error'); });
    } catch (e) {
      setErr(e.message); setStatus('error');
    }
  };

  useEffect(() => {
    if (localRef.current && localStream) localRef.current.srcObject = localStream;
  }, [localStream]);
  useEffect(() => {
    if (remoteRef.current && remoteStream) remoteRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  useEffect(() => () => {
    callRef.current?.close();
    peerRef.current?.destroy();
    localStream?.getTracks().forEach((t) => t.stop());
  }, []); // eslint-disable-line

  const toggleMic = () => {
    localStream?.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    setMicOn((v) => !v);
  };
  const toggleCam = () => {
    localStream?.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
    setCamOn((v) => !v);
  };

  const flipCamera = async () => {
    if (!localStream) return;
    const next = facing === 'environment' ? 'user' : 'environment';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: next } }, audio: true,
      });
      // Replace track dans le peer connection (PeerJS expose la peer connection)
      const newVideoTrack = stream.getVideoTracks()[0];
      const sender = callRef.current?.peerConnection?.getSenders().find((s) => s.track?.kind === 'video');
      if (sender && newVideoTrack) await sender.replaceTrack(newVideoTrack);
      localStream.getTracks().forEach((t) => t.stop());
      setLocalStream(stream);
      setFacing(next);
    } catch (e) { setErr(e.message); }
  };

  const hangup = () => {
    callRef.current?.close();
    peerRef.current?.destroy();
    localStream?.getTracks().forEach((t) => t.stop());
    setStatus('ended');
  };

  return (
    <div className="min-h-full bg-black text-white flex flex-col">
      <div className="p-3 flex items-center gap-2 border-b border-white/10 bg-black/60 backdrop-blur">
        <div className="h-6 w-6 rounded-md bg-gradient-to-br from-accent to-accent-dim" />
        <div className="text-sm">
          Session d'assistance · <span className="ref text-xs text-white/60">{roomId}</span>
        </div>
        <div className="flex-1" />
        <StatusBadge status={status} />
      </div>

      {status === 'idle' && (
        <div className="flex-1 grid place-items-center p-6">
          <div className="max-w-sm text-center space-y-4">
            <div className="h-16 w-16 rounded-2xl mx-auto grid place-items-center"
                 style={{ background: 'linear-gradient(135deg, #ff7a1a, #b34a00)' }}>
              <Video size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Rejoindre la session</h1>
              <p className="text-white/60 text-sm mt-2">
                Le technicien t'attend. Autorise l'accès à ta caméra et ton micro
                pour démarrer.
              </p>
            </div>
            <button className="btn btn-primary btn-lg w-full justify-center" onClick={startCall}>
              <Video size={16} /> Démarrer l'appel
            </button>
            <p className="text-[11px] text-white/40">
              Aucune installation. Le flux est chiffré et transite directement
              entre ton navigateur et celui du technicien.
            </p>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="flex-1 grid place-items-center p-6">
          <div className="max-w-sm text-center space-y-3">
            <AlertCircle className="mx-auto text-bad" size={32} />
            <div>
              <div className="font-semibold">Connexion impossible</div>
              <p className="text-white/60 text-sm mt-1">{err}</p>
            </div>
            <button className="btn" onClick={() => { setErr(null); setStatus('idle'); }}>
              Réessayer
            </button>
          </div>
        </div>
      )}

      {(status === 'asking' || status === 'dialing' || status === 'connected' || status === 'ended') && (
        <>
          <div className="flex-1 relative">
            <video ref={remoteRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-contain bg-black" />
            {!remoteStream && (
              <div className="absolute inset-0 grid place-items-center text-white/50 text-sm">
                {status === 'asking'  ? 'Accès caméra…' :
                 status === 'dialing' ? 'Connexion en cours…' :
                 status === 'ended'   ? 'Session terminée' : ''}
              </div>
            )}
            <video
              ref={localRef}
              autoPlay
              muted
              playsInline
              className="absolute top-3 right-3 w-24 h-32 md:w-32 md:h-40 object-cover rounded-xl border border-white/20 shadow-2xl"
            />
          </div>

          {status !== 'ended' && (
            <div className="p-4 pb-8 flex items-center justify-center gap-3 bg-black/80 backdrop-blur">
              <button className={`btn ${micOn ? '' : 'btn-danger'}`} onClick={toggleMic}>
                {micOn ? <Mic size={16} /> : <MicOff size={16} />}
              </button>
              <button className={`btn ${camOn ? '' : 'btn-danger'}`} onClick={toggleCam}>
                {camOn ? <Video size={16} /> : <VideoOff size={16} />}
              </button>
              <button className="btn" onClick={flipCamera} title="Retourner la caméra">
                <RotateCw size={16} />
              </button>
              <button className="btn btn-danger" onClick={hangup}>
                <PhoneOff size={16} /> Raccrocher
              </button>
            </div>
          )}

          {status === 'ended' && (
            <div className="p-6 text-center">
              <div className="text-sm text-white/60">La session est terminée. Tu peux fermer cet onglet.</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    idle:      { label: '—',              cls: 'bg-white/10 text-white/70' },
    asking:    { label: 'Autorisation…',  cls: 'bg-info/20 text-info' },
    dialing:   { label: 'Connexion…',     cls: 'bg-warn/20 text-warn' },
    connected: { label: 'Connecté',       cls: 'bg-good/20 text-good' },
    ended:     { label: 'Terminée',       cls: 'bg-ko/20 text-ko' },
    error:     { label: 'Erreur',         cls: 'bg-bad/20 text-bad' },
  };
  const m = map[status] ?? map.idle;
  return <span className={`text-[10px] font-semibold tracking-wide uppercase px-2 py-1 rounded-md ${m.cls}`}>{m.label}</span>;
}
