import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  arbitrum,
  base,
  mainnet,
  optimism,
  polygon,
  sepolia,
} from 'wagmi/chains';

// This configuration sets up the basic parameters for our Web3 interactions
export const config = getDefaultConfig({
  // The name that appears in wallet connection prompts
  appName: 'Helping Hand',

  // Your WalletConnect v2 project ID
  projectId: 'demo-project-id',

  // The blockchain networks we want to support
  chains: [
    // Mainnet networks
    mainnet,    // Ethereum mainnet
    polygon,    // Polygon network
    optimism,   // Optimism network
    arbitrum,   // Arbitrum network
    base,       // Base network
    sepolia,    // Sepolia testnet

    // Test networks - only enabled if NEXT_PUBLIC_ENABLE_TESTNETS is true
    ...(process.env.NEXT_PUBLIC_ENABLE_TESTNETS === 'true' ? [sepolia] : []),
  ],

  // Enable server-side rendering support
  ssr: true,
});
