/* Tech-stack icons as inline SVG. window.STACK_ICONS[name] -> svg string. */
(() => {
  const svg = (body, color) => `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  const icons = {
    react: svg('<circle cx="12" cy="12" r="1.6" fill="#61dafb" stroke="none"/><ellipse cx="12" cy="12" rx="9" ry="3.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)"/>', '#61dafb'),
    next: svg('<circle cx="12" cy="12" r="9"/><path d="M9 8v8M9 8l7 9M15 8v5"/>', '#ffffff'),
    vue: svg('<path d="M3 5h4l5 8 5-8h4L12 20z"/><path d="M8.5 5H12l3.5 0" opacity="0.6"/>', '#42b883'),
    angular: svg('<path d="M12 3l8 3-1.3 11L12 21l-6.7-4L4 6z"/><path d="M12 7l-3.5 8h1.8l.8-2h1.8l.8 2h1.8z"/>', '#dd0031'),
    svelte: svg('<path d="M15 4c2.5-1.5 6 1 5 4.5-.6 2-2.5 3-5 4.5l-4 2.3c-2.5 1.5-4.5 2.5-5 4.5"/><path d="M9 20c-2.5 1.5-6-1-5-4.5.6-2 2.5-3 5-4.5l4-2.3c2.5-1.5 4.5-2.5 5-4.5"/>', '#ff3e00'),
    vite: svg('<path d="M13 3L4 14h6l-1 7 9-11h-6z" fill="#ffc83d" stroke="none"/>', '#ffc83d'),
    electron: svg('<circle cx="12" cy="12" r="2" fill="#9feaf9" stroke="none"/><ellipse cx="12" cy="12" rx="9" ry="3.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/>', '#9feaf9'),
    node: svg('<path d="M12 3l8 4.6v8.8L12 21l-8-4.6V7.6z"/><path d="M9 15.5c.5 1 1.5 1.5 3 1.5 1.8 0 3-.8 3-2s-1.2-1.6-3-2-3-.9-3-2 1.2-2 3-2c1.3 0 2.3.5 2.8 1.4"/>', '#8cc84b'),
    laravel: svg('<path d="M4 6l4-2 4 2v4l4-2 4 2v6l-8 4-8-4z"/><path d="M8 8v6l4 2 8-4"/>', '#ff2d20'),
    php: svg('<ellipse cx="12" cy="12" rx="10" ry="6"/><path d="M7 10h2.5a1.5 1.5 0 010 3H7.8M7 10l-.8 4M11.5 9l-.8 6M14 10h2.5a1.5 1.5 0 010 3h-1.7M14 10l-.8 4"/>', '#8892bf'),
    django: svg('<path d="M9 4v12a3 3 0 01-3 3M9 9H6a3 3 0 00-3 3v1a3 3 0 003 3h3M14 8v6M14 5v.5"/>', '#44b78b'),
    python: svg('<path d="M12 3c-4 0-4 2-4 3v2h4v1H6c-1.5 0-3 1-3 4s1.5 4 3 4h2v-2.5c0-1.5 1-2.5 2.5-2.5h4c1.5 0 2.5-1 2.5-2.5V6c0-1-1-3-5-3z"/><path d="M12 21c4 0 4-2 4-3v-2h-4v-1h6c1.5 0 3-1 3-4s-1.5-4-3-4h-2v2.5c0 1.5-1 2.5-2.5 2.5h-4C8 12 7 13 7 14.5V18c0 1 1 3 5 3z"/>', '#4b8bbe'),
    go: svg('<ellipse cx="9" cy="10" rx="3" ry="2.6"/><ellipse cx="16" cy="10" rx="3" ry="2.6"/><path d="M8 14c1 2 7 2 8 0M12 12.5v1.5"/>', '#00add8'),
    rust: svg('<circle cx="12" cy="12" r="8"/><path d="M8 16V8h4.5a2 2 0 010 4H8m4.5 0l3 4"/>', '#f0a05a'),
    java: svg('<path d="M8 16c-2 .5-2 1.5 0 2 2 .5 6 .5 8 0 2-.5 2-1.5 0-2M9 13c-1 .3-1 1 0 1.3 1 .3 5 .3 6 0 1-.3 1-1 0-1.3M12 4c-2 2 2 3 0 6M14 2c-1 1.5 1 2 0 4"/>', '#f89820'),
    ruby: svg('<path d="M7 4h10l4 5-9 11L3 9z"/><path d="M3 9h18M12 20L8 9l4-5 4 5z"/>', '#cc342d'),
    docker: svg('<path d="M3 12h15a3 3 0 003-2c-1 0-2-.5-2.5-1-1 .5-2 .5-2.5 0"/><path d="M3 12c0 4 3 7 8 7 5 0 8-3 10-7M5 9h3v3H5zM9 9h3v3H9zM13 9h3v3h-3zM9 6h3v3H9z"/>', '#2496ed'),
    generic: svg('<path d="M4 5h16v14H4zM4 9h16M8 7h.01M6 7h.01"/><path d="M8 13l2 2-2 2M12 17h4"/>', '#ff5a1f'),
  };
  window.STACK_ICONS = icons;
  window.STACK_LABELS = {
    react: 'React', next: 'Next.js', vue: 'Vue', angular: 'Angular', svelte: 'Svelte', vite: 'Vite', electron: 'Electron',
    node: 'Node.js', laravel: 'Laravel', php: 'PHP', django: 'Django', python: 'Python', go: 'Go', rust: 'Rust', java: 'Java',
    ruby: 'Ruby', docker: 'Docker', generic: 'Project',
  };
})();
