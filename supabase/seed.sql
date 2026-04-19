-- IEF Audit — Seed de démonstration
-- À exécuter APRÈS les migrations, et après avoir créé un utilisateur via Supabase Auth.

do $$
declare
  v_org  uuid;
  v_site uuid;
begin
  insert into public.organisations (name) values ('IEF & CO')
    returning id into v_org;

  -- Assigner l'org à tous les utilisateurs existants sans org
  update public.users set organisation_id = v_org, role = 'admin'
  where organisation_id is null;

  insert into public.sites (organisation_id, name, address, ref_affaire)
  values (v_org, 'Mosquée Boulogne-Billancourt', '92100 Boulogne-Billancourt', 'IEF-2025-001')
  returning id into v_site;

  insert into public.equipements (site_id, famille, ref, niveau, zone, emplacement, specs, etat, priorite)
  values
    (v_site, 'porte', 'P001-SS-PC-MET-CF60', 'SS', 'PC', 'Local technique',
     '{"type_ouvrage":"Simple vantail","materiau":"MET","classe_securite":"CF60","largeur_mm":900,"hauteur_mm":2100,"sens_ouverture":"Gauche"}'::jsonb,
     'Mauvais', 'Urgente'),
    (v_site, 'porte', 'P002-RDC-ENT-MET-STD', 'RDC', 'Entrée', 'Hall principal',
     '{"type_ouvrage":"Double vantaux","materiau":"MET","classe_securite":"STD","largeur_mm":1600,"hauteur_mm":2400,"sens_ouverture":"Double"}'::jsonb,
     'Bon', 'Normale');
end $$;
