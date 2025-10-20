import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs, TabsList, TabsTrigger } from './tabs';

interface AnimatedTabsProps {
  value: string;
  tabs: Array<{ value: string; label: string; onClick: () => void }>;
  className?: string;
}

const tabVariants = {
  initial: { opacity: 0, y: -5 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 0.2, 1] as const
    }
  },
  exit: {
    opacity: 0,
    y: 5,
    transition: {
      duration: 0.15,
      ease: [0.4, 0, 1, 1] as const
    }
  }
};

export const AnimatedTabs: React.FC<AnimatedTabsProps> = ({ value, tabs, className }) => {
  return (
    <Tabs value={value} className={className}>
      <TabsList className="w-full justify-start gap-4 bg-transparent border-b border-gray-200 rounded-none h-auto p-0">
        <AnimatePresence mode="wait">
          {tabs.map((tab) => (
            <motion.div
              key={tab.value}
              variants={tabVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              layout
            >
              <TabsTrigger
                value={tab.value}
                onClick={tab.onClick}
                className="data-[state=active]:border-b-2 data-[state=active]:border-emerald-600 rounded-none bg-transparent px-4 py-2 transition-colors"
              >
                {tab.label}
              </TabsTrigger>
            </motion.div>
          ))}
        </AnimatePresence>
      </TabsList>
    </Tabs>
  );
};
