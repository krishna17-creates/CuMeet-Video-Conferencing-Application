import { Buffer } from 'buffer';

// Polyfill for `global`
if (typeof global === 'undefined') {
  window.global = window;
}

// Polyfill for `Buffer`
if (typeof Buffer === 'undefined') {
  window.Buffer = Buffer;
}