// Central icon registry — semantic name -> Font Awesome class string.
// Change an icon in one place; never hardcode fa-classes (or emoji) in pages.
// Using Font Awesome Free (fa-solid / fa-regular / fa-brands only).
export const ICONS = {
  brand: 'fa-solid fa-book-open-reader',
  greeting: 'fa-regular fa-face-smile',
  tests: 'fa-solid fa-file-lines',
  trophy: 'fa-solid fa-trophy',
  headphones: 'fa-solid fa-headphones',
  results: 'fa-solid fa-chart-simple',
  author: 'fa-solid fa-pen-to-square',
  empty: 'fa-solid fa-inbox',
  timer: 'fa-regular fa-clock',
  full: 'fa-solid fa-bullseye',
  practice: 'fa-solid fa-seedling',
  expired: 'fa-solid fa-hourglass-end',
  correct: 'fa-solid fa-circle-check',
  wrong: 'fa-solid fa-circle-xmark',
  explanation: 'fa-regular fa-lightbulb',
  rocket: 'fa-solid fa-rocket',
  image: 'fa-regular fa-image',
  audio: 'fa-solid fa-volume-high',
  audioPlaying: 'fa-solid fa-volume-high',
  audioLocked: 'fa-solid fa-volume-xmark',
  play: 'fa-solid fa-play',
  spinner: 'fa-solid fa-spinner fa-spin',
  published: 'fa-solid fa-circle-check',
  google: 'fa-brands fa-google',
  facebook: 'fa-brands fa-facebook',
  upload: 'fa-solid fa-cloud-arrow-up',
  filePdf: 'fa-solid fa-file-lines',
  trash: 'fa-solid fa-trash',
  extract: 'fa-solid fa-wand-magic-sparkles',
  reviewList: 'fa-solid fa-list-check',
  chevronDown: 'fa-solid fa-chevron-down',
} as const;

export type IconName = keyof typeof ICONS;
