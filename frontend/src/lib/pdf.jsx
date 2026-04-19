// Génération de rapport PDF côté client via @react-pdf/renderer.
// Phase 3 : migrer vers une Edge Function Supabase (Puppeteer) pour rapports
// volumineux afin de libérer le thread UI mobile.

import { Document, Page, Text, View, StyleSheet, Image, pdf } from '@react-pdf/renderer';
import { supabase, PHOTOS_BUCKET } from './supabase.js';
import { familleLabel } from './familles.js';
import { hashSnapshot } from './hash.js';

const styles = StyleSheet.create({
  page:      { padding: 32, fontFamily: 'Helvetica', fontSize: 10, color: '#0f1117' },
  header:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, borderBottom: '1 solid #ff6b00', paddingBottom: 8 },
  brand:     { color: '#ff6b00', fontWeight: 700, fontSize: 16 },
  meta:      { fontSize: 9, color: '#444' },
  h1:        { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  h2:        { fontSize: 12, fontWeight: 700, marginTop: 12, marginBottom: 6 },
  small:     { fontSize: 9, color: '#555' },
  equip:     { marginTop: 12, paddingTop: 8, borderTop: '1 solid #ddd' },
  ref:       { fontFamily: 'Courier', fontWeight: 700 },
  badges:    { flexDirection: 'row', gap: 4, marginVertical: 4 },
  badge:     { fontSize: 9, padding: '2 6', borderRadius: 3, color: '#fff' },
  grid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  photo:     { width: 150, height: 110, objectFit: 'cover', border: '1 solid #ccc', borderRadius: 3 },
  kv:        { flexDirection: 'row', marginTop: 2 },
  k:         { width: 110, color: '#555' },
  v:         { flex: 1 },
  footer:    { position: 'absolute', bottom: 16, left: 32, right: 32, fontSize: 8, color: '#888', textAlign: 'center' },
  certBlock: { marginTop: 24, paddingTop: 12, borderTop: '1 solid #ddd' },
  sigGrid:   { flexDirection: 'row', gap: 24, marginTop: 8 },
  sigBox:    { flex: 1 },
  sigLabel:  { fontSize: 9, color: '#555', marginBottom: 4 },
  sigImg:    { width: 220, height: 80, objectFit: 'contain' },
  hashLine:  { fontFamily: 'Courier', fontSize: 8, color: '#444', marginTop: 6 },
});

const BADGE_COLORS = {
  Bon: '#22c55e', Moyen: '#f59e0b', Mauvais: '#ef4444', 'Hors service': '#a855f7',
  Normale: '#6b7280', Importante: '#f59e0b', Urgente: '#ef4444',
};

async function signedUrl(path) {
  const { data, error } = await supabase.storage.from(PHOTOS_BUCKET).createSignedUrl(path, 600);
  if (error) return null;
  return data.signedUrl;
}

async function enrichPhotos(equipements) {
  const out = [];
  for (const e of equipements) {
    const photos = (e.photos ?? []).filter((p) => p.inclure_pdf);
    const urls   = await Promise.all(photos.map((p) => signedUrl(p.storage_path)));
    out.push({ ...e, _photoUrls: urls.filter(Boolean) });
  }
  return out;
}

function Badge({ label, color }) {
  if (!label) return null;
  return <Text style={[styles.badge, { backgroundColor: color ?? '#6b7280' }]}>{label}</Text>;
}

function specLines(famille, specs = {}) {
  const items = [];
  const push = (k, v) => { if (v != null && v !== '') items.push([k, String(v)]); };
  switch (famille) {
    case 'porte':
      push("Type d'ouvrage", specs.type_ouvrage);
      push('Matériau',       specs.materiau);
      push('Classe',         specs.classe_securite);
      push('Dimensions',     specs.largeur_mm && specs.hauteur_mm ? `${specs.largeur_mm} × ${specs.hauteur_mm} mm` : null);
      push('Sens',           specs.sens_ouverture);
      break;
    case 'fenetre':
      push('Type',           specs.type);
      push('Matériau',       specs.materiau);
      push('Vitrage',        [specs.vitrage_composition, specs.vitrage_type].filter(Boolean).join(' · '));
      push('Dimensions',     specs.largeur_mm && specs.hauteur_mm ? `${specs.largeur_mm} × ${specs.hauteur_mm} mm` : null);
      push('Vantaux',        specs.nb_vantaux);
      break;
    default:
      Object.entries(specs).forEach(([k, v]) => push(k, v));
  }
  return items;
}

function Report({ site, equipements, famille, niveau, org, generatedAt, signature, signedBy, hash }) {
  const title = 'Rapport d\'audit — équipements';
  const scope = [
    famille ? familleLabel(famille) : 'Toutes familles',
    niveau  ? `Niveau ${niveau}`    : 'Tous niveaux',
  ].join(' · ');

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>{org ?? 'IEF & CO'}</Text>
            <Text style={styles.meta}>Plateforme d'audit — {generatedAt}</Text>
          </View>
          <View>
            <Text style={[styles.meta, { textAlign: 'right' }]}>{site.ref_affaire ?? ''}</Text>
          </View>
        </View>

        <Text style={styles.h1}>{title}</Text>
        <Text style={styles.small}>{site.name}{site.address ? ` — ${site.address}` : ''}</Text>
        <Text style={styles.small}>{scope} · {equipements.length} équipement(s)</Text>

        {equipements.map((e) => (
          <View style={styles.equip} key={e.id} wrap={false}>
            <Text>
              <Text style={styles.ref}>{e.ref}</Text>
              <Text style={styles.small}>
                {'  '}{familleLabel(e.famille)} · {e.niveau ?? '—'}
                {e.zone ? ` · ${e.zone}` : ''}{e.emplacement ? ` · ${e.emplacement}` : ''}
              </Text>
            </Text>

            <View style={styles.badges}>
              <Badge label={e.etat}     color={BADGE_COLORS[e.etat]} />
              <Badge label={e.priorite} color={BADGE_COLORS[e.priorite]} />
            </View>

            {specLines(e.famille, e.specs).map(([k, v]) => (
              <View style={styles.kv} key={k}>
                <Text style={styles.k}>{k}</Text>
                <Text style={styles.v}>{v}</Text>
              </View>
            ))}

            {(e.actions ?? []).length > 0 && (
              <View style={styles.kv}>
                <Text style={styles.k}>Actions</Text>
                <Text style={styles.v}>{(e.actions ?? []).join(', ')}</Text>
              </View>
            )}
            {e.observations && (
              <View style={styles.kv}>
                <Text style={styles.k}>Observations</Text>
                <Text style={styles.v}>{e.observations}</Text>
              </View>
            )}

            {(e._photoUrls ?? []).length > 0 && (
              <View style={styles.grid}>
                {e._photoUrls.map((u, i) => <Image key={i} src={u} style={styles.photo} />)}
              </View>
            )}
          </View>
        ))}

        <View style={styles.certBlock} wrap={false}>
          <Text style={{ fontSize: 11, fontWeight: 700 }}>Certification & signatures</Text>
          <View style={styles.sigGrid}>
            <View style={styles.sigBox}>
              <Text style={styles.sigLabel}>Technicien — {org ?? 'IEF & CO'}</Text>
              <View style={{ borderBottom: '1 solid #bbb', height: 40 }} />
              <Text style={{ fontSize: 8, color: '#888', marginTop: 2 }}>Nom, date, signature</Text>
            </View>
            <View style={styles.sigBox}>
              <Text style={styles.sigLabel}>Client / maître d'ouvrage</Text>
              {signature ? (
                <>
                  <Image src={signature} style={styles.sigImg} />
                  <Text style={{ fontSize: 8, color: '#333' }}>{signedBy ?? ''} · {generatedAt}</Text>
                </>
              ) : (
                <>
                  <View style={{ borderBottom: '1 solid #bbb', height: 40 }} />
                  <Text style={{ fontSize: 8, color: '#888', marginTop: 2 }}>Non signé</Text>
                </>
              )}
            </View>
          </View>
          {hash && (
            <View style={{ marginTop: 10 }}>
              <Text style={{ fontSize: 8, color: '#666' }}>
                Empreinte d'intégrité (SHA-256) du contenu du rapport. Toute altération postérieure du contenu
                produira un hash différent.
              </Text>
              <Text style={styles.hashLine}>{hash}</Text>
            </View>
          )}
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) => `${site.name} · page ${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}

export async function buildAndDownloadReport({
  site, equipements, famille, niveau, org,
  signature = null, signedBy = null,
}) {
  const enriched = await enrichPhotos(equipements);
  const generatedAt = new Date().toLocaleString('fr-FR');
  const { hash, snapshot } = await hashSnapshot({ site, equipements, famille, niveau, generatedAt });

  const blob = await pdf(
    <Report
      site={site} equipements={enriched}
      famille={famille} niveau={niveau}
      org={org} generatedAt={generatedAt}
      signature={signature} signedBy={signedBy}
      hash={hash}
    />
  ).toBlob();

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safe = site.name.replace(/[^\w\-]+/g, '_');
  a.download = `rapport_${safe}_${Date.now()}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  await supabase.from('rapports').insert({
    site_id: site.id,
    famille: famille ?? null,
    niveau:  niveau  ?? null,
  });

  // Snapshot versionné pour le diff temporel / historique.
  await supabase.from('audit_snapshots').insert({
    site_id: site.id,
    data: snapshot,
    hash_sha256: hash,
    famille_scope: famille ?? null,
    niveau_scope:  niveau  ?? null,
    signed_by: signedBy ?? null,
  });

  return { hash };
}
