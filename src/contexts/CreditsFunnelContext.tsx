import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";

/**
 * Credits Funnel Mode Types
 * - not_logged_in: User needs to sign in first
 * - first_generation: User trying to generate for first time but no credits
 * - insufficient_credits: User has some credits but not enough for selected template
 */
export type CreditsFunnelMode =
  | "not_logged_in"
  | "first_generation"
  | "insufficient_credits";

interface CreditsFunnelState {
  isOpen: boolean;
  mode: CreditsFunnelMode | null;
  requiredCredits: number | null;
  availableCredits: number | null;
}

interface CreditsFunnelContextType extends CreditsFunnelState {
  openFunnel: (options: {
    mode: CreditsFunnelMode;
    required?: number;
    available?: number;
  }) => void;
  closeFunnel: () => void;
}

const initialState: CreditsFunnelState = {
  isOpen: false,
  mode: null,
  requiredCredits: null,
  availableCredits: null,
};

const CreditsFunnelContext = createContext<
  CreditsFunnelContextType | undefined
>(undefined);

interface CreditsFunnelProviderProps {
  children: ReactNode;
}

/**
 * Provider component for the Credits Funnel popup system.
 * Wrap your app (or layout) with this to enable credits funnel popups.
 */
export function CreditsFunnelProvider({
  children,
}: CreditsFunnelProviderProps) {
  const [state, setState] = useState<CreditsFunnelState>(initialState);

  const openFunnel = useCallback(
    ({
      mode,
      required,
      available,
    }: {
      mode: CreditsFunnelMode;
      required?: number;
      available?: number;
    }) => {
      setState({
        isOpen: true,
        mode,
        requiredCredits: required ?? null,
        availableCredits: available ?? null,
      });
    },
    []
  );

  const closeFunnel = useCallback(() => {
    setState(initialState);
  }, []);

  return (
    <CreditsFunnelContext.Provider
      value={{
        ...state,
        openFunnel,
        closeFunnel,
      }}
    >
      {children}
    </CreditsFunnelContext.Provider>
  );
}

/**
 * Hook to access the credits funnel context.
 * Must be used within a CreditsFunnelProvider.
 */
export function useCreditsFunnel(): CreditsFunnelContextType {
  const context = useContext(CreditsFunnelContext);
  if (!context) {
    throw new Error(
      "useCreditsFunnel must be used within a CreditsFunnelProvider"
    );
  }
  return context;
}
