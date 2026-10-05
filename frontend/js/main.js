import { mountShell } from './ui/shell.js';
import { mountApp } from './ui/app.js';
import { bindHeaderScroll, lockPageZoom } from './ui/motion.js';

mountShell();
mountApp();
bindHeaderScroll();
lockPageZoom();
