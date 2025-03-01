// Contract addresses
export const contractAddresses = {
  fundraiserFactory: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x308A7629a5C39f9073D4617A4e95A205d4474E07', // Using the address provided by the user
};

// Import ABI
import fundraiserFactoryABI from '../pages/abi.json';

// Export ABI
export const abis = {
  fundraiserFactory: fundraiserFactoryABI,
};

// Creating Web3 provider
export const getWeb3Provider = async () => {
  if (typeof window !== 'undefined' && window.ethereum) {
    try {
      // Request access to user's account
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      return true;
    } catch (error) {
      console.error('User rejected access to account', error);
      return false;
    }
  } else {
    console.error('Ethereum provider not found. Please install MetaMask.');
    return false;
  }
}; 