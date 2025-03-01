import { useState } from 'react';
import { ethers } from 'ethers';

declare global {
  interface Window {
    ethereum?: any;
  }
}

const ConnectWalletButton = () => {
  const [account, setAccount] = useState<string | null>(null);

  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({
          method: 'eth_requestAccounts',
        });
        setAccount(accounts[0]);
      } catch (error) {
        console.error('Error connecting to MetaMask:', error);
      }
    } else {
      alert('MetaMask is not installed. Please install it to use this app.');
    }
  };

  return (
    <button
      onClick={connectWallet}
      className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md transition"
    >
      {account
        ? `Connected: ${account.substring(0, 6)}...${account.substring(
            account.length - 4
          )}`
        : 'Connect wallet'}
    </button>
  );
};

export default ConnectWalletButton;
