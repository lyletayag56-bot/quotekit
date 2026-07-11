export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ 'src/css': 'css' });

  // Safely embed a JSON object inside a single-quoted HTML attribute
  // (used to give landing-page demo widgets an inline data-config).
  eleventyConfig.addFilter('jsonAttr', (value) =>
    JSON.stringify(value)
      .replace(/&/g, '&amp;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
  );

  eleventyConfig.addFilter('year', () => new Date().getFullYear());

  return {
    dir: {
      input: 'src',
      output: '../dist',
      includes: '_includes',
      data: '_data',
    },
    htmlTemplateEngine: 'njk',
    markdownTemplateEngine: 'njk',
  };
}
