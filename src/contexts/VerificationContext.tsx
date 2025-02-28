import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface VerificationContextType {
  isVerified: boolean;
  setVerified: (value: boolean) => void;
}

const VerificationContext = createContext<VerificationContextType | undefined>(undefined);

export function VerificationProvider({ children }: { children: ReactNode }) {
  const [isVerified, setIsVerified] = useState<boolean>(false);

  // Load verification status from localStorage on mount
  useEffect(() => {
    const storedVerification = localStorage.getItem('isVerified');
    if (storedVerification) {
      setIsVerified(JSON.parse(storedVerification));
    }
  }, []);

  const setVerified = (value: boolean) => {
    setIsVerified(value);
    localStorage.setItem('isVerified', JSON.stringify(value));
  };

  return (
    <VerificationContext.Provider value={{ isVerified, setVerified }}>
      {children}
    </VerificationContext.Provider>
  );
}

export function useVerification() {
  const context = useContext(VerificationContext);
  if (context === undefined) {
    throw new Error('useVerification must be used within a VerificationProvider');
  }
  return context;
} 