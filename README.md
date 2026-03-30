# Sintelo — sitio web

Sitio construido con [Astro](https://astro.build) + deploy en [Vercel](https://vercel.com).

## Cómo correrlo localmente

```bash
npm install
npm run dev
```

Abre http://localhost:4321

## Cómo publicar un artículo nuevo

1. Crea un archivo `.md` en `src/content/blog/`
2. Usa este formato al inicio del archivo:

```markdown
---
titulo: "El título de tu artículo"
fecha: 2025-04-01
categoria: ROIC
descripcion: Un resumen de una oración que aparece en las tarjetas del blog.
---

Aquí va el contenido del artículo en Markdown normal.

## Un subtítulo

Párrafo de texto...
```

3. Guarda el archivo
4. Haz `git add . && git commit -m "nuevo artículo" && git push`
5. Vercel lo publica automáticamente en ~30 segundos

## Deploy en Vercel

1. Sube este proyecto a GitHub
2. Entra a [vercel.com](https://vercel.com) y haz clic en "Add New Project"
3. Importa tu repo de GitHub
4. Vercel detecta Astro automáticamente — solo haz clic en "Deploy"
5. Conecta tu dominio sintelo.com en Settings → Domains

## Estructura del proyecto

```
src/
├── content/
│   └── blog/          ← Aquí van los artículos (.md)
│       ├── ebitda-efectivo.md
│       ├── calcular-roic.md
│       └── due-diligence-mexico.md
├── layouts/
│   └── Layout.astro   ← Nav y footer compartidos
├── pages/
│   ├── index.astro    ← Página principal
│   └── blog/
│       ├── index.astro     ← Lista de artículos
│       └── [slug].astro    ← Artículo individual
└── styles/
    └── global.css     ← Estilos globales
```
