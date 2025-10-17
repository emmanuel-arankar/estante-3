import { Transition, Variants } from 'framer-motion';


export const itemVariants: Variants = {
  hidden: { opacity: 0, y: -5 }, // # atualizado
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 5 }, // # atualizado
};

export const tabContentVariants: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 10 },
};

export const mainPageFadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

export const SMOOTH_TRANSITION: Transition = {
  duration: 0.28, // # atualizado
  ease: [0.4, 0, 0.2, 1],
};

export const MAIN_PAGE_TRANSITION: Transition = {
  duration: 0.3, // # atualizado
  ease: 'easeInOut',
};

