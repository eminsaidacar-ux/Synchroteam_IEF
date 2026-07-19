import { test, expect } from '@playwright/test';

// Scénario coupure réseau (chantier 3.2, ordre de mission n°2) :
// 1. préparation en ligne (site + équipement) ;
// 2. coupure réseau (context.setOffline) → l'indicateur passe « Hors ligne » ;
// 3. écriture (édition d'équipement) → mise en file dans l'outbox IndexedDB,
//    l'indicateur affiche le nombre d'écritures en attente ;
// 4. retour du réseau → sync automatique (événement `online`), la file se
//    vide et la donnée est bien rejouée vers le stockage.

test.beforeEach(async ({ page }) => {
  // Hermétique : les webfonts externes (fonts.googleapis.com, rsms.me) ne
  // doivent pas bloquer l'événement `load` dans un environnement sans accès
  // internet direct.
  await page.route(/fonts\.googleapis\.com|fonts\.gstatic\.com|rsms\.me/, (r) => r.abort());
  await page.goto('/');
  await page.evaluate(() => window.__ief_reset?.());
  await page.reload();
});

test('écriture hors ligne mise en file puis synchronisée au retour du réseau', async ({ page, context }) => {
  // --- Préparation en ligne : un site et un équipement ---
  await page.goto('/sites');
  await page.getByRole('button', { name: /Nouveau site/i }).click();
  // Premier champ du formulaire de site = « Nom » (labels non associés en ARIA).
  await page.getByRole('main').getByRole('textbox').first().fill('Site Offline E2E');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await page.getByText('Site Offline E2E').click();

  await page.getByRole('button', { name: /Équipement/ }).click();
  await page.getByRole('button', { name: 'RDC' }).first().click();
  await page.getByRole('button', { name: /Créer/ }).click();
  await expect(page.getByRole('heading', { name: 'Caractéristiques' })).toBeVisible();

  // L'indicateur de sync est présent et au repos.
  const badge = page.getByTestId('sync-badge');
  await expect(badge).toHaveAttribute('data-state', 'ok');

  // --- Coupure réseau ---
  await context.setOffline(true);
  await expect(badge).toHaveAttribute('data-state', 'offline');

  // --- Écriture hors ligne : édition de l'équipement ---
  await page.locator('textarea').fill('Saisie effectuée hors ligne');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();

  // L'écriture est en file dans l'outbox, pas perdue.
  await expect(badge).toContainText('1 en attente');

  // --- Retour du réseau : sync automatique ---
  await context.setOffline(false);
  await expect(badge).toHaveAttribute('data-state', 'ok', { timeout: 10_000 });

  // La donnée a été rejouée vers le stockage réel (localStorage en mode dev).
  const persisted = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('ief:equipements') ?? '[]')
  );
  expect(persisted.some((e) => e.observations === 'Saisie effectuée hors ligne')).toBe(true);

  // Et l'outbox est vide : l'édition survit à un rechargement complet.
  await page.reload();
  await expect(page.getByTestId('sync-badge')).toHaveAttribute('data-state', 'ok');
});
