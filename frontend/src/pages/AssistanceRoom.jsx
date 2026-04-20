import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Pause, Play, Camera,
  Copy, Check, QrCode, ArrowLeft, Link as LinkIcon,
} from 'lucide-react';
import QrCodeImg from '../components/ui/QrCode.jsx';
import AnnotationCanvas from '../components/assistance/AnnotationCanvas.jsx';
import AttachCaptureModal from '../components/assistance/AttachCaptureModal.jsx';
import { createHostPeer, getLocalMedia } from '../lib/peerClient.js';
import { useToast } from '../components/ui/Toast.jsx';

// Vue technicien dans une room de télé-assistance. Attend qu'un client
// se connecte, affiche les deux vidéos, permet de figer le flux distant,
// annoter, capturer une photo et la rattacher à un équipement.
export default function AssistanceRoom() {
  const { roomId } = useParams();
  const joinUrl = `${window.location.origin}/join/${roomId}`;
  const { success, error } = useToast();

  const peerRef = useRef(null);
  const callRef = useRef(null);
  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);
  const [localStream,  setLocalStream]  = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [status, setStatus] = useState('init'); // init | waiting | connected | ended | error
  const [errMsg, setErrMsg] = useState(null);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const [frozenUrl, setFrozenUrl] = useState(null);
  const [annotationUrl, setAnnotationUrl] = useState(null);
  const [pendingCapture, setPendingCapture] = useState(null);
  const [copied, setCopied] = useState(false);

  // Init Peer + media
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stream = await getLocalMedia();
        if (!mounted) return;
        setLocalStream(stream);
        const peer = createHostPeer(roomId);
        peerRef.current = peer;
        peer.on('open', () => { if (mounted) setStatus('waiting'); });
        peer.on('call', (call) => {
          call.answer(stream);
          callRef.current = call;
          call.on('stream', (rs) => { setRemoteStream(rs); setStatus('connected'); });
          call.on('close', () => setStatus('ended'));
        });
        peer.on('error', (e) => {
          setErrMsg(e.message);
          setStatus('error');
        });
      } catch (e) {
        setErrMsg(e.message);
        setStatus('error');
      }
    })();
    return () => {
      mounted = false;
      callRef.current?.close();
      peerRef.current?.destroy();
    };
  }, [roomId]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const toggleMic = () => {
    if (!localStream) return;
    localStream.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    setMicOn((v) => !v);
  };
  const toggleCam = () => {
    if (!localStream) return;
    localStream.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
    setCamOn((v) => !v);
  };

  const hangup = () => {
    callRef.current?.close();
    peerRef.current?.destroy();
    setStatus('ended');
    localStream?.getTracks().forEach((t) => t.stop());
  };

  const freeze = () => {
    const v = remoteVideoRef.current;
    if (!v || !remoteStream) return;
    const canvas = document.createElement('canvas');
    canvas.width  = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d').drawImage(v, 0, 0);
    setFrozenUrl(canvas.toDataURL('image/jpeg', 0.9));
  };
  const unfreeze = () => setFrozenUrl(null);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
      success('Lien copié');
    } catch { error('Impossible de copier'); }
  };

  const openAnnotation = () => {
    if (frozenUrl) setAnnotationUrl(frozenUrl);
  };

  const onAnnotationExport = (blob) => {
    const url = URL.createObjectURL(blob);
    setPendingCapture({ blob, url });
    setAnnotationUrl(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/assistance" className="btn btn-ghost btn-sm">
          <ArrowLeft size={14} /> Retour
        </Link>
        <h1 className="text-xl font-semibold">Session d'assistance</h1>
        <span className="ref text-xs text-muted">· {roomId}</span>
        <div className="flex-1" />
        <StatusBadge status={status} />
      </div>

      {/* Lien & QR d'invitation — affiché tant que personne n'est connecté */}
      {status !== 'connected' && status !== 'ended' && (
        <div className="card p-4 grid md:grid-cols-[auto_1fr] gap-5 items-center">
          <div className="bg-white p-2 rounded-xl">
            <QrCodeImg value={joinUrl} size={140} />
          </div>
          <div className="min-w-0 space-y-3">
            <div className="text-sm">
              <div className="text-muted text-xs mb-1">Lien d'invitation client</div>
              <div className="flex gap-2 items-center">
                <code className="ref text-xs bg-bg-2 border border-border rounded-lg px-3 py-2 truncate flex-1">
                  {joinUrl}
                </code>
                <button className="btn btn-sm" onClick={copyLink}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
                <a className="btn btn-sm" href={joinUrl} target="_blank" rel="noreferrer" title="Tester">
                  <LinkIcon size={14} />
                </a>
              </div>
            </div>
            <div className="text-xs text-muted flex items-center gap-2">
              <QrCode size={12} /> Le client scanne le QR ou ouvre le lien sur son téléphone.
            </div>
          </div>
        </div>
      )}

      {errMsg && (
        <div className="card p-4 text-sm text-bad">Erreur : {errMsg}</div>
      )}

      {/* Vidéos */}
      <div className="grid md:grid-cols-[1fr_280px] gap-3">
        <div className="relative card overflow-hidden aspect-video bg-black">
          {frozenUrl ? (
            <img src={frozenUrl} alt="frame figée" className="w-full h-full object-contain" />
          ) : (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
          )}
          {!remoteStream && status !== 'connected' && (
            <div className="absolute inset-0 grid place-items-center text-muted text-sm">
              {status === 'waiting' ? 'En attente du client…' :
               status === 'init'    ? 'Initialisation…' :
               status === 'ended'   ? 'Session terminée' : ''}
            </div>
          )}
          {frozenUrl && (
            <div className="absolute top-3 left-3 badge badge-info">Image figée</div>
          )}
        </div>

        <div className="relative card overflow-hidden aspect-video md:aspect-auto md:h-auto bg-black">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute top-2 left-2 text-[10px] uppercase tracking-wide text-white/80 bg-black/50 px-2 py-0.5 rounded">Toi</div>
        </div>
      </div>

      {/* Controls */}
      <div className="card p-3 flex flex-wrap items-center gap-2 justify-center">
        <button className={`btn ${micOn ? '' : 'btn-danger'}`} onClick={toggleMic} title={micOn ? 'Couper le micro' : 'Activer le micro'}>
          {micOn ? <Mic size={14} /> : <MicOff size={14} />}
        </button>
        <button className={`btn ${camOn ? '' : 'btn-danger'}`} onClick={toggleCam} title={camOn ? 'Couper la caméra' : 'Activer la caméra'}>
          {camOn ? <Video size={14} /> : <VideoOff size={14} />}
        </button>
        <div className="h-6 w-px bg-border mx-1" />
        {frozenUrl ? (
          <>
            <button className="btn" onClick={unfreeze}>
              <Play size={14} /> Reprendre le direct
            </button>
            <button className="btn btn-primary" onClick={openAnnotation}>
              <Camera size={14} /> Annoter & capturer
            </button>
          </>
        ) : (
          <button className="btn" onClick={freeze} disabled={!remoteStream}>
            <Pause size={14} /> Figer l'image
          </button>
        )}
        <div className="flex-1" />
        <button className="btn btn-danger" onClick={hangup}>
          <PhoneOff size={14} /> Raccrocher
        </button>
      </div>

      {annotationUrl && (
        <AnnotationCanvas
          imageUrl={annotationUrl}
          onExport={onAnnotationExport}
          onClose={() => setAnnotationUrl(null)}
        />
      )}

      {pendingCapture && (
        <AttachCaptureModal
          capture={pendingCapture}
          onClose={() => { URL.revokeObjectURL(pendingCapture.url); setPendingCapture(null); }}
          onAttached={() => { URL.revokeObjectURL(pendingCapture.url); setPendingCapture(null); success('Photo rattachée'); }}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    init:      { label: 'Initialisation', cls: 'badge-info'  },
    waiting:   { label: 'En attente',     cls: 'badge-warn'  },
    connected: { label: 'Connecté',       cls: 'badge-good'  },
    ended:     { label: 'Terminée',       cls: 'badge-ko'    },
    error:     { label: 'Erreur',         cls: 'badge-bad'   },
  };
  const m = map[status] ?? map.init;
  return <span className={`badge ${m.cls}`}>{m.label}</span>;
}
