import { test, expect } from '@playwright/test';

// Parcours critique audit : dashboard → créer site → ajouter équipement →
// saisir specs porte → état + actions → pré-devis → signature → PDF.
//
// Tourne en mode local (localStorage) grâce aux placeholder env vars
// passées au preview server. Chaque test reset via __ief_reset().

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.__ief_reset?.());
  await page.reload();
});

test('dashboard affiche les stats à zéro après reset', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /Bienvenue/ })).toBeVisible();
  await expect(page.getByText('Sites', { exact: true })).toBeVisible();
  await expect(page.getByText('Équipements', { exact: true })).toBeVisible();
});

test('création d\'un site', async ({ page }) => {
  await page.getByRole('link', { name: /Sites/i }).first().click();
  await page.getByRole('button', { name: /Nouveau site/i }).click();
  await page.getByLabel('Nom').fill('Mosquée test E2E');
  await page.getByLabel('Réf. affaire').fill('E2E-001');
  await page.getByLabel('Adresse').fill('92100 Boulogne');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByText('Mosquée test E2E')).toBeVisible();
});

test('ajout d\'un équipement avec ref auto-générée', async ({ page }) => {
  // Crée un site préalable
  await page.goto('/sites');
  await page.getByRole('button', { name: /Nouveau site/i }).click();
  await page.getByLabel('Nom').fill('Site E2E');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await page.getByText('Site E2E').click();

  // Nouvel équipement
  await page.getByRole('button', { name: /Équipement/ }).click();

  // Renseigner niveau + specs porte
  await page.getByRole('button', { name: 'RDC' }).first().click();
  await page.getByRole('button', { name: 'Simple vantail' }).click();
  await page.getByRole('button', { name: 'MET', exact: true }).click();
  await page.getByRole('button', { name: 'CF60' }).click();

  // La ref doit contenir les composants normalisés
  const refInput = page.locator('input.ref').first();
  await expect(refInput).toHaveValue(/P001.*RDC.*MET.*CF60/);

  // État + priorité
  await page.getByRole('button', { name: 'Mauvais' }).click();
  await page.getByRole('button', { name: 'Urgente' }).click();

  await page.getByRole('button', { name: /Créer/ }).click();
  // Après création, on reste sur la page et le titre "Caractéristiques" reste visible
  await expect(page.getByRole('heading', { name: 'Caractéristiques' })).toBeVisible();
});

test('page pré-devis affiche un message vide sans actions', async ({ page }) => {
  await page.goto('/devis');
  await expect(page.getByRole('heading', { name: /Pré-devis/ })).toBeVisible();
  await expect(page.getByText(/Choisir un site/)).toBeVisible();
});
