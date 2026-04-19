import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

// Composant d'affichage d'un QR code en PNG base64.
// Construit automatiquement une URL de deep-link vers l'équipement.
export function qrUrlFor({ siteId, equipementId }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/sites/${siteId}/audit/${equipementId}`;
}

export default function QrCode({ value, size = 160, className = '' }) {
  const [dataUrl, setDataUrl] = useState(null);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f1117', light: '#ffffff' },
    }).then((url) => { if (alive) setDataUrl(url); });
    return () => { alive = false; };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        className={`bg-border animate-pulse rounded ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return <img src={dataUrl} alt="QR code" width={size} height={size} className={className} />;
}
