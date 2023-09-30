import { z, defineCollection } from 'astro:content';

// 2. Define a `type` and `schema` for each collection
const projectCollection = defineCollection({
  type: 'content', // v2.5.0 and later
  schema: z.object({
    title: z.string(),
    year: z.number(),
    description: z.string(),
    collaborator: z.string(),
    tags: z.array(z.string()),
    url: z.string().optional(),
    image: z.string().optional(),
  }),
});

// 3. Export a single `collections` object to register your collection(s)
export const collections = {
  'projects': projectCollection,
};
