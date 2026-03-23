// Derived selectors — computed values from stores

import { useAcademicsStore } from './stores/academics';

// Get all sections flat from all classes
export const useAllSections = () => {
  const classes = useAcademicsStore(s => s.classes);
  return classes.flatMap(c => c.sections.map(s => ({ ...s, className: c.name })));
};

// Get current session id
export const useCurrentSessionId = () => {
  const { currentSession, activeSessionId } = useAcademicsStore();
  return activeSessionId || currentSession?.id || '';
};
