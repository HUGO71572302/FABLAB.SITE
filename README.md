# FabLab — réservation de machines

Site statique (HTML / Tailwind CDN / JS) + **Supabase** (Auth, PostgreSQL, RLS). Pas de build, pas de npm.

## 1. Créer le projet Supabase

1. Compte sur [supabase.com](https://supabase.com) → **New project**.
2. **SQL Editor** → New query → coller tout le fichier `schema.sql` → **Run**.
3. **Authentication → Providers** : Email activé. Pour un établissement, tu peux désactiver la confirmation d’email (Authentication → Providers → Email → *Confirm email* off) afin que l’inscription connecte tout de suite.
4. **Project Settings → API** : copier **Project URL** et **anon public**.

## 2. Clés dans le code

Ouvre `js/config.js` et remplace les placeholders :

```js
window.FABLAB_CONFIG = {
  supabaseUrl: "https://xxxx.supabase.co",
  supabaseAnonKey: "eyJ..."
};
```

La clé **anon** est volontairement publique. Les droits réels sont dans les **policies RLS** de `schema.sql` (pas dans le JavaScript).

## 3. Promouvoir le premier FabManager

Après ta première inscription sur le site :

1. Supabase → **Table Editor** → `profiles`
2. Ligne correspondant à ton utilisateur → colonne `role` → `fabmanager`

Ou en SQL :

```sql
update public.profiles
set role = 'fabmanager'
where id = (select id from auth.users where email = 'toi@ecole.fr');
```

Les comptes suivants restent `eleve`.

## 4. Hébergement gratuit

**Vercel** (recommandé) : dépôt Git → import → pas de build, fichiers à la racine. Alternative : Netlify Drop ou GitHub Pages. Vercel est le plus simple ici (preview par branche, HTTPS, drag & drop du dossier possible).

`vercel.json` sert le site à la racine.

## 5. Parcours testé

- Inscription / connexion / déconnexion
- Liste et fiche machine + créneaux 7 jours
- Réservation (règles de sécurité cochées)
- Chevauchement refusé par contrainte `EXCLUDE USING gist` (`reservations_no_overlap`)
- File FabManager : confirmer / refuser avec motif
- Annulation d’une réservation à venir par l’élève
- CRUD machines (FabManager)

Horaires codés en dur : lun–ven 8h–18h, sam 9h–13h, dimanche fermé.

## Fichiers

| Fichier | Rôle |
|---|---|
| `schema.sql` | Tables, contrainte d’exclusion, RLS, seed machines |
| `js/config.js` | URL + clé anon |
| `js/app.js` | Client Supabase, nav, helpers |
| `index.html` … `fabmanager.html` | Pages |
