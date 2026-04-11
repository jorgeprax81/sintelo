import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = await getCollection('blog');
  return rss({
    title: 'Sintelo — Blog',
    description: 'Ideas sobre capital, operaciones y valor en empresas industriales.',
    site: context.site,
    items: posts.map(post => ({
      title: post.data.titulo,
      pubDate: post.data.fecha,
      description: post.data.descripcion,
      link: `/blog/${post.slug}/`,
    })),
  });
}
