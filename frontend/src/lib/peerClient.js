// Wrapper léger autour de PeerJS pour la télé-assistance vidéo.
//
// Architecture : WebRTC peer-to-peer avec signaling via le broker PeerJS
// public (0.peerjs.com, gratuit, pas de clé API). Une fois la connexion
// établie, la vidéo/audio passe directement entre navigateurs (chiffré
// DTLS-SRTP, pas de serveur intermédiaire).
//
// Limites broker public : ~50 connexions concurrentes partagées. Pour
// la prod : self-hébergement du broker PeerServer (1 conteneur Node, 20
// lignes) ou swap vers Twilio/LiveKit.

import { Peer } from 'peerjs';

const ROOM_PREFIX = 'ief-audit-';

// Génère un ID court (6 chars base36 = 2+ milliards de possibilités).
export function newRoomId() {
  return Math.random().toString(36).slice(2, 8);
}

export function peerIdFor(roomId) {
  return ROOM_PREFIX + roomId;
}

// Crée un Peer pour le technicien (ID fixe basé sur roomId).
export function createHostPeer(roomId) {
  return new Peer(peerIdFor(roomId), {
    debug: 1,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    },
  });
}

// Crée un Peer pour le client (ID aléatoire auto-attribué).
export function createGuestPeer() {
  return new Peer(undefined, {
    debug: 1,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    },
  });
}

export async function getLocalMedia({ video = true, audio = true } = {}) {
  const constraints = {
    video: video ? { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } : false,
    audio: audio ? { echoCancellation: true, noiseSuppression: true } : false,
  };
  return navigator.mediaDevices.getUserMedia(constraints);
}

export async function getScreenShare() {
  return navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
}
