import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    titulo: z.string(),
    fecha: z.date(),
    categoria: z.string(),
    descripcion: z.string(),
  }),
});

export const collections = { blog };
